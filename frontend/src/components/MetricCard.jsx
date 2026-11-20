import React from 'react';

const TONE_MAP = {
  default: 'text-white border-slate-800 bg-slate-900',
  success: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40 shadow-emerald-950/20',
  danger: 'text-rose-400 border-rose-500/40 bg-rose-950/40 shadow-rose-950/20',
  warning: 'text-amber-400 border-amber-500/40 bg-amber-950/40 shadow-amber-950/20',
  info: 'text-sky-400 border-sky-500/40 bg-sky-950/40 shadow-sky-950/20',
  purple: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/40 shadow-indigo-950/20',
};

/**
 * MetricCard: Huge monospace number for 5-meter projector visibility.
 */
export default function MetricCard({
  title,
  value,
  tone = 'default',
  sublabel,
  icon: Icon,
  className = '',
}) {
  const toneClasses = TONE_MAP[tone] || TONE_MAP.default;

  return (
    <div
      className={`border rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-xl backdrop-blur-sm transition-all duration-200 ${toneClasses} ${className}`}
    >
      <div className="flex items-center justify-between text-slate-400">
        <span className="text-[11px] font-mono uppercase font-bold tracking-wider">
          {title}
        </span>
        {Icon && <Icon className="w-4 h-4 opacity-75" />}
      </div>

      <div className="text-3xl sm:text-4xl font-mono font-black tracking-tight leading-none my-1">
        {value}
      </div>

      {sublabel && (
        <div className="text-xs text-slate-400 font-medium tracking-wide">
          {sublabel}
        </div>
      )}
    </div>
  );
}
