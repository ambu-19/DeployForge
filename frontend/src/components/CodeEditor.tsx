import React, { useState } from "react";
import JSZip from "jszip";
import {
  AlertCircle,
  Archive,
  Check,
  Copy,
  Download,
  FileCode,
  FileText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api";

interface CodeEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRegenerate?: () => void;
  dockerignore?: string;
  dockerCompose?: string;
  projectName?: string;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  onRegenerate,
  dockerignore = ".git\nnode_modules\ndist\nbuild\n.env\n",
  dockerCompose = "",
  projectName = "deployforge-app",
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<"dockerfile" | "dockerignore" | "compose">("dockerfile");
  const [copied, setCopied] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  const lines = (activeTab === "dockerfile" ? value : activeTab === "dockerignore" ? dockerignore : dockerCompose).split("\n");

  const handleCopy = () => {
    const textToCopy =
      activeTab === "dockerfile" ? value : activeTab === "dockerignore" ? dockerignore : dockerCompose;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadActive = () => {
    if (activeTab === "dockerfile") {
      downloadFile("Dockerfile", value);
    } else if (activeTab === "dockerignore") {
      downloadFile(".dockerignore", dockerignore);
    } else {
      downloadFile("docker-compose.yml", dockerCompose);
    }
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      zip.file("Dockerfile", value);
      zip.file(".dockerignore", dockerignore);
      if (dockerCompose) {
        zip.file("docker-compose.yml", dockerCompose);
      }
      zip.file(
        "deployforge.json",
        JSON.stringify(
          {
            project: projectName,
            generated_at: new Date().toISOString(),
            platform: "DeployForge Mini PaaS",
          },
          null,
          2
        )
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectName}-deployment.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ZIP creation failed:", e);
      alert("Failed to generate ZIP archive");
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await api.validateDockerfile(value);
      setValidationResult(res);
    } catch (e: any) {
      setValidationResult({ valid: false, errors: [e.message], warnings: [] });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#090d16] overflow-hidden flex flex-col shadow-xl">
      {/* Editor Header */}
      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Tab Switchers */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("dockerfile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "dockerfile"
                ? "bg-slate-800 text-indigo-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Dockerfile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dockerignore")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "dockerignore"
                ? "bg-slate-800 text-indigo-400 border border-slate-700"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>.dockerignore</span>
          </button>
          {dockerCompose && (
            <button
              type="button"
              onClick={() => setActiveTab("compose")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "compose"
                  ? "bg-slate-800 text-indigo-400 border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>docker-compose.yml</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === "dockerfile" && (
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              title="Validate Dockerfile Syntax"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Validate</span>
            </button>
          )}

          {onRegenerate && activeTab === "dockerfile" && (
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
              title="Regenerate Dockerfile from template"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Regenerate</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadActive}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700 transition-colors"
            title="Download this file"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 text-xs font-medium border border-indigo-500/40 transition-colors"
            title="Download all deployment files as ZIP archive"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Download ZIP</span>
          </button>
        </div>
      </div>

      {/* Validation Message Bar */}
      {validationResult && (
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between ${
            validationResult.valid
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>
              {validationResult.valid
                ? "Dockerfile validation passed! Syntax is correct."
                : `Validation Error: ${validationResult.errors.join("; ")}`}
              {validationResult.warnings.length > 0 && ` (Warning: ${validationResult.warnings.join("; ")})`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setValidationResult(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Code Textarea & Gutter */}
      <div className="relative font-mono text-xs leading-relaxed flex min-h-[320px] max-h-[500px] overflow-auto bg-[#070a12]">
        {/* Line Numbers Gutter */}
        <div className="py-3 px-3 bg-[#0a0e1a] text-slate-600 select-none border-r border-slate-800/80 text-right font-mono min-w-[3.5rem]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Text Area */}
        {activeTab === "dockerfile" && !readOnly ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-slate-200 resize-none focus:outline-none font-mono whitespace-pre overflow-x-auto selection:bg-indigo-500/30"
            rows={lines.length + 2}
          />
        ) : (
          <pre className="flex-1 p-3 text-slate-300 font-mono whitespace-pre overflow-x-auto selection:bg-indigo-500/30">
            {activeTab === "dockerfile" ? value : activeTab === "dockerignore" ? dockerignore : dockerCompose}
          </pre>
        )}
      </div>

      <div className="bg-slate-900/60 px-4 py-2 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center">
        <span>
          {activeTab === "dockerfile"
            ? "Editable Dockerfile • Will be built on green deployment container"
            : "Preview mode"}
        </span>
        <span>{lines.length} lines</span>
      </div>
    </div>
  );
};
