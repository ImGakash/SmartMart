import React from 'react';
import { CheckCircle2, XCircle, ShieldCheck, AlertOctagon } from 'lucide-react';

/**
 * ConsistencyTable component
 * Renders the 10 invariant checks from verify_consistency.sql / GET /xray/metrics.
 * Clean, professional SaaS table with soft status badges.
 */
export default function ConsistencyTable({ checks = [] }) {
  const total = checks.length || 10;
  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const allPass = passCount === total && total > 0;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 flex flex-col gap-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              allPass
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-rose-50 text-rose-600 border border-rose-100'
            }`}
          >
            {allPass ? <ShieldCheck className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#111827]">
              PostgreSQL Mathematical Invariants
            </h2>
            <p className="text-xs text-[#6B7280]">
              Transactional integrity checks executed live against inventory & ledger tables
            </p>
          </div>
        </div>

        {/* Status Score */}
        <div
          className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border flex items-center gap-2 ${
            allPass
              ? 'bg-[#ECFDF5] border-emerald-200 text-[#047857]'
              : 'bg-[#FEF2F2] border-red-200 text-[#B91C1C]'
          }`}
        >
          <span>{passCount}/{total} PASSING</span>
        </div>
      </div>

      {/* Checklist Rows */}
      <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg overflow-hidden">
        {checks.map((check, idx) => {
          const isPass = check.status === 'PASS';
          return (
            <div
              key={check.name || idx}
              className="p-3 flex items-start justify-between gap-3 text-xs hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-2.5">
                {isPass ? (
                  <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-semibold text-slate-900 block font-mono text-[13px]">
                    {check.name}
                  </span>
                  <span className="text-[12px] text-[#6B7280] leading-relaxed">
                    {check.detail || check.description || 'Verified via conditional database constraint'}
                  </span>
                </div>
              </div>

              <span
                className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                  isPass
                    ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-red-200'
                }`}
              >
                {check.status || 'PASS'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
