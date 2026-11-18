import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { GithubIcon } from "../components/GithubIcon";
import { api } from "../api";
import { AuthStatus } from "../types";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    api
      .getAuthStatus()
      .then(setAuthStatus)
      .catch((e) => console.error("Could not fetch auth status:", e));
  }, []);

  const handleDemoLogin = async () => {
    setLoadingDemo(true);
    setErrorMsg("");
    try {
      await api.devLogin();
      onLoginSuccess();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to log in with Demo account");
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 z-10">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/25 text-3xl font-black text-white mb-2">
            ⚡
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 sm:text-4xl">
            Deploy<span className="text-indigo-400">Forge</span>
          </h1>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            The developer-first Mini PaaS platform. Connect code, auto-detect frameworks, generate production Dockerfiles, and go live instantly.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-7 shadow-2xl space-y-5">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-base font-semibold text-slate-200">Sign in to your dashboard</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select your preferred authentication method</p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* GitHub OAuth Warning if not configured */}
          {authStatus && !authStatus.github_configured && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>GitHub OAuth Not Configured</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Add <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">GITHUB_CLIENT_ID</code> and{" "}
                <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">GITHUB_CLIENT_SECRET</code> to your{" "}
                <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300">.env</code> file. For jury demonstration, use Demo Login below.
              </p>
            </div>
          )}

          {/* Primary Action 1: GitHub OAuth */}
          <div>
            <a
              href="/api/auth/login"
              className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow-md ${
                authStatus?.github_configured
                  ? "bg-slate-100 hover:bg-white text-slate-900 shadow-slate-100/10 hover:shadow-slate-100/20"
                  : "bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700"
              }`}
            >
              <GithubIcon className="w-5 h-5" />
              <span>Continue with GitHub</span>
            </a>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800" />
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Or Local Access
            </span>
            <div className="flex-grow border-t border-slate-800" />
          </div>

          {/* Primary Action 2: Demo Login */}
          <div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loadingDemo}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/35 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>{loadingDemo ? "Signing in..." : "Demo Login (Technical Jury & Exhibition)"}</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              One-click instant login for offline and local evaluation without cloud dependencies.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Intelligent Detection</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Vite+React Nginx SPA, Next.js, Node, FastAPI, Flask, Django, Spring Boot.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <Rocket className="w-3.5 h-3.5" />
              <span>Zero-Downtime</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Blue-Green deployments with Traefik atomic routing switch &amp; auto-rollback.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
