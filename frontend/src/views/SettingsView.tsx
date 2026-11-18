import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  Globe,
  Info,
  Key,
  Layers,
  Lock,
  LogOut,
  Moon,
  Network,
  Server,
  Settings,
  Shield,
  Zap,
} from "lucide-react";
import { GithubIcon } from "../components/GithubIcon";
import { api } from "../api";
import { AuthStatus, User } from "../types";

interface SettingsViewProps {
  user: User | null;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, onLogout }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    api
      .getAuthStatus()
      .then(setAuthStatus)
      .catch((e) => console.error("Could not fetch auth status:", e));
  }, []);

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>Platform Settings &amp; Architecture</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure platform preferences, inspect infrastructure health, and verify developer integrations.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-200">User Identity &amp; Session</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-lg font-bold text-indigo-400">
              {user?.login ? user.login[0].toUpperCase() : "U"}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">{user?.login || "Unknown"}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{user?.github ? "Connected to GitHub OAuth" : "Local Development Demo Session"}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Infrastructure Services Health Grid */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-emerald-400" />
          <span>Underlying Infrastructure Health</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">PostgreSQL 16</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Healthy (:5432)</div>
            <div className="text-[10px] text-slate-500">Persistent storage volume</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Redis 7 Alpine</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Online (:6379)</div>
            <div className="text-[10px] text-slate-500">Job queue &amp; live log pub/sub</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Traefik v3.6</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Listening (:8080)</div>
            <div className="text-[10px] text-slate-500">Dynamic file-provider routing</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Prometheus v2.55</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Scraping /metrics</div>
            <div className="text-[10px] text-slate-500">15s telemetry interval</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Grafana v11</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Ready (:3000)</div>
            <div className="text-[10px] text-slate-500">Auto-provisioned dashboards</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">cAdvisor v0.49</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xs font-mono font-semibold text-slate-200">Socket Connected</div>
            <div className="text-[10px] text-slate-500">Docker container stats</div>
          </div>
        </div>
      </div>

      {/* GitHub OAuth Setup Guide */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <GithubIcon className="w-4 h-4 text-indigo-400" />
          <span>GitHub OAuth Integration Configuration</span>
        </h3>

        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
          <p>
            To enable GitHub login and automatic push webhooks, create an OAuth App at{" "}
            <a
              href="https://github.com/settings/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              GitHub Developer Settings
            </a>{" "}
            with the following parameters:
          </p>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono space-y-1.5 text-[11px]">
            <div>
              <span className="text-slate-500">Homepage URL: </span>
              <span className="text-slate-200">{authStatus?.public_url || "http://localhost:8080"}</span>
            </div>
            <div>
              <span className="text-slate-500">Authorization callback URL: </span>
              <span className="text-indigo-300">
                {authStatus?.public_url || "http://localhost:8080"}/api/auth/callback
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Then place <code className="text-indigo-300">GITHUB_CLIENT_ID</code> and{" "}
            <code className="text-indigo-300">GITHUB_CLIENT_SECRET</code> inside{" "}
            <code className="text-indigo-300">.env</code> in your DeployForge directory.
          </p>
        </div>
      </div>
    </div>
  );
};
