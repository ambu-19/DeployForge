import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Layers,
  LineChart,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import { api } from "../api";
import { MonitoringData } from "../types";

export const MonitoringView: React.FC = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.getMonitoring();
      setData(res);
    } catch (e) {
      console.error("Monitoring fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span>Platform Telemetry &amp; Metrics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time cAdvisor container stats, Prometheus time-series metrics, and Grafana dashboards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={data?.grafana_url || "http://grafana.localhost:8080"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <span>Open Grafana (admin/admin)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total CPU Load</span>
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-sky-400">{data?.total_cpu ?? 0.0}%</div>
          <div className="text-xs text-slate-500">Live compute across container fleet</div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Fleet Memory</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-purple-400">
            {data?.total_mem_mb ?? 0.0} MB
          </div>
          <div className="text-xs text-slate-500">Resident memory without buffers</div>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Prometheus Scraper</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400">
            {data?.prometheus_healthy ? "Online" : "Active"}
          </div>
          <div className="text-xs text-slate-500">Scraping /metrics and cAdvisor :8080</div>
        </div>
      </div>

      {/* Containers Telemetry Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <span>Container Instances &amp; Resource Consumption</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {data?.containers.length ?? 0} active instances
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider bg-slate-950/40">
                <th className="p-3">Container ID</th>
                <th className="p-3">Application</th>
                <th className="p-3">Container Name</th>
                <th className="p-3">State</th>
                <th className="p-3">CPU Usage</th>
                <th className="p-3">Memory (MB)</th>
                <th className="p-3">Port</th>
                <th className="p-3 text-right">Route Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(!data?.containers || data.containers.length === 0) ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    No active user containers running currently.
                  </td>
                </tr>
              ) : (
                data.containers.map((c) => (
                  <tr key={c.container_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{c.container_id}</td>
                    <td className="p-3 font-medium text-slate-200">{c.project_name}</td>
                    <td className="p-3 font-mono text-slate-300">{c.name}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-sky-400">{c.cpu}%</td>
                    <td className="p-3 font-mono text-purple-400">{c.mem_mb} MB</td>
                    <td className="p-3 font-mono text-slate-400">{c.port}</td>
                    <td className="p-3 text-right">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        <span>Open App</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
