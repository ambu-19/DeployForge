import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode,
  GitBranch,
  Key,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  RotateCw,
  Server,
  Settings,
  Square,
  Terminal,
  Trash2,
} from "lucide-react";
import { api } from "../api";
import { Badge } from "../components/Badge";
import { CodeEditor } from "../components/CodeEditor";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { LogViewer } from "../components/LogViewer";
import { Deployment, EnvVariable, Project } from "../types";

interface ProjectDetailViewProps {
  projectId: number;
  onBack: () => void;
  onDeleted: () => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
  onBack,
  onDeleted,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [activeTab, setActiveTab] = useState<
    "deployments" | "logs" | "dockerfile" | "env" | "metrics" | "settings"
  >("deployments");

  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [logType, setLogType] = useState<"build" | "runtime">("build");
  const [runtimeLogs, setRuntimeLogs] = useState("");
  const [stats, setStats] = useState<{
    running: boolean;
    cpu: number;
    mem_mb: number;
    mem_limit_mb: number;
  } | null>(null);

  // Environment variables state
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Modals & loading states
  const [actionLoading, setActionLoading] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Editable settings
  const [editPort, setEditPort] = useState(8080);
  const [editHealth, setEditHealth] = useState("/");
  const [editBranch, setEditBranch] = useState("main");
  const [editRootDir, setEditRootDir] = useState("");
  const [editCustomDockerfile, setEditCustomDockerfile] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchProjectData = async () => {
    try {
      const p = await api.getProject(projectId);
      setProject(p);
      setEditPort(p.port);
      setEditHealth(p.health_path);
      setEditBranch(p.branch);
      setEditRootDir(p.root_dir || "");
      setEditCustomDockerfile(p.custom_dockerfile || "");

      const deps = await api.getDeployments(projectId);
      setDeployments(deps);
      if (deps.length > 0 && selectedDeploymentId === null) {
        setSelectedDeploymentId(deps[0].id);
      }

      const envs = await api.getEnvVars(projectId);
      setEnvVars(envs);

      const st = await api.getProjectStats(projectId);
      setStats(st);
      if (st.logs) {
        setRuntimeLogs(st.logs);
      }
    } catch (e) {
      console.error("Failed to load project details:", e);
    }
  };

  useEffect(() => {
    fetchProjectData();
    const interval = setInterval(fetchProjectData, 4000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleDeployNow = async () => {
    setActionLoading(true);
    try {
      const r = await api.deployProject(projectId);
      setSelectedDeploymentId(r.id);
      setActiveTab("logs");
      setLogType("build");
      fetchProjectData();
    } catch (e: any) {
      alert(`Deployment failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await api.restartProject(projectId);
      fetchProjectData();
    } catch (e: any) {
      alert(`Restart failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await api.stopProject(projectId);
      fetchProjectData();
    } catch (e: any) {
      alert(`Stop failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!rollbackTarget) return;
    try {
      const r = await api.rollbackDeployment(rollbackTarget);
      setSelectedDeploymentId(r.id);
      setActiveTab("logs");
      setLogType("build");
      setRollbackTarget(null);
      fetchProjectData();
    } catch (e: any) {
      alert(`Rollback failed: ${e.message}`);
    }
  };

  const handleDeleteProject = async () => {
    try {
      await api.deleteProject(projectId);
      onDeleted();
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.updateProject(projectId, {
        port: editPort,
        health_path: editHealth,
        branch: editBranch,
        root_dir: editRootDir,
        custom_dockerfile: editCustomDockerfile,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchProjectData();
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    }
  };

  const handleAddEnv = async () => {
    if (!newKey.trim()) return;
    try {
      await api.setEnvVar(projectId, newKey.trim(), newVal);
      setNewKey("");
      setNewVal("");
      const envs = await api.getEnvVars(projectId);
      setEnvVars(envs);
    } catch (e: any) {
      alert(`Failed to set variable: ${e.message}`);
    }
  };

  const handleDeleteEnv = async (key: string) => {
    try {
      await api.deleteEnvVar(projectId, key);
      const envs = await api.getEnvVars(projectId);
      setEnvVars(envs);
    } catch (e: any) {
      alert(`Delete variable error: ${e.message}`);
    }
  };

  if (!project) {
    return (
      <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span>Loading service details...</span>
      </div>
    );
  }

  const selectedDeployment =
    deployments.find((d) => d.id === selectedDeploymentId) || deployments[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
            <Badge status={project.latest_status || (project.is_running ? "live" : "stopped")} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-1 font-mono">
              <GitBranch className="w-3.5 h-3.5 text-slate-500" />
              <span>{project.repo}@{project.branch}</span>
            </div>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-indigo-400">{project.framework || "Node.js"}</span>
            {project.root_dir && (
              <>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  📁 {project.root_dir}
                </span>
              </>
            )}
            <span className="text-slate-600">•</span>
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <span>{project.url}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeployNow}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Deploy Now</span>
          </button>
          <button
            onClick={handleRestart}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            title="Restart container"
          >
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Restart</span>
          </button>
          <button
            onClick={handleStop}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            title="Stop container"
          >
            <Square className="w-3.5 h-3.5 text-amber-400" />
            <span>Stop</span>
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-colors"
            title="Delete project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-800 text-xs font-medium overflow-x-auto">
        {[
          { id: "deployments", label: "Deployments", icon: <Rocket className="w-3.5 h-3.5" /> },
          { id: "logs", label: "Live Logs", icon: <Terminal className="w-3.5 h-3.5" /> },
          { id: "dockerfile", label: "Dockerfile", icon: <FileCode className="w-3.5 h-3.5" /> },
          { id: "env", label: "Environment Variables", icon: <Key className="w-3.5 h-3.5" /> },
          { id: "metrics", label: "Metrics & Telemetry", icon: <Activity className="w-3.5 h-3.5" /> },
          { id: "settings", label: "Service Settings", icon: <Settings className="w-3.5 h-3.5" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Deployments & Rollback History */}
      {activeTab === "deployments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Release History &amp; Blue-Green Controls</h3>
            <span className="text-xs text-slate-500">Zero-downtime rollback enabled</span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase font-semibold">
                  <th className="p-3">ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Commit</th>
                  <th className="p-3">Message</th>
                  <th className="p-3">Finished</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {deployments.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => {
                      setSelectedDeploymentId(d.id);
                      setActiveTab("logs");
                    }}
                    className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                      selectedDeploymentId === d.id ? "bg-slate-800/50" : ""
                    }`}
                  >
                    <td className="p-3 font-mono font-medium text-slate-300">#{d.id}</td>
                    <td className="p-3">
                      <Badge status={d.status} size="sm" />
                    </td>
                    <td className="p-3 capitalize text-slate-400">{d.kind}</td>
                    <td className="p-3 font-mono text-indigo-400">{d.commit || "manual"}</td>
                    <td className="p-3 text-slate-300 truncate max-w-xs">{d.message || "Manual deployment"}</td>
                    <td className="p-3 text-slate-500">
                      {d.finished_at ? new Date(d.finished_at).toLocaleTimeString() : "In progress..."}
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {d.can_rollback && d.status !== "live" && (
                        <button
                          type="button"
                          onClick={() => setRollbackTarget(d.id)}
                          className="flex items-center gap-1 ml-auto px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rollback</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Live Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLogType("build")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  logType === "build"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Build Logs {selectedDeployment ? `(#${selectedDeployment.id})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setLogType("runtime")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  logType === "runtime"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Runtime Container Logs
              </button>
            </div>

            {logType === "build" && (
              <select
                value={selectedDeploymentId || ""}
                onChange={(e) => setSelectedDeploymentId(Number(e.target.value))}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                {deployments.map((d) => (
                  <option key={d.id} value={d.id}>
                    Release #{d.id} ({d.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {logType === "build" ? (
            <LogViewer
              deploymentId={selectedDeploymentId}
              isStreaming={
                selectedDeployment?.status === "building" ||
                selectedDeployment?.status === "deploying"
              }
              title={`Build Stream • Release #${selectedDeploymentId}`}
            />
          ) : (
            <LogViewer
              staticLogs={runtimeLogs || "No runtime output emitted by container yet."}
              title="Docker Container Standard Output"
            />
          )}
        </div>
      )}

      {/* TAB 3: Dockerfile Studio */}
      {activeTab === "dockerfile" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Configured Dockerfile</h3>
              <p className="text-xs text-slate-400">
                You can edit this Dockerfile directly. Edits will be applied on your next deployment.
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saveSuccess ? "Saved!" : "Save Changes"}</span>
            </button>
          </div>

          <CodeEditor
            value={editCustomDockerfile}
            onChange={setEditCustomDockerfile}
            projectName={project.slug}
          />
        </div>
      )}

      {/* TAB 4: Environment Variables */}
      {activeTab === "env" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Environment Variables</h3>
              <p className="text-xs text-slate-400">
                Encrypted at rest with Fernet and automatically injected into container runtimes.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 shadow-lg">
            {envVars.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No custom environment variables set.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {envVars.map((e) => (
                  <div key={e.key} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <code className="w-48 font-bold text-indigo-400 font-mono">{e.key}</code>
                      <span className="text-slate-400 font-mono">
                        {revealedKeys[e.key] ? e.value : "••••••••••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedKeys((prev) => ({ ...prev, [e.key]: !prev[e.key] }))
                        }
                        className="p-1 text-slate-400 hover:text-slate-200"
                      >
                        {revealedKeys[e.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEnv(e.key)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Variable Form */}
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-800">
              <input
                type="text"
                placeholder="KEY (e.g. DATABASE_URL)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono sm:w-48"
              />
              <input
                type="password"
                placeholder="Value"
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono flex-1"
              />
              <button
                type="button"
                onClick={handleAddEnv}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shrink-0 cursor-pointer"
              >
                Add Variable
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Changes take effect on your next deployment or container restart.
            </p>
          </div>
        </div>
      )}

      {/* TAB 5: Metrics & Telemetry */}
      {activeTab === "metrics" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Container Resource Telemetry</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Container CPU</span>
              <div className="text-2xl font-bold font-mono text-sky-400">{stats?.cpu ?? 0}%</div>
              <div className="text-[11px] text-slate-500">Aggregated CPU utilization</div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Memory Usage</span>
              <div className="text-2xl font-bold font-mono text-purple-400">
                {stats?.mem_mb ?? 0} / {stats?.mem_limit_mb ?? 512} MB
              </div>
              <div className="text-[11px] text-slate-500">Container memory quota</div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Container Status</span>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {stats?.running ? "Running" : "Stopped"}
              </div>
              <div className="text-[11px] text-slate-500">Traefik file route active</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Settings */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Service Configuration</h3>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-lg max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Default Branch</label>
              <input
                type="text"
                value={editBranch}
                onChange={(e) => setEditBranch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Root Directory / Subdirectory</label>
              <input
                type="text"
                placeholder="e.g. hospital_support_app/client (leave blank for repository root)"
                value={editRootDir}
                onChange={(e) => setEditRootDir(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Application source folder relative to repository root for monorepos or nested apps.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Internal Container Port</label>
              <input
                type="number"
                value={editPort}
                onChange={(e) => setEditPort(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[10px] text-slate-500">
                Port where your app container listens (e.g. 80 for Nginx SPA, 8080/3000 for Node, 8000 for Python).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Health Check Path</label>
              <input
                type="text"
                value={editHealth}
                onChange={(e) => setEditHealth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md"
              >
                {saveSuccess ? "Settings Saved!" : "Save Settings"}
              </button>
            </div>
          </div>
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

      {/* Confirmation Modal for Project Deletion */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title={`Delete "${project.name}"?`}
        message={`Are you sure you want to permanently delete "${project.name}"? This stops containers, removes routes, and deletes logs.`}
        confirmLabel="Delete Project"
        isDestructive={true}
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
