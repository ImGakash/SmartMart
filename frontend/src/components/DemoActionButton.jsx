import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANT_MAP = {
  primary:
    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 border border-indigo-400/40',
  success:
    'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 border border-emerald-300/40 font-black',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30 border border-rose-400/40',
  warning:
    'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30 border border-amber-300/40 font-black',
  terminal:
    'bg-neutral-900 hover:bg-neutral-800 text-amber-400 border border-amber-500/40 shadow-amber-500/10 font-mono',
};

/**
 * DemoActionButton: Large, obvious judge-facing button with loading state.
 * Disabled while running to prevent double triggers.
 */
export default function DemoActionButton({
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  icon: Icon,
  children,
  className = '',
  size = 'md',
}) {
  const variantClasses = VARIANT_MAP[variant] || VARIANT_MAP.primary;
  const sizeClasses =
    size === 'lg'
      ? 'py-4 px-6 text-base'
      : size === 'sm'
      ? 'py-2 px-3 text-xs'
      : 'py-3 px-5 text-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`rounded-xl font-bold transition-all duration-200 active:scale-[0.98] shadow-lg flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantClasses} ${sizeClasses} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
