import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const STATUS_MAP = {
  pass: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    icon: CheckCircle2,
  },
  fail: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    text: 'text-rose-400',
    icon: XCircle,
  },
  warn: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/40',
    text: 'text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    text: 'text-sky-400',
    icon: Info,
  },
};

/**
 * ProofBadge: High-contrast pill with icon for pass/fail/warn/info verification states.
 */
export default function ProofBadge({
  status = 'pass',
  label,
  className = '',
  size = 'md',
}) {
  const norm = String(status).toLowerCase();
  const conf = STATUS_MAP[norm] || STATUS_MAP.info;
  const Icon = conf.icon;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-xs font-black'
      : 'px-2.5 py-1 text-xs font-bold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-mono uppercase tracking-wider border shadow-sm ${conf.bg} ${conf.border} ${conf.text} ${sizeClasses} ${className}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label || status.toUpperCase()}</span>
    </span>
  );
}
