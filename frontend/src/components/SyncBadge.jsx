import React from 'react';
import { CheckCircle2, RefreshCw, XCircle, HelpCircle } from 'lucide-react';

const SYNC_MAP = {
  PASS: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    icon: CheckCircle2,
    spin: false,
  },
  SYNCING: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-300',
    icon: RefreshCw,
    spin: true,
  },
  FAIL: {
    bg: 'bg-rose-500/25',
    border: 'border-rose-500/60',
    text: 'text-rose-400',
    icon: XCircle,
    spin: false,
  },
  MISSING: {
    bg: 'bg-slate-800',
    border: 'border-slate-700',
    text: 'text-slate-400',
    icon: HelpCircle,
    spin: false,
  },
};

/**
 * SyncBadge: Renders reconciliation status (PASS | SYNCING | FAIL | MISSING).
 * Used in ProductDetail, POS proof, and Control Tower reconciliation table.
 */
export default function SyncBadge({ status = 'PASS', className = '' }) {
  const norm = String(status).toUpperCase();
  const conf = SYNC_MAP[norm] || SYNC_MAP.MISSING;
  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-black tracking-wider uppercase border shadow-sm ${conf.bg} ${conf.border} ${conf.text} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${conf.spin ? 'animate-spin' : ''}`} />
      <span>{norm}</span>
    </span>
  );
}
