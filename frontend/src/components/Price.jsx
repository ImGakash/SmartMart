import React from 'react';

/**
 * Price component
 * Rule 3: All money is BIGINT paise from the API.
 * Display only: divide by 100, Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).
 * Monospace for prices.
 */
export default function Price({ paise, className = '', showZero = true }) {
  if (paise === null || paise === undefined) {
    if (!showZero) return null;
    paise = 0;
  }

  const numPaise = typeof paise === 'bigint' ? Number(paise) : Number(paise);
  const inrValue = numPaise / 100;

  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: inrValue % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(inrValue);

  return (
    <span className={`font-mono tracking-tight font-semibold ${className}`}>
      {formatted}
    </span>
  );
}
