import React from "react";
import {
  Activity,
  Cpu,
  FileCode,
  Globe,
  History,
  Key,
  Layers,
  LayoutDashboard,
  LogOut,
  Rocket,
  Settings,
  Terminal,
} from "lucide-react";
import { GithubIcon } from "./GithubIcon";
import { User } from "../types";

export type NavTab =
  | "overview"
  | "projects"
  | "deployments"
  | "repos"
  | "generator"
  | "history"
  | "logs"
  | "env"
  | "domains"
  | "monitoring"
  | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User | null;
  onLogout: () => void;
  projectCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  user,
  onLogout,
  projectCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "projects", label: "Projects", icon: <Layers className="w-4 h-4" />, badge: projectCount },
    { id: "deployments", label: "Deployments", icon: <Rocket className="w-4 h-4" /> },
    { id: "repos", label: "GitHub Repositories", icon: <GithubIcon className="w-4 h-4" /> },
    { id: "generator", label: "Dockerfile Generator", icon: <FileCode className="w-4 h-4" /> },
    { id: "history", label: "Build History", icon: <History className="w-4 h-4" /> },
    { id: "logs", label: "Logs", icon: <Terminal className="w-4 h-4" /> },
    { id: "env", label: "Environment Variables", icon: <Key className="w-4 h-4" /> },
    { id: "domains", label: "Domains", icon: <Globe className="w-4 h-4" /> },
    { id: "monitoring", label: "Monitoring", icon: <Activity className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0d131f] flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-lg">
            ⚡
          </div>
          <div>
            <div className="font-bold text-slate-100 text-base tracking-tight flex items-center gap-1.5">
              DeployForge
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                PaaS
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium">Developer Platform</div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? "text-indigo-400" : "text-slate-400"}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive ? "bg-indigo-500/30 text-indigo-300" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <div className="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
              {user?.login ? user.login[0].toUpperCase() : "U"}
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-slate-200 truncate">{user?.login || "User"}</div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {user?.github ? "GitHub Connected" : "Local Demo"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
