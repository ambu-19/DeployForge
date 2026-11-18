import React, { useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  GitBranch,
  Layers,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { Project } from "../types";

interface ProjectsViewProps {
  projects: Project[];
  onSelectProject: (id: number) => void;
  onNewProject: () => void;
  onRefresh: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  onSelectProject,
  onNewProject,
  onRefresh,
}) => {
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleDeploy = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setActionLoading(p.id);
    try {
      await api.deployProject(p.id);
      onSelectProject(p.id);
      onRefresh();
    } catch (err: any) {
      alert(`Deploy error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setActionLoading(p.id);
    try {
      await api.restartProject(p.id);
      onRefresh();
    } catch (err: any) {
      alert(`Restart error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setActionLoading(p.id);
    try {
      await api.stopProject(p.id);
      onRefresh();
    } catch (err: any) {
      alert(`Stop error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteProject(deleteTarget.id);
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>Applications &amp; Projects</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your deployed microservices, frontend applications, and APIs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={onNewProject}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Service</span>
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-12 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-medium text-slate-300">No projects found</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search ? "No projects match your filter criteria." : "Create your first deployment to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectProject(p.id)}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 hover:border-slate-700 hover:bg-slate-900/90 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-base group-hover:text-indigo-400 transition-colors">
                      {p.name}
                    </h3>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">{p.repo}@{p.branch}</span>
                    </div>
                  </div>
                  <Badge status={p.latest_status || (p.is_running ? "live" : "stopped")} size="sm" />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Framework</span>
                    <span className="text-indigo-300 font-medium font-mono">{p.framework || "Node.js"}</span>
                  </div>
                  {p.root_dir && (
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Subdirectory</span>
                      <span className="text-purple-300 font-mono text-[11px] truncate max-w-[150px]">{p.root_dir}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Port &amp; Health</span>
                    <span className="text-slate-200 font-mono">
                      {p.port} ({p.health_path})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Domain</span>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span className="truncate max-w-[150px]">{p.slug}.localhost</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleDeploy(e, p)}
                    disabled={actionLoading === p.id}
                    className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                    title="Deploy now"
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleRestart(e, p)}
                    disabled={actionLoading === p.id}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Restart container"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleStop(e, p)}
                    disabled={actionLoading === p.id}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Stop container"
                  >
                    <Square className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(p);
                  }}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Project Deletion */}
      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.name}"?`}
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will terminate all running Docker containers, remove Traefik dynamic routes, and purge build history permanently.`}
        confirmLabel="Delete Project"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
