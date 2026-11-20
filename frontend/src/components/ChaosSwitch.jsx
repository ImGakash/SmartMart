import React from 'react';
import { AlertTriangle, Power } from 'lucide-react';

/**
 * ChaosSwitch component
 * Labeled toggle for admin chaos targets.
 * Active faults glow red.
 * Target names: relay, relay-after-publish, notifications, search-indexer.
 */
export default function ChaosSwitch({
  target,
  label,
  description,
  enabled = false,
  onToggle,
  disabled = false,
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between gap-3 ${
        enabled
          ? 'bg-rose-950/70 border-rose-500 text-rose-100 shadow-lg shadow-rose-950/60 ring-1 ring-rose-500'
          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase tracking-wider">
              {target}
            </span>
            {enabled && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-mono text-[9px] font-extrabold uppercase animate-pulse">
                FAULT ACTIVE
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-white">
            {label}
          </h4>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => onToggle && onToggle(target, !enabled)}
          disabled={disabled}
          className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none p-0.5 ${
            enabled ? 'bg-rose-600' : 'bg-slate-800'
          }`}
          title={`Toggle ${target}`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-md ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed font-sans">
        {description}
      </p>
    </div>
  );
}
