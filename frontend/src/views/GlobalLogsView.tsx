import React, { useEffect, useState } from "react";
import { Play, RefreshCw, Terminal } from "lucide-react";
import { api } from "../api";
import { LogViewer } from "../components/LogViewer";
import { Deployment, Project } from "../types";

interface GlobalLogsViewProps {
  projects: Project[];
}

export const GlobalLogsView: React.FC<GlobalLogsViewProps> = ({ projects }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [runtimeLogs, setRuntimeLogs] = useState("");
  const [logMode, setLogMode] = useState<"build" | "runtime">("build");

  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === null) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProjectId) {
      api.getDeployments(selectedProjectId).then((deps) => {
        setDeployments(deps);
        if (deps.length > 0) {
          setSelectedDeploymentId(deps[0].id);
        } else {
          setSelectedDeploymentId(null);
        }
      });

      api.getProjectStats(selectedProjectId).then((st) => {
        setRuntimeLogs(st.logs || "");
      });
    }
  }, [selectedProjectId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Unified Log Stream Console</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspect real-time build and runtime container logs without browser refresh.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId || ""}
            onChange={(e) => setSelectedProjectId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Switches */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLogMode("build")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              logMode === "build"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Build Stream
          </button>
          <button
            type="button"
            onClick={() => setLogMode("runtime")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              logMode === "runtime"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Runtime Container Output
          </button>
        </div>

        {logMode === "build" && (
          <select
            value={selectedDeploymentId || ""}
            onChange={(e) => setSelectedDeploymentId(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {deployments.map((d) => (
              <option key={d.id} value={d.id}>
                Release #{d.id} • {d.status} ({d.commit || "manual"})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Log Terminal */}
      {logMode === "build" ? (
        <LogViewer
          deploymentId={selectedDeploymentId}
          isStreaming={true}
          title={selectedDeploymentId ? `Release #${selectedDeploymentId} Output` : "Build Stream"}
        />
      ) : (
        <LogViewer
          staticLogs={runtimeLogs || "No runtime output emitted by container yet."}
          title="Container Standard Output & Standard Error"
        />
      )}
    </div>
  );
};
