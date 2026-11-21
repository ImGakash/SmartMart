import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const STATUS_MAP = {
  pass: {
    bg: 'bg-[#ECFDF5]',
    border: 'border-emerald-200/80',
    text: 'text-[#047857]',
    icon: CheckCircle2,
  },
  fail: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-red-200/80',
    text: 'text-[#B91C1C]',
    icon: XCircle,
  },
  warn: {
    bg: 'bg-[#FFFBEB]',
    border: 'border-amber-200/80',
    text: 'text-[#B45309]',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-[#EFF6FF]',
    border: 'border-blue-200/80',
    text: 'text-[#1D4ED8]',
    icon: Info,
  },
};

/**
 * ProofBadge: Soft professional pill with icon for pass/fail/warn/info verification states.
 * Follows Stripe/Linear SaaS design conventions.
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
      ? 'px-2 py-0.5 text-[11px]'
      : size === 'lg'
      ? 'px-3 py-1 text-xs font-semibold'
      : 'px-2.5 py-0.5 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border shadow-2xs ${conf.bg} ${conf.border} ${conf.text} ${sizeClasses} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label || norm.toUpperCase()}</span>
    </span>
  );
}
