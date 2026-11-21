import React from 'react';
import { CheckCircle2, RefreshCw, XCircle, HelpCircle } from 'lucide-react';

const SYNC_MAP = {
  PASS: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-emerald-200/80',
    text: 'text-[#047857]',
    icon: CheckCircle2,
    spin: false,
  },
  SYNCING: {
    bg: 'bg-[#FFFBEB]',
    border: 'border-amber-200/80',
    text: 'text-[#B45309]',
    icon: RefreshCw,
    spin: true,
  },
  FAIL: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-red-200/80',
    text: 'text-[#B91C1C]',
    icon: XCircle,
    spin: false,
  },
  MISSING: {
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    text: 'text-slate-600',
    icon: HelpCircle,
    spin: false,
  },
};

/**
 * SyncBadge: Renders reconciliation status (PASS | SYNCING | FAIL | MISSING).
 * Uses soft SaaS pill styling with icons.
 */
export default function SyncBadge({ status = 'PASS', className = '' }) {
  const norm = String(status).toUpperCase();
  const conf = SYNC_MAP[norm] || SYNC_MAP.MISSING;
  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase border shadow-2xs ${conf.bg} ${conf.border} ${conf.text} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${conf.spin ? 'animate-spin' : ''}`} />
      <span>{norm}</span>
    </span>
  );
}
