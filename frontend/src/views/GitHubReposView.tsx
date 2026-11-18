import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Star,
  Unlock,
} from "lucide-react";
import { GithubIcon } from "../components/GithubIcon";
import { api } from "../api";
import { GitHubRepo, User } from "../types";

interface GitHubReposViewProps {
  user: User | null;
  onDeployRepo: (repo: string) => void;
}

export const GitHubReposView: React.FC<GitHubReposViewProps> = ({
  user,
  onDeployRepo,
}) => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [customRepo, setCustomRepo] = useState("");

  const loadRepos = async () => {
    setLoading(true);
    try {
      const data = await api.getGitHubRepos();
      setRepos(data);
    } catch (e) {
      console.error("Error loading GitHub repositories:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
  }, [user]);

  const filtered = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <GithubIcon className="w-5 h-5 text-indigo-400" />
            <span>GitHub Repositories</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select any GitHub repository to trigger automatic framework detection and launch a deployment.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-48 sm:w-64"
            />
          </div>

          <button
            onClick={loadRepos}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
            title="Refresh repository list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Manual / Public Repository Deployer Card */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3 shadow-md">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Deploy Any Public or Organization Repository
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. ambu-19/akshara-dasoha-tracker or facebook/react"
            value={customRepo}
            onChange={(e) => setCustomRepo(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <button
            type="button"
            onClick={() => customRepo && onDeployRepo(customRepo.trim())}
            disabled={!customRepo.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 transition-all cursor-pointer"
          >
            <Rocket className="w-4 h-4" />
            <span>Launch Service</span>
          </button>
        </div>
      </div>

      {/* Repositories List */}
      {!user?.github ? (
        <div className="p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
            <GithubIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Local Demo User Active</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            You are logged in via the local demo account. You can deploy any public GitHub repository directly above (such as{" "}
            <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded font-mono">ambu-19/akshara-dasoha-tracker</code> or{" "}
            <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded font-mono">ambu-19/hello-node</code>).
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
          No repositories found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div
              key={r.full_name}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90 transition-all space-y-3 flex flex-col justify-between shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm hover:text-indigo-400 transition-colors">
                      {r.name}
                    </h3>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.full_name}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.private ? (
                      <span className="p-1 rounded bg-slate-800 text-slate-400" title="Private">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-slate-800 text-slate-400" title="Public">
                        <Unlock className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {r.stars > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{r.stars}</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {r.description || "No repository description provided."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="font-mono text-[11px]">{r.default_branch}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onDeployRepo(r.full_name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Deploy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
