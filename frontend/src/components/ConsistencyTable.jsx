import React from 'react';
import { CheckCircle2, XCircle, ShieldCheck, AlertOctagon } from 'lucide-react';

/**
 * ConsistencyTable component
 * Renders the 10 invariant checks from verify_consistency.sql / GET /xray/metrics.
 * Shows X/10 PASS header. Most prominent panel on the X-Ray page.
 */
export default function ConsistencyTable({ checks = [] }) {
  const total = checks.length || 10;
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const allPass = passCount === total && total > 0;

  return (
    <div className="bg-slate-900 border-2 border-slate-800 rounded-2xl p-6 lg:p-7 flex flex-col gap-6 shadow-2xl">
      {/* Prominent Mathematical Proof Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl border ${
              allPass
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-lg shadow-rose-500/20'
            }`}
          >
            {allPass ? <ShieldCheck className="w-7 h-7" /> : <AlertOctagon className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl lg:text-2xl font-mono font-black text-white tracking-tight uppercase">
                PostgreSQL Mathematical Invariants
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Transactional integrity checks executed live against inventory & ledger tables
            </p>
          </div>
        </div>

        {/* Big Monospace Score */}
        <div
          className={`px-5 py-2.5 rounded-xl border flex items-center gap-3 ${
            allPass
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/60 text-rose-300'
          }`}
        >
          <span className="font-mono text-2xl lg:text-3xl font-black">
            {passCount}/{total} PASS
          </span>
          {allPass ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : (
            <XCircle className="w-6 h-6 text-rose-400 animate-pulse" />
          )}
        </div>
      </div>

      {/* 10 Checks Rows */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Invariant Rule Name</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Verification Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
            {checks.map((check, index) => {
              const isPass = check.status === 'PASS';

              return (
                <tr
                  key={check.name || index}
                  className={`transition-colors hover:bg-slate-800/40 ${
                    !isPass ? 'bg-rose-950/30' : ''
                  }`}
                >
                  <td className="py-3 px-3 text-slate-500 font-bold">
                    {index + 1}
                  </td>
                  <td className="py-3 px-3 font-bold text-white tracking-tight">
                    {check.name}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider ${
                        isPass
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-900/50'
                      }`}
                    >
                      {isPass ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {check.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-sans text-xs">
                    {check.detail || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
