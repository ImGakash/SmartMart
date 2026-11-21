import React from 'react';
import ProofBadge from './ProofBadge.jsx';

/**
 * ProofTable: Generic high-contrast table for invariants and proof metrics.
 */
export default function ProofTable({
  columns = [],
  data = [],
  emptyMessage = 'No proof records available.',
  className = '',
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 ${className}`}>
      <table className="w-full text-left border-collapse font-mono text-xs">
        <thead>
          <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-900/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2.5 px-3 font-black ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-slate-500 italic font-sans"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-slate-900/50 transition-colors">
                {columns.map((col) => {
                  const val = row[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`py-2.5 px-3 text-slate-200 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(val, row, idx) : val}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
