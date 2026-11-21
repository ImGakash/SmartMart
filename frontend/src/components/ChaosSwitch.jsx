import React from 'react';
import { AlertTriangle, Power } from 'lucide-react';

/**
 * ChaosSwitch component
 * Labeled toggle for admin chaos targets in clean SaaS style.
 * Active faults highlighted with soft red state.
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
      className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
        enabled
          ? 'bg-rose-50 border-rose-200 text-rose-950 shadow-2xs'
          : 'bg-white border-[#E5E7EB] text-slate-800 hover:border-slate-300 shadow-2xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {target}
            </span>
            {enabled && (
              <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-mono text-[10px] font-bold uppercase">
                FAULT ACTIVE
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-900">
            {label}
          </h4>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => onToggle && onToggle(target, !enabled)}
          disabled={disabled}
          className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none p-0.5 cursor-pointer shrink-0 ${
            enabled ? 'bg-rose-600' : 'bg-slate-300 hover:bg-slate-400'
          }`}
          title={`Toggle ${target}`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
