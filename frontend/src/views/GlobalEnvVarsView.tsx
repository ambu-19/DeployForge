import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Key, Lock, Plus, Shield, Trash2 } from "lucide-react";
import { api } from "../api";
import { EnvVariable, Project } from "../types";

interface GlobalEnvVarsViewProps {
  projects: Project[];
}

export const GlobalEnvVarsView: React.FC<GlobalEnvVarsViewProps> = ({ projects }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  const loadEnv = async () => {
    if (!selectedProjectId) return;
    try {
      const vars = await api.getEnvVars(selectedProjectId);
      setEnvVars(vars);
    } catch (e) {
      console.error("Error loading env vars:", e);
    }
  };

  useEffect(() => {
    loadEnv();
  }, [selectedProjectId]);

  const handleAdd = async () => {
    if (!selectedProjectId || !newKey.trim()) return;
    try {
      await api.setEnvVar(selectedProjectId, newKey.trim().toUpperCase(), newVal);
      setNewKey("");
      setNewVal("");
      loadEnv();
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    }
  };

  const handleDelete = async (key: string) => {
    if (!selectedProjectId) return;
    try {
      await api.deleteEnvVar(selectedProjectId, key);
      loadEnv();
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <span>Environment Variables &amp; Secrets</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Store application configurations securely. Values are encrypted at rest with Fernet.
          </p>
        </div>

        {/* Project Selector */}
        <select
          value={selectedProjectId || ""}
          onChange={(e) => setSelectedProjectId(Number(e.target.value))}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.slug})
            </option>
          ))}
        </select>
      </div>

      {/* Variables List Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Active Variables ({envVars.length})
          </span>
          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>AES-CBC 128 / Fernet Encrypted</span>
          </span>
        </div>

        {envVars.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 italic">
            No variables configured for this application yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {envVars.map((e) => (
              <div key={e.key} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <code className="w-56 font-bold text-indigo-400 font-mono">{e.key}</code>
                  <span className="text-slate-400 font-mono">
                    {revealed[e.key] ? e.value : "••••••••••••••••"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealed((prev) => ({ ...prev, [e.key]: !prev[e.key] }))}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200"
                    title="Toggle secret masking"
                  >
                    {revealed[e.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.key)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    title="Delete variable"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Form */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Add New Variable
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="VARIABLE_NAME"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono sm:w-56"
            />
            <input
              type="password"
              placeholder="Value"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono flex-1"
            />
            <button
              type="button"
              onClick={handleAdd}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
            >
              Save Variable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
