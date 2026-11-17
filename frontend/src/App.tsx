import { useEffect, useRef, useState } from "react";

const initToken = () => {
  const m = location.hash.match(/token=([^&]+)/);
  if (m) { localStorage.setItem("t", m[1]); history.replaceState(null, "", "/"); }
  return localStorage.getItem("t");
};

async function api(path: string, opts: any = {}) {
  const r = await fetch("/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("t") },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) { localStorage.removeItem("t"); location.reload(); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({ detail: r.statusText }))).detail);
  return r.status === 204 ? null : r.json();
}

const COLORS: Record<string, string> = {
  live: "bg-emerald-500", failed: "bg-red-500", building: "bg-amber-500", deploying: "bg-sky-500",
  queued: "bg-slate-500", superseded: "bg-slate-600",
};
const Badge = ({ s }: { s: string }) => <span className={`px-2 py-0.5 rounded text-xs font-medium ${COLORS[s] || "bg-slate-600"}`}>{s}</span>;
const btn = "px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm disabled:opacity-50";
const input = "bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm";

function usePoll<T>(fn: () => Promise<T>, ms: number, deps: any[]) {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    const tick = () => fn().then((x) => on && setV(x)).catch(() => {});
    tick();
    const h = setInterval(tick, ms);
    return () => { on = false; clearInterval(h); };
  }, deps);
  return v;
}

function Login() {
  const dev = async () => {
    const r = await fetch("/api/auth/dev", { method: "POST" });
    if (r.ok) { localStorage.setItem("t", (await r.json()).token); location.reload(); } else alert("Demo login disabled");
  };
  return (
    <div className="min-h-screen grid place-items-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">🔨 DeployForge</h1>
        <p className="text-slate-400">Push code. Watch it go live.</p>
        <div className="space-x-2">
          <a className={btn + " inline-block"} href="/api/auth/login">Sign in with GitHub</a>
          <button className={btn + " bg-slate-700 hover:bg-slate-600"} onClick={dev}>Demo login</button>
        </div>
      </div>
    </div>
  );
}

function NewProject({ onDone }: { onDone: () => void }) {
  const [repo, setRepo] = useState(""); const [branch, setBranch] = useState("main");
  const [port, setPort] = useState(8080); const [health, setHealth] = useState("/"); const [err, setErr] = useState("");
  const repos = usePoll<any[]>(() => api("/github/repos"), 600000, []) || [];
  const submit = async () => {
    try { await api("/projects", { method: "POST", body: { repo, branch, port, health_path: health } }); onDone(); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <div className="bg-slate-900 rounded p-4 space-y-2">
      <h3 className="font-semibold">Connect a repository</h3>
      <input list="repos" className={input + " w-full"} placeholder="owner/repo" value={repo}
        onChange={(e) => { setRepo(e.target.value); const r = repos.find((x) => x.full_name === e.target.value); if (r) setBranch(r.default_branch); }} />
      <datalist id="repos">{repos.map((r) => <option key={r.full_name} value={r.full_name} />)}</datalist>
      <div className="flex gap-2">
        <input className={input} placeholder="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
        <input className={input + " w-24"} type="number" value={port} onChange={(e) => setPort(+e.target.value)} title="container port" />
        <input className={input} value={health} onChange={(e) => setHealth(e.target.value)} title="health check path" />
      </div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      <button className={btn} onClick={submit}>Create &amp; deploy</button>
    </div>
  );
}

function LogPane({ id }: { id: number }) {
  const [lines, setLines] = useState<string[]>([]); const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setLines([]);
    const es = new EventSource(`/api/deployments/${id}/logs?token=${localStorage.getItem("t")}`);
    es.onmessage = (e) => setLines((l) => [...l, JSON.parse(e.data)]);
    es.addEventListener("end", () => es.close());
    es.onerror = () => es.close();
    return () => es.close();
  }, [id]);
  useEffect(() => end.current?.scrollIntoView(), [lines]);
  return <pre className="bg-black rounded p-3 text-xs h-72 overflow-auto whitespace-pre-wrap">{lines.join("\n")}<div ref={end} /></pre>;
}

function Metrics({ pid }: { pid: number }) {
  const [hist, setHist] = useState<{ cpu: number; mem: number }[]>([]);
  const s: any = usePoll(async () => {
    const x = await api(`/projects/${pid}/stats`);
    setHist((h) => [...h.slice(-39), { cpu: x.cpu, mem: x.mem_mb }]);
    return x;
  }, 3000, [pid]);
  const spark = (key: "cpu" | "mem", color: string) => {
    const max = Math.max(1, ...hist.map((h) => h[key]));
    const pts = hist.map((h, i) => `${(i / 39) * 200},${50 - (h[key] / max) * 48}`).join(" ");
    return <svg viewBox="0 0 200 50" className="w-full h-16 bg-slate-900 rounded"><polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} /></svg>;
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><div className="text-sm text-slate-400">CPU {s?.cpu ?? 0}%</div>{spark("cpu", "#38bdf8")}</div>
        <div><div className="text-sm text-slate-400">Memory {s?.mem_mb ?? 0} / {s?.mem_limit_mb ?? 0} MB</div>{spark("mem", "#a78bfa")}</div>
      </div>
      <pre className="bg-black rounded p-3 text-xs h-56 overflow-auto whitespace-pre-wrap">{s?.logs || "No runtime logs"}</pre>
    </div>
  );
}

function EnvPanel({ pid }: { pid: number }) {
  const [k, setK] = useState(""); const [v, setV] = useState(""); const [n, setN] = useState(0);
  const vars = usePoll<any[]>(() => api(`/projects/${pid}/env`), 60000, [pid, n]) || [];
  return (
    <div className="space-y-2">
      {vars.map((e) => (
        <div key={e.key} className="flex gap-2 text-sm items-center">
          <code className="w-48">{e.key}</code><code className="text-slate-500">{e.value}</code>
          <button className="text-red-400" onClick={async () => { await api(`/projects/${pid}/env/${e.key}`, { method: "DELETE" }); setN(n + 1); }}>remove</button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className={input} placeholder="KEY" value={k} onChange={(e) => setK(e.target.value)} />
        <input className={input} placeholder="value (encrypted at rest)" type="password" value={v} onChange={(e) => setV(e.target.value)} />
        <button className={btn} onClick={async () => { await api(`/projects/${pid}/env`, { method: "PUT", body: { key: k, value: v } }); setK(""); setV(""); setN(n + 1); }}>Save</button>
      </div>
      <p className="text-xs text-slate-500">Changes apply on the next deploy.</p>
    </div>
  );
}

function ProjectView({ p, onDeleted }: { p: any; onDeleted: () => void }) {
  const [tab, setTab] = useState("deployments"); const [sel, setSel] = useState<number | null>(null);
  const deps = usePoll<any[]>(() => api(`/projects/${p.id}/deployments`), 2500, [p.id]) || [];
  useEffect(() => { setSel(null); }, [p.id]);
  const shown = sel ?? deps[0]?.id;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-semibold">{p.name}</h2>
          <a className="text-indigo-400 text-sm" href={p.url} target="_blank">{p.url}</a>
          <span className="text-slate-500 text-sm ml-2">{p.repo}@{p.branch}</span></div>
        <div className="space-x-2">
          <button className={btn} onClick={async () => { const r = await api(`/projects/${p.id}/deploy`, { method: "POST" }); setSel(r.id); setTab("deployments"); }}>Deploy now</button>
          <button className={btn + " bg-red-700 hover:bg-red-600"} onClick={async () => { if (confirm("Delete project and stop containers?")) { await api(`/projects/${p.id}`, { method: "DELETE" }); onDeleted(); } }}>Delete</button>
        </div>
      </div>
      <div className="flex gap-4 border-b border-slate-800 text-sm">
        {["deployments", "metrics", "environment"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 capitalize ${tab === t ? "border-b-2 border-indigo-500" : "text-slate-400"}`}>{t}</button>
        ))}
      </div>
      {tab === "deployments" && (
        <div className="space-y-3">
          <table className="w-full text-sm"><tbody>
            {deps.map((d) => (
              <tr key={d.id} onClick={() => setSel(d.id)} className={`cursor-pointer hover:bg-slate-900 ${shown === d.id ? "bg-slate-900" : ""}`}>
                <td className="p-2">#{d.id}</td><td><Badge s={d.status} /></td>
                <td className="text-slate-400">{d.kind}</td><td><code>{d.commit}</code></td>
                <td className="truncate max-w-xs">{d.message}</td>
                <td>{d.can_rollback && d.status !== "live" &&
                  <button className="text-amber-400" onClick={async (e) => { e.stopPropagation(); if (confirm(`Roll back to #${d.id}?`)) { const r = await api(`/deployments/${d.id}/rollback`, { method: "POST" }); setSel(r.id); } }}>↩ rollback</button>}</td>
              </tr>))}
          </tbody></table>
          {shown && <LogPane id={shown} />}
        </div>)}
      {tab === "metrics" && <Metrics pid={p.id} />}
      {tab === "environment" && <EnvPanel pid={p.id} />}
    </div>
  );
}

export default function App() {
  const [authed] = useState(!!initToken());
  const [n, setN] = useState(0); const [sel, setSel] = useState<number | null>(null); const [adding, setAdding] = useState(false);
  const projects = usePoll<any[]>(() => api("/projects"), 5000, [n]) || [];
  if (!authed) return <Login />;
  const cur = projects.find((p) => p.id === sel) || (adding ? null : projects[0]);
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-slate-800 p-4 space-y-2">
        <h1 className="font-bold text-lg mb-4">🔨 DeployForge</h1>
        {projects.map((p) => (
          <div key={p.id} onClick={() => { setSel(p.id); setAdding(false); }}
            className={`p-2 rounded cursor-pointer text-sm ${cur?.id === p.id ? "bg-slate-800" : "hover:bg-slate-900"}`}>
            {p.name}{p.live_deployment ? <span className="ml-2 text-emerald-400">●</span> : <span className="ml-2 text-slate-600">●</span>}
          </div>))}
        <button className={btn + " w-full"} onClick={() => setAdding(true)}>+ New project</button>
        <button className="text-xs text-slate-500" onClick={() => { localStorage.removeItem("t"); location.reload(); }}>Sign out</button>
      </aside>
      <main className="flex-1 p-6">
        {adding || !cur ? <NewProject onDone={() => { setAdding(false); setSel(null); setN(n + 1); }} />
          : <ProjectView key={cur.id} p={cur} onDeleted={() => { setSel(null); setN(n + 1); }} />}
      </main>
    </div>
  );
}
