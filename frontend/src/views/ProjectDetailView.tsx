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
  Globe,
  Key,
  Laptop,
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
  const [editDeploymentMode, setEditDeploymentMode] = useState<"local" | "public">("local");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);
  const [copiedLocalUrl, setCopiedLocalUrl] = useState(false);

  const fetchProjectData = async () => {
    try {
      const p = await api.getProject(projectId);
      setProject(p);
      setEditPort(p.port);
      setEditHealth(p.health_path);
      setEditBranch(p.branch);
      setEditRootDir(p.root_dir || "");
      setEditCustomDockerfile(p.custom_dockerfile || "");
      setEditDeploymentMode((p.deployment_mode as "local" | "public") || "local");

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

  const handleDeployLocal = async () => {
    setActionLoading(true);
    try {
      const res = await api.deployLocal(projectId);
      setSelectedDeploymentId(res.id);
      setActiveTab("logs");
      setLogType("build");
      fetchProjectData();
    } catch (e: any) {
      alert(`Local deploy failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeployPublic = async () => {
    setActionLoading(true);
    try {
      const res = await api.deployPublic(projectId);
      setSelectedDeploymentId(res.id);
      setActiveTab("logs");
      setLogType("build");
      fetchProjectData();
    } catch (e: any) {
      alert(`Public deploy failed: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartTunnel = async () => {
    setTunnelLoading(true);
    try {
      await api.startTunnel(projectId);
      await fetchProjectData();
    } catch (e: any) {
      alert(`Start tunnel error: ${e.message}`);
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setTunnelLoading(true);
    try {
      await api.stopTunnel(projectId);
      await fetchProjectData();
    } catch (e: any) {
      alert(`Stop tunnel error: ${e.message}`);
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleRestartTunnel = async () => {
    setTunnelLoading(true);
    try {
      await api.restartTunnel(projectId);
      await fetchProjectData();
    } catch (e: any) {
      alert(`Restart tunnel error: ${e.message}`);
    } finally {
      setTunnelLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: "public" | "local") => {
    navigator.clipboard.writeText(text);
    if (type === "public") {
      setCopiedPublicUrl(true);
      setTimeout(() => setCopiedPublicUrl(false), 2000);
    } else {
      setCopiedLocalUrl(true);
      setTimeout(() => setCopiedLocalUrl(false), 2000);
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
        deployment_mode: editDeploymentMode,
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
            <Badge status={project.latest_status || (project.is_running ? "live" : "stopped")} />
            {project.deployment_mode === "public" ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Public (Cloudflare Tunnel)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Laptop className="w-3.5 h-3.5" />
                <span>Localhost Only</span>
              </span>
            )}
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
              className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
            >
              <span>{project.url}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {project.public_url && (
              <>
                <span className="text-slate-600">•</span>
                <a
                  href={project.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium font-mono"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{project.public_url}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Dual Deployment Mode & Cloudflare Quick Tunnel Management Card */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-5 shadow-lg relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
          project.deployment_mode === "public" ? "bg-emerald-500/5" : "bg-sky-500/5"
        }`} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          {/* Mode & Live Status */}
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Deployment Mode:
              </span>

              {project.deployment_mode === "public" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Public Deployment (Cloudflare Tunnel)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-semibold">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Localhost Only (Docker + Traefik)</span>
                </span>
              )}

              {/* Tunnel Status pill if public */}
              {project.deployment_mode === "public" && (
                <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-mono ${
                  project.tunnel_status === "connected"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/40"
                    : project.tunnel_status === "starting"
                    ? "bg-amber-950/80 text-amber-300 border border-amber-800/40"
                    : "bg-rose-950/80 text-rose-300 border border-rose-800/40"
                }`}>
                  Tunnel: {project.tunnel_status?.toUpperCase() || "DISCONNECTED"}
                </span>
              )}
            </div>

            {/* URL Display Area */}
            {project.deployment_mode === "public" ? (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Public HTTPS Address:</span>
                </div>
                {project.public_url ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-mono shadow-inner">
                      <span className="truncate max-w-sm sm:max-w-md">{project.public_url}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(project.public_url!, "public")}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                      title="Copy Public HTTPS URL"
                    >
                      {copiedPublicUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPublicUrl ? "Copied!" : "Copy"}</span>
                    </button>
                    <a
                      href={project.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <span>Open Live App</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ) : (
                  <div className="text-xs text-amber-400 flex items-center gap-2 py-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Cloudflare Tunnel is starting... Click "Start Tunnel" if it does not connect in a few seconds.</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  Accessible worldwide over HTTPS without port forwarding, firewalls, or cloud hosting costs.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Laptop className="w-3.5 h-3.5 text-sky-400" />
                  <span>Local Host Address:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-slate-950 border border-sky-500/30 rounded-xl px-3 py-1.5 text-xs text-sky-400 font-mono shadow-inner">
                    <span>{project.url}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(project.url, "local")}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
                    title="Copy Local URL"
                  >
                    {copiedLocalUrl ? <Check className="w-3.5 h-3.5 text-sky-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLocalUrl ? "Copied!" : "Copy"}</span>
                  </button>
                  <a
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all"
                  >
                    <span>Open Local App</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-400">
                  Running isolated on your machine. Click "Enable Public Tunnel" to generate a free shareable HTTPS URL.
                </p>
              </div>
            )}
          </div>

          {/* Quick Tunnel Actions / Mode Switchers */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
            {project.deployment_mode === "public" ? (
              <>
                {project.tunnel_status === "connected" ? (
                  <button
                    onClick={handleStopTunnel}
                    disabled={tunnelLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-medium border border-slate-700 hover:border-rose-500/30 transition-all cursor-pointer"
                    title="Disconnect Cloudflare Quick Tunnel"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400" />
                    <span>Stop Tunnel</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartTunnel}
                    disabled={tunnelLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                    title="Start Cloudflare Quick Tunnel"
                  >
                    {tunnelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    <span>Start Tunnel</span>
                  </button>
                )}

                <button
                  onClick={handleRestartTunnel}
                  disabled={tunnelLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                  title="Generate new temporary URL"
                >
                  <RotateCw className="w-3.5 h-3.5 text-sky-400" />
                  <span>Regenerate URL</span>
                </button>

                <button
                  onClick={handleDeployLocal}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600/10 hover:bg-sky-600/20 text-sky-300 text-xs font-medium border border-sky-500/30 transition-colors cursor-pointer"
                  title="Switch back to local only mode"
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Switch to Local</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleDeployPublic}
                  disabled={actionLoading || tunnelLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  title="Generate free Cloudflare Tunnel public URL"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Enable Public Tunnel</span>
                </button>
              </>
            )}
          </div>
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

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Default Deployment Mode</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  onClick={() => setEditDeploymentMode("local")}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs ${
                    editDeploymentMode === "local"
                      ? "bg-indigo-600/10 border-indigo-500/50 text-indigo-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Local Only</div>
                      <div className="text-[10px] text-slate-500 font-mono">http://&lt;slug&gt;.localhost:8080</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="editMode"
                    checked={editDeploymentMode === "local"}
                    onChange={() => setEditDeploymentMode("local")}
                    className="accent-indigo-600"
                  />
                </label>

                <label
                  onClick={() => setEditDeploymentMode("public")}
                  className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between text-xs ${
                    editDeploymentMode === "public"
                      ? "bg-emerald-600/10 border-emerald-500/50 text-emerald-200"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-slate-200">Public Tunnel</div>
                      <div className="text-[10px] text-emerald-400 font-mono">https://*.trycloudflare.com</div>
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="editMode"
                    checked={editDeploymentMode === "public"}
                    onChange={() => setEditDeploymentMode("public")}
                    className="accent-emerald-600"
                  />
                </label>
              </div>
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
