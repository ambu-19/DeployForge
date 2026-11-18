import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Check,
  Copy,
  Download,
  Filter,
  RefreshCw,
  Search,
  Terminal,
} from "lucide-react";

interface LogViewerProps {
  deploymentId?: number | null;
  staticLogs?: string;
  isStreaming?: boolean;
  title?: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  deploymentId,
  staticLogs = "",
  isStreaming = false,
  title = "Console Output",
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize or stream logs
  useEffect(() => {
    if (deploymentId && isStreaming) {
      setLogs([]);
      const token = localStorage.getItem("deployforge_token") || localStorage.getItem("t");
      const es = new EventSource(`/api/deployments/${deploymentId}/logs?token=${token}`);

      es.onmessage = (event) => {
        try {
          const line = JSON.parse(event.data);
          setLogs((prev) => [...prev, line]);
        } catch {
          setLogs((prev) => [...prev, event.data]);
        }
      };

      es.addEventListener("end", () => {
        es.close();
      });

      es.onerror = () => {
        es.close();
      };

      return () => {
        es.close();
      };
    } else if (staticLogs) {
      setLogs(staticLogs.split("\n"));
    }
  }, [deploymentId, isStreaming, staticLogs]);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((line) => {
    if (search && !line.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (levelFilter === "error") {
      return (
        line.toLowerCase().includes("error") ||
        line.toLowerCase().includes("fail") ||
        line.includes("✗") ||
        line.includes("ERR!")
      );
    }
    if (levelFilter === "warn") {
      return line.toLowerCase().includes("warn") || line.includes("(!)") || line.includes("WARN");
    }
    if (levelFilter === "info") {
      return (
        line.includes("▶") ||
        line.includes("✔") ||
        line.toLowerCase().includes("step") ||
        line.toLowerCase().includes("building")
      );
    }
    return true;
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${deploymentId || "logs"}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLineClass = (line: string) => {
    const l = line.toLowerCase();
    if (l.includes("error") || l.includes("fail") || line.includes("✗") || l.includes("err!")) {
      return "text-rose-400 bg-rose-500/10 px-1 rounded";
    }
    if (l.includes("warn") || line.includes("(!)") || l.includes("deprecated")) {
      return "text-amber-400 bg-amber-500/10 px-1 rounded";
    }
    if (line.includes("✔") || l.includes("success") || l.includes("passed")) {
      return "text-emerald-400 font-semibold";
    }
    if (line.includes("▶") || l.includes("step ")) {
      return "text-sky-300 font-medium";
    }
    return "text-slate-300";
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#070b13] overflow-hidden flex flex-col shadow-2xl">
      {/* Header Bar */}
      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-300">
          <Terminal className="w-4 h-4 text-indigo-400" />
          <span>{title}</span>
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live SSE Stream
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 w-36 lg:w-48"
            />
          </div>

          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e: any) => setLevelFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info / Progress</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>

          {/* Autoscroll Toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
              autoScroll
                ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
            title="Toggle autoscroll to bottom"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          {/* Copy */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Copy logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Download */}
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Download log file"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="p-4 font-mono text-xs leading-relaxed overflow-auto h-80 lg:h-96 whitespace-pre-wrap bg-[#05070c]">
        {filteredLogs.length === 0 ? (
          <div className="text-slate-600 italic py-8 text-center">
            {isStreaming ? "Waiting for deployment output..." : "No logs available for this session"}
          </div>
        ) : (
          filteredLogs.map((line, idx) => (
            <div key={idx} className={`py-0.5 font-mono ${getLineClass(line)}`}>
              {line}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="bg-slate-900/60 px-4 py-1.5 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between">
        <span>{filteredLogs.length} events logged</span>
        <span>UTF-8 • ANSI Stream</span>
      </div>
    </div>
  );
};
