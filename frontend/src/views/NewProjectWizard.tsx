import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cpu,
  FileCode,
  FolderGit2,
  GitBranch,
  Globe,
  Laptop,
  Layers,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles,
  Terminal,
} from "lucide-react";
import { GithubIcon } from "../components/GithubIcon";
import { api } from "../api";
import { CodeEditor } from "../components/CodeEditor";
import { DetectedApp, DetectionResult, FrameworkTemplate, GitHubRepo } from "../types";

interface NewProjectWizardProps {
  onCancel: () => void;
  onCreated: (projectId: number) => void;
  initialRepo?: string;
}

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({
  onCancel,
  onCreated,
  initialRepo = "",
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select Repo, 2: Detection & Config, 3: Dockerfile Studio & Deploy

  // Step 1: Repo & Branch
  const [repo, setRepo] = useState(initialRepo);
  const [branch, setBranch] = useState("main");
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Step 2 & 3: Detection & Dockerfile
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [rootDir, setRootDir] = useState("");
  const [selectedAppPath, setSelectedAppPath] = useState("");
  const [projectName, setProjectName] = useState("");
  const [port, setPort] = useState(8080);
  const [healthPath, setHealthPath] = useState("/");
  const [dockerfileContent, setDockerfileContent] = useState("");
  const [dockerignoreContent, setDockerignoreContent] = useState("");
  const [dockerComposeContent, setDockerComposeContent] = useState("");
  const [templates, setTemplates] = useState<FrameworkTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("react-vite");
  const [deploying, setDeploying] = useState(false);
  const [deploymentMode, setDeploymentMode] = useState<"local" | "public">("local");
  const [errorMsg, setErrorMsg] = useState("");

  // Load GitHub repos and templates on mount
  useEffect(() => {
    setLoadingRepos(true);
    api
      .getGitHubRepos()
      .then((repos) => {
        setGithubRepos(repos);
        setLoadingRepos(false);
      })
      .catch(() => setLoadingRepos(false));

    api
      .getTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  // When initialRepo is provided, auto-fill
  useEffect(() => {
    if (initialRepo) {
      setRepo(initialRepo);
      const name = initialRepo.split("/")[1] || initialRepo;
      setProjectName(name);
    }
  }, [initialRepo]);

  // Handle repository selection & trigger automatic detection
  const handleSelectRepo = (selectedRepo: string, defaultBranch = "main") => {
    setRepo(selectedRepo);
    setBranch(defaultBranch);
    setRootDir("");
    setSelectedAppPath("");
    const name = selectedRepo.split("/")[1] || selectedRepo;
    setProjectName(name);
  };

  const runDetection = async (targetRepo?: string, targetBranch?: string, targetRootDir?: string) => {
    const r = targetRepo || repo;
    const b = targetBranch || branch;
    const rd = targetRootDir !== undefined ? targetRootDir : rootDir;
    if (!r) {
      setErrorMsg("Please enter or select a GitHub repository");
      return;
    }
    setDetecting(true);
    setErrorMsg("");
    try {
      const res = await api.detectRepo({ repo: r, branch: b, root_dir: rd });
      setDetection(res);
      setDockerfileContent(res.dockerfile);
      setDockerignoreContent(res.dockerignore);
      setDockerComposeContent(res.docker_compose);
      setPort(res.recommended_port);
      setHealthPath(res.health_path || "/");

      const detectedRoot = res.root_dir || "";
      setRootDir(detectedRoot);
      setSelectedAppPath(detectedRoot);

      const repoBase = r.split("/")[1] || r;
      if (detectedRoot && detectedRoot !== ".") {
        const subName = detectedRoot.split("/").pop();
        setProjectName(`${repoBase}-${subName}`);
      } else if (!projectName) {
        setProjectName(repoBase);
      }
      setStep(2);
    } catch (e: any) {
      console.error("Detection failed:", e);
      setStep(2);
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectApp = (app: DetectedApp) => {
    const p = app.path === "." ? "" : app.path;
    setRootDir(p);
    setSelectedAppPath(app.path);
    setPort(app.recommended_port);
    setHealthPath(app.health_path || "/");
    setDockerfileContent(app.dockerfile);
    if (app.dockerignore) setDockerignoreContent(app.dockerignore);
    if (app.docker_compose) setDockerComposeContent(app.docker_compose);

    const repoBase = repo.split("/")[1] || repo;
    if (app.name && app.name !== "root") {
      setProjectName(`${repoBase}-${app.name}`);
    } else {
      setProjectName(repoBase);
    }
  };

  const handleTemplateSwitch = async (tmplId: string) => {
    setSelectedTemplate(tmplId);
    try {
      const res = await api.detectRepo({ template: tmplId });
      setDetection(res);
      setDockerfileContent(res.dockerfile);
      setDockerignoreContent(res.dockerignore);
      setDockerComposeContent(res.docker_compose);
      setPort(res.recommended_port);
      setHealthPath(res.health_path || "/");
    } catch (e) {
      console.error("Template switch error:", e);
    }
  };

  const handleDeploy = async () => {
    if (!repo) {
      setErrorMsg("Repository is required");
      return;
    }
    setDeploying(true);
    setErrorMsg("");
    try {
      const proj = await api.createProject({
        name: projectName || repo.split("/")[1],
        repo,
        branch,
        root_dir: rootDir,
        port,
        health_path: healthPath,
        framework: detection?.framework || "Custom",
        custom_dockerfile: dockerfileContent,
        build_cmd: detection?.build_command,
        start_cmd: detection?.start_command,
        deployment_mode: deploymentMode,
      });
      onCreated(proj.id);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to create project");
      setDeploying(false);
    }
  };

  const filteredRepos = githubRepos.filter((r) =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-400" />
            <span>Deploy New Application</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Universal auto-detection for web frontends, backends, monorepos, and microservices.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Step Progress Indicators */}
      <div className="flex items-center justify-between px-6 py-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
        <div className={`flex items-center gap-2 font-medium ${step >= 1 ? "text-indigo-400" : "text-slate-500"}`}>
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 1 ? "bg-indigo-600 text-white font-bold" : "bg-slate-800 text-slate-500"
            }`}
          >
            1
          </span>
          <span>Select Repository</span>
        </div>
        <div className="w-12 h-0.5 bg-slate-800" />
        <div className={`flex items-center gap-2 font-medium ${step >= 2 ? "text-indigo-400" : "text-slate-500"}`}>
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 2 ? "bg-indigo-600 text-white font-bold" : "bg-slate-800 text-slate-500"
            }`}
          >
            2
          </span>
          <span>Stack Detection &amp; Monorepo</span>
        </div>
        <div className="w-12 h-0.5 bg-slate-800" />
        <div className={`flex items-center gap-2 font-medium ${step >= 3 ? "text-indigo-400" : "text-slate-500"}`}>
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              step >= 3 ? "bg-indigo-600 text-white font-bold" : "bg-slate-800 text-slate-500"
            }`}
          >
            3
          </span>
          <span>Dockerfile Studio &amp; Deploy</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Select Repository */}
      {step === 1 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-xl">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Repository URL or identifier
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. ambu-19/Hospital_support_request_system_SDP or ambu-19/akshara-dasoha-tracker"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="text"
                placeholder="branch (main)"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-32 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                type="button"
                onClick={() => runDetection()}
                disabled={detecting || !repo}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 cursor-pointer transition-all"
              >
                {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>Inspect &amp; Detect</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Scans directory structures recursively, discovering single-page apps, backends, and multi-service monorepos.
            </p>
          </div>

          {/* Quick Samples */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Quick Test Repositories:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSelectRepo("ambu-19/Hospital_support_request_system_SDP", "main");
                  runDetection("ambu-19/Hospital_support_request_system_SDP", "main");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-purple-300 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Hospital SDP (Monorepo: React + FastAPI)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectRepo("ambu-19/akshara-dasoha-tracker", "main");
                  runDetection("ambu-19/akshara-dasoha-tracker", "main");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-indigo-300 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span>Akshara Dasoha (React+Vite SPA)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSelectRepo("ambu-19/hello-node", "main");
                  runDetection("ambu-19/hello-node", "main");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-emerald-300 border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>hello-node (Node.js Server)</span>
              </button>
            </div>
          </div>

          {/* GitHub Repositories List if connected */}
          {githubRepos.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <GithubIcon className="w-4 h-4" />
                  <span>Your GitHub Repositories ({githubRepos.length})</span>
                </span>
                <input
                  type="text"
                  placeholder="Filter repositories..."
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 w-48"
                />
              </div>

              <div className="max-h-56 overflow-auto divide-y divide-slate-800/80 border border-slate-800 rounded-xl bg-slate-950/40">
                {filteredRepos.map((r) => (
                  <div
                    key={r.full_name}
                    onClick={() => handleSelectRepo(r.full_name, r.default_branch)}
                    className={`p-3 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      repo === r.full_name ? "bg-indigo-600/15 border-l-2 border-indigo-500" : ""
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-200">{r.full_name}</div>
                      {r.description && <div className="text-[11px] text-slate-500 truncate max-w-md">{r.description}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 font-mono">{r.default_branch}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRepo(r.full_name, r.default_branch);
                          runDetection(r.full_name, r.default_branch);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 text-xs font-medium"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Automatic Detection Results & Configuration */}
      {step === 2 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-xl">
          {/* Detection Summary Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/30 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-100">
                  {detection?.framework || "Application Stack Detected"}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Auto-Configured
                </span>
                {rootDir && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                    <FolderGit2 className="w-3 h-3" />
                    <span>{rootDir}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {detection?.details || "Intelligent stack analysis complete. Configuration preset for optimal build performance."}
              </p>
            </div>
          </div>

          {/* Monorepo / Multi-App Selector Banner */}
          {detection?.apps && detection.apps.length > 1 && (
            <div className="space-y-2.5 p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>Monorepo Detected: Choose Application to Deploy ({detection.apps.length})</span>
                </span>
                <span className="text-[11px] text-slate-400">Select which service to build</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {detection.apps.map((app) => {
                  const isSelected =
                    selectedAppPath === app.path ||
                    (rootDir === "" && app.path === ".") ||
                    rootDir === app.path;
                  return (
                    <div
                      key={app.path}
                      onClick={() => handleSelectApp(app)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10"
                          : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5 font-mono">
                          <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{app.path}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {app.framework}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>{app.language}</span>
                        <span className="font-mono text-emerald-400">Port {app.recommended_port}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detected Attributes Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-500 font-medium uppercase">Language</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 font-mono">
                {detection?.language || "JavaScript"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-500 font-medium uppercase">Framework</div>
              <div className="text-xs font-semibold text-indigo-300 mt-1">
                {detection?.framework || "React + Vite"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-500 font-medium uppercase">Build Command</div>
              <div className="text-xs font-semibold text-slate-200 mt-1 font-mono">
                {detection?.build_command || "npm run build"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="text-[11px] text-slate-500 font-medium uppercase">Internal Port</div>
              <div className="text-xs font-semibold text-emerald-400 mt-1 font-mono">
                Port {port}
              </div>
            </div>
          </div>

          {/* Suggested Environment Variables from .env.example */}
          {detection?.env_vars && detection.env_vars.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected Environment Variables (.env.example)</span>
              </span>
              <p className="text-[11px] text-slate-300">
                This project appears to use these environment variables. You can configure values in the project settings after creation:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {detection.env_vars.map((ev) => (
                  <span key={ev} className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-600/30 text-[10px] font-mono text-amber-200">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Editable Project Configuration */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Service Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Service Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Target Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium flex items-center justify-between">
                  <span>Root Directory / Subdirectory</span>
                  {rootDir && <span className="text-[10px] text-indigo-400 font-mono">Nested app</span>}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. hospital_support_app/client or leave empty for root"
                    value={rootDir}
                    onChange={(e) => setRootDir(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => runDetection(repo, branch, rootDir)}
                    disabled={detecting}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 border border-slate-700 transition-colors"
                    title="Re-run stack detection for this subdirectory"
                  >
                    Scan
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Relative folder containing this application's source and build manifests.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">
                  Container Port (HTTP Listener)
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  Nginx SPA uses port 80; Node/Python use 8080/3000/8000.
                </p>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-slate-400 font-medium">Health Check Path</label>
                <input
                  type="text"
                  value={healthPath}
                  onChange={(e) => setHealthPath(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  HTTP GET endpoint evaluated by Traefik before traffic cutover.
                </p>
              </div>

              {/* DEPLOYMENT MODE SELECTION */}
              <div className="space-y-3 pt-3 border-t border-slate-800 md:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>Choose Deployment Mode</span>
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Deploy locally on Docker + Traefik, or publish to the internet with a free Cloudflare HTTPS Tunnel.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium inline-block self-start sm:self-auto">
                    100% Free • No Cloud Cost
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Local Deployment Card */}
                  <div
                    onClick={() => setDeploymentMode("local")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      deploymentMode === "local"
                        ? "bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/30"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                          <Laptop className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">Local Deployment</h4>
                          <span className="text-[10px] text-sky-400 font-mono">http://&lt;slug&gt;.localhost:8080</span>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deploymentMode === "local" ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-700"
                        }`}
                      >
                        {deploymentMode === "local" && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                      Fast, isolated execution on local Docker Engine with Traefik routing. Private to this machine with zero network latency.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Docker Engine</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Traefik Proxy</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Private Host</span>
                    </div>
                  </div>

                  {/* Public Deployment (Cloudflare Tunnel) Card */}
                  <div
                    onClick={() => setDeploymentMode("public")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      deploymentMode === "public"
                        ? "bg-emerald-600/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-200">Public Deployment</h4>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                              Free Tunnel
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono">https://*.trycloudflare.com</span>
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          deploymentMode === "public" ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-700"
                        }`}
                      >
                        {deploymentMode === "public" && <Check className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2.5 leading-relaxed">
                      Instant, free public HTTPS access via Cloudflare Quick Tunnel. Perfect for sharing with clients, mobile testing, webhooks, and demos.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-medium">Free HTTPS</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">Cloudflare Tunnel</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">No Account Needed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <span>Review Dockerfile Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Dockerfile Studio, Preview/Edit, Download, and Deploy */}
      {step === 3 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span>Generated Dockerfile &amp; Deployment Configuration</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review, edit, copy, or download your build configuration before triggering deployment.
              </p>
            </div>

            {/* Template Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Template:</span>
              <select
                value={selectedTemplate}
                onChange={(e) => handleTemplateSwitch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Code Editor with line numbers, copy, download, ZIP */}
          <CodeEditor
            value={dockerfileContent}
            onChange={setDockerfileContent}
            onRegenerate={() => handleTemplateSwitch(selectedTemplate)}
            dockerignore={dockerignoreContent}
            dockerCompose={dockerComposeContent}
            projectName={projectName || "deployforge-app"}
          />

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Config</span>
            </button>

            <button
              type="button"
              onClick={handleDeploy}
              disabled={deploying}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              {deploying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Launching Deployment Engine...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Deploy Application Live</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
