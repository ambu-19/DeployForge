import React from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  GitBranch,
  Layers,
  Plus,
  Rocket,
  Server,
  XCircle,
} from "lucide-react";
import { Badge } from "../components/Badge";
import { MonitoringData, OverviewStats, Project } from "../types";

interface OverviewViewProps {
  stats: OverviewStats | null;
  projects: Project[];
  monitoring: MonitoringData | null;
  onNewProject: () => void;
  onSelectProject: (id: number) => void;
  onDeployProject: (id: number) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  stats,
  projects,
  monitoring,
  onNewProject,
  onSelectProject,
  onDeployProject,
}) => {
  const runningProjects = projects.filter((p) => p.is_running);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">DeployForge Operations Center</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live PaaS
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Local cloud platform running autonomous container builds, intelligent multi-stage Dockerfiles, dynamic Traefik reverse proxying, and Prometheus observability.
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Deploy New Application</span>
        </button>
      </div>

      {/* Top 4 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Projects */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Projects</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats?.total_projects ?? projects.length}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Configured services</span>
          </div>
        </div>

        {/* Card 2: Running Containers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Active Apps</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats?.running_apps ?? runningProjects.length}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Healthy containers online</span>
          </div>
        </div>

        {/* Card 3: Successful Deployments */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Deployments</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Rocket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats?.successful_deployments ?? 0}</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Successful blue-green releases</span>
          </div>
        </div>

        {/* Card 4: Platform Success Rate */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Success Rate</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-100">{stats?.success_rate ?? 100}%</div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <span className="text-emerald-400 font-medium">Automatic rollback enabled</span>
          </div>
        </div>
      </div>

      {/* Middle Section: Live System Telemetry & Quick Project Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Applications Grid (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>Running Applications ({projects.length})</span>
            </h3>
            <span className="text-xs text-slate-500">Traefik Local Subdomains</span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                <Rocket className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-300">No applications deployed yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Connect your repository to auto-generate a Dockerfile and start your first deployment.
              </p>
              <button
                onClick={onNewProject}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
              >
                + Deploy Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 hover:border-slate-700 hover:bg-slate-900/90 transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-200 text-sm group-hover:text-indigo-400 transition-colors">
                        {project.name}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <GitBranch className="w-3 h-3" />
                        <span className="truncate max-w-[160px]">{project.repo}@{project.branch}</span>
                      </div>
                    </div>
                    <Badge status={project.latest_status || (project.is_running ? "live" : "stopped")} size="sm" />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                    <span className="text-slate-400 font-mono text-[11px]">{project.framework || "Node.js"}</span>
                    {project.url && (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-[11px]"
                      >
                        <span>{project.slug}.localhost:8080</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Container Telemetry Summary (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Resource Telemetry</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">cAdvisor / Docker</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-sm">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total CPU Usage</span>
                <span className="font-mono text-slate-200 font-medium">
                  {monitoring?.total_cpu ?? 0.0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, (monitoring?.total_cpu ?? 0) * 2))}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Active Container Memory</span>
                <span className="font-mono text-slate-200 font-medium">
                  {monitoring?.total_mem_mb ?? 0.0} MB
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, ((monitoring?.total_mem_mb ?? 0) / 1024) * 100))}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Prometheus Daemon</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {monitoring?.prometheus_healthy ? "Online (:9090)" : "Active"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Traefik Proxy</span>
                <span className="text-indigo-400 font-medium">Port 8080</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Grafana Dashboard</span>
                <a
                  href={monitoring?.grafana_url || "http://grafana.localhost:8080"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <span>Open Grafana</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Deployment Activity Feed */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Recent Deployment Activity</span>
          </h3>
          <span className="text-xs text-slate-500">Continuous Integration</span>
        </div>

        {(!stats?.recent_activity || stats.recent_activity.length === 0) ? (
          <div className="py-6 text-center text-xs text-slate-500">No deployment history yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Release</th>
                  <th className="py-2.5 px-3">Application</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Commit</th>
                  <th className="py-2.5 px-3">Message</th>
                  <th className="py-2.5 px-3">Trigger</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.recent_activity.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-medium text-slate-300">#{act.id}</td>
                    <td className="py-3 px-3 font-medium text-slate-200">{act.project_name}</td>
                    <td className="py-3 px-3">
                      <Badge status={act.status} size="sm" />
                    </td>
                    <td className="py-3 px-3 font-mono text-indigo-400">{act.commit || "manual"}</td>
                    <td className="py-3 px-3 text-slate-400 truncate max-w-xs">{act.message || "Manual deployment"}</td>
                    <td className="py-3 px-3 capitalize text-slate-400">{act.kind}</td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(act.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
