import React from 'react';

const TONE_VALUE_MAP = {
  default: 'text-[#111827]',
  success: 'text-[#047857]',
  danger: 'text-[#B91C1C]',
  warning: 'text-[#B45309]',
  info: 'text-[#1D4ED8]',
  purple: 'text-[#4F46E5]',
};

/**
 * MetricCard: Clean, professional metric card with controlled 24px font size.
 * Matches Stripe / Linear SaaS dashboard conventions.
 */
export default function MetricCard({
  title,
  value,
  tone = 'default',
  sublabel,
  icon: Icon,
  className = '',
}) {
  const valueColor = TONE_VALUE_MAP[tone] || TONE_VALUE_MAP.default;

  return (
    <div
      className={`bg-white border border-[#E5E7EB] rounded-lg p-4 flex flex-col justify-between gap-1 shadow-2xs transition-colors ${className}`}
    >
      <div className="flex items-center justify-between text-[#6B7280]">
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {title}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      </div>

      <div className={`text-2xl font-semibold font-mono tracking-tight my-0.5 ${valueColor}`}>
        {value}
      </div>

      {sublabel && (
        <div className="text-xs text-[#6B7280] font-medium truncate">
          {sublabel}
        </div>
      )}
    </div>
  );
}
