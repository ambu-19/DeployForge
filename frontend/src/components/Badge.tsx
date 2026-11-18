import React from "react";

interface BadgeProps {
  status: string;
  size?: "sm" | "md";
}

const BADGE_CONFIG: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  live: { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  running: { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  building: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400", pulse: true },
  deploying: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-400", dot: "bg-sky-400", pulse: true },
  cloning: { bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-400", dot: "bg-indigo-400", pulse: true },
  detecting: { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400", dot: "bg-purple-400", pulse: true },
  queued: { bg: "bg-slate-500/15 border-slate-500/30", text: "text-slate-400", dot: "bg-slate-400" },
  failed: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
  superseded: { bg: "bg-slate-800 border-slate-700", text: "text-slate-400", dot: "bg-slate-500" },
  stopped: { bg: "bg-slate-800 border-slate-700", text: "text-slate-400", dot: "bg-slate-500" },
};

export const Badge: React.FC<BadgeProps> = ({ status, size = "md" }) => {
  const norm = (status || "queued").toLowerCase();
  const cfg = BADGE_CONFIG[norm] || BADGE_CONFIG.queued;
  const isSm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-medium rounded-full uppercase tracking-wider ${
        isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      } ${cfg.bg} ${cfg.text}`}
    >
      <span className={`rounded-full ${isSm ? "w-1.5 h-1.5" : "w-2 h-2"} ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
      {norm}
    </span>
  );
};
