import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Layers,
  Network,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Project } from "../types";

interface DomainsViewProps {
  projects: Project[];
}

export const DomainsView: React.FC<DomainsViewProps> = ({ projects }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <span>Local Domains &amp; Ingress Routing</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Atomic reverse-proxy routing managed dynamically through Traefik v3 file-provider configuration.
        </p>
      </div>

      {/* Explanatory Callout Banner */}
      <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3 text-xs">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-slate-300 leading-relaxed">
          <span className="font-semibold text-indigo-300">How Local Subdomain Ingress Works:</span>
          <p>
            Per RFC 6761, all modern web browsers (Chrome, Edge, Firefox, Safari) automatically resolve any domain ending with{" "}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">*.localhost</code> to the loopback IP (127.0.0.1) without requiring any manual changes to your Windows{" "}
            <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300 font-mono">hosts</code> file! Traefik inspects the incoming Host header and forwards requests to the healthy green container.
          </p>
        </div>
      </div>

      {/* Active Routing Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Network className="w-4 h-4 text-emerald-400" />
            <span>Active Dynamic Traefik Routes</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">Entrypoint :80</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider bg-slate-950/40">
                <th className="p-3">Router Name</th>
                <th className="p-3">Host Rule</th>
                <th className="p-3">Target Service</th>
                <th className="p-3">Internal Port</th>
                <th className="p-3">Health Path</th>
                <th className="p-3 text-right">Destination URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {/* Platform Core Routes */}
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-mono text-slate-300">df-platform-ui</td>
                <td className="p-3 font-mono text-indigo-300">Host(`localhost`)</td>
                <td className="p-3 text-slate-400">frontend:80</td>
                <td className="p-3 font-mono text-slate-400">80</td>
                <td className="p-3 font-mono text-slate-400">/</td>
                <td className="p-3 text-right">
                  <a
                    href="http://localhost:8080/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <span>http://localhost:8080</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-mono text-slate-300">df-platform-api</td>
                <td className="p-3 font-mono text-indigo-300">Host(`localhost`) &amp;&amp; PathPrefix(`/api`)</td>
                <td className="p-3 text-slate-400">backend:8000</td>
                <td className="p-3 font-mono text-slate-400">8000</td>
                <td className="p-3 font-mono text-slate-400">/api/health</td>
                <td className="p-3 text-right">
                  <a
                    href="http://localhost:8080/api/health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono"
                  >
                    <span>/api/health</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
              <tr className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-mono text-slate-300">df-grafana</td>
                <td className="p-3 font-mono text-indigo-300">Host(`grafana.localhost`)</td>
                <td className="p-3 text-slate-400">grafana:3000</td>
                <td className="p-3 font-mono text-slate-400">3000</td>
                <td className="p-3 font-mono text-slate-400">/api/health</td>
                <td className="p-3 text-right">
                  <a
                    href="http://grafana.localhost:8080"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-mono"
                  >
                    <span>grafana.localhost:8080</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>

              {/* Dynamic Project Routes */}
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-slate-200">df-{p.slug}</td>
                  <td className="p-3 font-mono text-indigo-300">Host(`{p.slug}.localhost`)</td>
                  <td className="p-3 text-slate-400">df-{p.slug}-*:{p.port}</td>
                  <td className="p-3 font-mono text-slate-300">{p.port}</td>
                  <td className="p-3 font-mono text-slate-400">{p.health_path}</td>
                  <td className="p-3 text-right">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-mono font-medium"
                    >
                      <span>{p.slug}.localhost:8080</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
