import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Maps contract codes to human-friendly text.
 * Rule 5:
 *   INSUFFICIENT_STOCK -> "Only {available} left — you asked for {requested}"
 *   CART_EMPTY -> "Your cart is empty"
 *   *_NOT_FOUND -> "Not found"
 *   Anything else -> message from API. Never hide errors.
 */
export function formatToastMessage(toast) {
  const { code, message, details = {} } = toast;

  if (code === 'INSUFFICIENT_STOCK') {
    const avail = details.available ?? 0;
    const req = details.requested ?? 'more';
    return `Only ${avail} left — you asked for ${req}`;
  }

  if (code === 'CART_EMPTY') {
    return 'Your cart is empty';
  }

  if (code && code.endsWith('_NOT_FOUND')) {
    return 'Not found';
  }

  if (message) {
    return message;
  }

  return code || 'An unexpected error occurred';
}

export default function ToastContainer({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error' || toast.code;
        const isSuccess = toast.type === 'success';
        const formattedMsg = formatToastMessage(toast);

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              isError
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-100 shadow-rose-950/50'
                : isSuccess
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100 shadow-emerald-950/50'
                : 'bg-slate-900/90 border-slate-700 text-slate-100 shadow-black/60'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isError && <AlertTriangle className="w-5 h-5 text-rose-400" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {!isError && !isSuccess && <Info className="w-5 h-5 text-sky-400" />}
            </div>

            <div className="flex-1 text-sm font-medium leading-snug break-words">
              {toast.code && (
                <div className="font-mono text-xs opacity-75 uppercase tracking-wider mb-1">
                  [{toast.code}]
                </div>
              )}
              <div>{formattedMsg}</div>
            </div>

            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
