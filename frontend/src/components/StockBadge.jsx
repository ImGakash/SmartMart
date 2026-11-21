import React from 'react';

/**
 * StockBadge component
 * Green/Amber/Red by quantity; "Out of Stock" at 0.
 * Monospace for numbers per global requirements.
 */
export default function StockBadge({ quantity = 0, storeCode, className = '' }) {
  const qty = Number(quantity);

  if (qty <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        Out of Stock
      </span>
    );
  }

  if (qty <= 3) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-tight bg-amber-500/15 text-amber-400 border border-amber-500/30 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Only {qty} left
        {storeCode && <span className="opacity-75 text-[10px]">({storeCode})</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold tracking-tight bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {qty} in stock
      {storeCode && <span className="opacity-75 text-[10px]">({storeCode})</span>}
    </span>
  );
}
