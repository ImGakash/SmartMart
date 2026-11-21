import React from 'react';
import { Database, Radio, Search, ShieldCheck, Activity } from 'lucide-react';

const SERVICE_CONFIG = {
  PostgreSQL: {
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/40',
    text: 'text-indigo-400',
    icon: Database,
  },
  Kafka: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    icon: Radio,
  },
  OpenSearch: {
    bg: 'bg-cyan/15',
    border: 'border-cyan/40',
    text: 'text-cyan',
    icon: Search,
  },
  System: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    icon: ShieldCheck,
  },
};

/**
 * ProofPanel: Sticky right-rail proof container.
 * Every panel answers: What action, what proof, which Aiven service.
 */
export default function ProofPanel({
  title,
  service = 'PostgreSQL',
  action,
  proof,
  children,
  className = '',
  sticky = true,
}) {
  const serviceInfo = SERVICE_CONFIG[service] || SERVICE_CONFIG.System;
  const ServiceIcon = serviceInfo.icon;

  return (
    <aside
      className={`bg-ink-800/80 border border-line rounded-3xl p-5 lg:p-6 shadow-2xl backdrop-blur-md flex flex-col gap-4 text-slate-100 ${
        sticky ? 'sticky top-24' : ''
      } ${className}`}
      aria-label={`${title} Proof Panel`}
    >
      {/* Proof Panel Header */}
      <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black uppercase tracking-wider border ${serviceInfo.bg} ${serviceInfo.border} ${serviceInfo.text}`}
            >
              <ServiceIcon className="w-3.5 h-3.5" />
              <span>{service}</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
              LIVE EVIDENCE
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
            {title}
          </h3>
        </div>
      </div>

      {/* Action / Proof Metadata Pill */}
      {(action || proof) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-xl bg-ink-950 border border-slate-800 text-[11px] font-mono">
          {action && (
            <div className="flex flex-col">
              <span className="text-slate-400 uppercase text-[9px] font-bold">Action Taken</span>
              <span className="text-slate-200 font-semibold truncate">{action}</span>
            </div>
          )}
          {proof && (
            <div className="flex flex-col">
              <span className="text-slate-400 uppercase text-[9px] font-bold">Verified Proof</span>
              <span className="text-emerald-400 font-semibold truncate">{proof}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Evidence Content */}
      <div className="flex flex-col gap-4 text-sm">{children}</div>
    </aside>
  );
}
