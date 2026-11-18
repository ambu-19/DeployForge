import React, { useEffect, useState } from "react";
import {
  Clock,
  ExternalLink,
  Filter,
  Play,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Terminal,
} from "lucide-react";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { LogViewer } from "../components/LogViewer";
import { Deployment, Project } from "../types";

interface DeploymentsViewProps {
  projects: Project[];
  onSelectProject: (id: number) => void;
}

export const DeploymentsView: React.FC<DeploymentsViewProps> = ({
  projects,
  onSelectProject,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [deployments, setDeployments] = useState<{ deployment: Deployment; project: Project }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);

  const fetchAllDeployments = async () => {
    setLoading(true);
    try {
      const all: { deployment: Deployment; project: Project }[] = [];
      const projsToFetch = selectedProjectId
        ? projects.filter((p) => p.id === selectedProjectId)
        : projects;

      for (const p of projsToFetch) {
        try {
          const deps = await api.getDeployments(p.id);
          deps.forEach((d) => all.push({ deployment: d, project: p }));
        } catch {
          // ignore
        }
      }
      // Sort newest first
      all.sort((a, b) => b.deployment.id - a.deployment.id);
      setDeployments(all);
    } catch (e) {
      console.error("Error fetching deployments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllDeployments();
  }, [selectedProjectId, projects]);

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    try {
      await api.rollbackDeployment(rollbackTarget);
      setRollbackTarget(null);
      fetchAllDeployments();
    } catch (e: any) {
      alert(`Rollback error: ${e.message}`);
    }
  };

  const filtered = deployments.filter((item) => {
    if (statusFilter === "all") return true;
    return item.deployment.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-400" />
            <span>Deployments &amp; Build History</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit releases, view live build logs, and trigger blue-green rollbacks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project Filter */}
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Services</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="live">Live Only</option>
            <option value="building">Building / Deploying</option>
            <option value="failed">Failed Only</option>
            <option value="superseded">Superseded</option>
          </select>

          <button
            onClick={fetchAllDeployments}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Refresh deployments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider bg-slate-950/40">
                <th className="p-3">Release ID</th>
                <th className="p-3">Service</th>
                <th className="p-3">Status</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Commit</th>
                <th className="p-3">Message</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No deployments match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map(({ deployment: d, project: p }) => (
                  <tr
                    key={d.id}
                    onClick={() => setActiveLogId(activeLogId === d.id ? null : d.id)}
                    className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                      activeLogId === d.id ? "bg-slate-800/50" : ""
                    }`}
                  >
                    <td className="p-3 font-mono font-medium text-slate-300">#{d.id}</td>
                    <td className="p-3 font-medium text-slate-200">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProject(p.id);
                        }}
                        className="hover:text-indigo-400 hover:underline transition-colors"
                      >
                        {p.name}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge status={d.status} size="sm" />
                    </td>
                    <td className="p-3 capitalize text-slate-400">{d.kind}</td>
                    <td className="p-3 font-mono text-indigo-400">{d.commit || "manual"}</td>
                    <td className="p-3 text-slate-400 truncate max-w-xs">{d.message || "Manual deployment"}</td>
                    <td className="p-3 text-slate-500">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveLogId(activeLogId === d.id ? null : d.id)}
                          className={`p-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            activeLogId === d.id
                              ? "bg-indigo-600 text-white border-indigo-500"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                          }`}
                          title="View live stream / console logs"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>

                        {d.can_rollback && d.status !== "live" && (
                          <button
                            type="button"
                            onClick={() => setRollbackTarget(d.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
                            title="Rollback live traffic to this version"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Rollback</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out or Inline Log Viewer when a deployment is clicked */}
      {activeLogId && (
        <div className="space-y-2 pt-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>Console Stream for Release #{activeLogId}</span>
            </h3>
            <button
              onClick={() => setActiveLogId(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Close Stream ✕
            </button>
          </div>
          <LogViewer
            deploymentId={activeLogId}
            isStreaming={true}
            title={`Build Log Stream • #${activeLogId}`}
          />
        </div>
      )}

      {/* Confirmation Modal for Rollback */}
      <ConfirmationModal
        isOpen={Boolean(rollbackTarget)}
        title={`Rollback to Release #${rollbackTarget}?`}
        message={`This will redeploy the previously verified Docker image from Release #${rollbackTarget} using zero-downtime blue-green routing.`}
        confirmLabel="Execute Rollback"
        isDestructive={false}
        onConfirm={handleRollback}
        onCancel={() => setRollbackTarget(null)}
      />
    </div>
  );
};
