import React, { useEffect, useState } from "react";
import {
  Archive,
  Check,
  Cpu,
  FileCode,
  Layers,
  Loader2,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "../api";
import { CodeEditor } from "../components/CodeEditor";
import { DetectionResult, FrameworkTemplate } from "../types";

interface DockerfileStudioViewProps {
  onDeployConfiguration: (config: {
    dockerfile: string;
    port: number;
    framework: string;
  }) => void;
}

export const DockerfileStudioView: React.FC<DockerfileStudioViewProps> = ({
  onDeployConfiguration,
}) => {
  const [templates, setTemplates] = useState<FrameworkTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("react-vite");
  const [repoInput, setRepoInput] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [detection, setDetection] = useState<DetectionResult | null>(null);

  const [dockerfile, setDockerfile] = useState("");
  const [dockerignore, setDockerignore] = useState("");
  const [dockerCompose, setDockerCompose] = useState("");
  const [port, setPort] = useState(80);

  const loadTemplate = async (templateId: string) => {
    try {
      const res = await api.detectRepo({ template: templateId });
      setDetection(res);
      setDockerfile(res.dockerfile);
      setDockerignore(res.dockerignore);
      setDockerCompose(res.docker_compose);
      setPort(res.recommended_port);
    } catch (e) {
      console.error("Failed to load template:", e);
    }
  };

  useEffect(() => {
    api
      .getTemplates()
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          loadTemplate(data[0].id);
        }
      })
      .catch(() => loadTemplate("react-vite"));
  }, []);

  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplate(tmplId);
    loadTemplate(tmplId);
  };

  const handleInspectRepo = async () => {
    if (!repoInput.trim()) return;
    setInspecting(true);
    try {
      const res = await api.detectRepo({ repo: repoInput.trim(), branch: "main" });
      setDetection(res);
      setDockerfile(res.dockerfile);
      setDockerignore(res.dockerignore);
      setDockerCompose(res.docker_compose);
      setPort(res.recommended_port);
    } catch (e: any) {
      alert(`Inspection error: ${e.message}`);
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileCode className="w-5 h-5 text-indigo-400" />
            <span>Autonomous Dockerfile Generator Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Craft, inspect, validate, and download multi-stage production Dockerfiles for any framework.
          </p>
        </div>

        <button
          onClick={() =>
            onDeployConfiguration({
              dockerfile,
              port,
              framework: detection?.framework || "Custom",
            })
          }
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Rocket className="w-4 h-4" />
          <span>Deploy this Configuration</span>
        </button>
      </div>

      {/* Top Selector Grid: Presets or Repository Inspection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Preset Templates */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Select Architecture Template</span>
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} • {t.language} (Port {t.port})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500">
            Presets include multi-stage build optimization, caching rules, and production HTTP server setups.
          </p>
        </div>

        {/* Remote Inspection */}
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Auto-Generate from GitHub Repository</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. ambu-19/akshara-dasoha-tracker"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <button
              onClick={handleInspectRepo}
              disabled={inspecting || !repoInput.trim()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 transition-all shrink-0 cursor-pointer"
            >
              {inspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Inspect</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            DeployForge queries manifest files (package.json, pom.xml, etc.) and crafts the matching Dockerfile.
          </p>
        </div>
      </div>

      {/* Detection Banner if available */}
      {detection && (
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">
              Target Framework: <strong className="text-indigo-400">{detection.framework}</strong> • Internal Port:{" "}
              <strong className="text-emerald-400 font-mono">{port}</strong>
            </span>
          </div>
          <span className="text-slate-500 text-[11px] font-mono">{detection.start_command}</span>
        </div>
      )}

      {/* Code Editor */}
      <CodeEditor
        value={dockerfile}
        onChange={setDockerfile}
        onRegenerate={() => loadTemplate(selectedTemplate)}
        dockerignore={dockerignore}
        dockerCompose={dockerCompose}
        projectName={detection?.framework ? detection.framework.toLowerCase().replace(/[^a-z0-9]/g, "-") : "app"}
      />
    </div>
  );
};
