import React from "react";
import { ChevronDown, ExternalLink, Plus, Server } from "lucide-react";
import { Project } from "../types";

interface NavbarProps {
  title: string;
  projects: Project[];
  selectedProjectId: number | null;
  onSelectProject: (id: number | null) => void;
  onNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
}) => {
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <header className="h-16 border-b border-slate-800 bg-[#0d131f]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-100 capitalize">{title}</h1>

        {/* Project Selector Dropdown if multiple projects */}
        {projects.length > 0 && (
          <div className="relative flex items-center">
            <span className="text-slate-600 text-sm mr-2">/</span>
            <select
              value={selectedProjectId || ""}
              onChange={(e) => onSelectProject(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.live_deployment ? "●" : "○"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* System Health Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Traefik &amp; Docker Online</span>
        </div>

        {/* Selected Project Live Link */}
        {selectedProject?.url && selectedProject.is_running && (
          <a
            href={selectedProject.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/30 transition-all font-medium"
          >
            <span>Open {selectedProject.slug}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}

        {/* New Project Quick Button */}
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 hover:shadow-indigo-500/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Service</span>
        </button>
      </div>
    </header>
  );
};
