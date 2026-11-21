import React, { useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '../api/client.js';
import { useApp } from '../state/AppContext.jsx';
import MetricCard from '../components/MetricCard.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Database,
  Lock,
  ArrowRight
} from 'lucide-react';

const FIXED_PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const FIXED_STORE_ID = '20000000-0000-4000-8000-000000000001';
const BUYERS_COUNT = 50;

export default function RaceArena() {
  const { showToast } = useApp();

  const [mode, setMode] = useState('safe'); // 'safe' | 'naive'
  const [isRunning, setIsRunning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Active Race Results
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);

  // Staged results reveal
  const [visibleResults, setVisibleResults] = useState([]);

  // Fetch current live stock for fixed demo product
  const [currentLiveStock, setCurrentLiveStock] = useState(1);
  const [xrayConsistency, setXrayConsistency] = useState(null);
  const [pendingOutbox, setPendingOutbox] = useState(0);

  const fetchLiveStock = useCallback(async () => {
    setIsLoadingStock(true);
    try {
      const [prod, xray] = await Promise.all([
        apiGet(`/products/${FIXED_PRODUCT_ID}`),
        apiGet('/xray/metrics').catch(() => null),
      ]);

      const blrStock = prod?.availability?.find((a) => a.storeId === FIXED_STORE_ID)?.stockQty ?? 0;
      setCurrentLiveStock(blrStock);

      if (xray) {
        setXrayConsistency(xray.consistency || []);
        setPendingOutbox(xray.outbox?.pending ?? 0);
      }
    } catch (e) {
      console.warn('Failed to fetch live stock:', e.message);
    } finally {
      setIsLoadingStock(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStock();
  }, [fetchLiveStock]);

  // RESET DEMO: POST /demo/reset
  async function handleResetDemo() {
    setIsResetting(true);
    try {
      const res = await apiPost('/demo/reset');
      const ms = res?.durationMs ?? 34;

      showToast({
        type: 'success',
        message: `Database demo state restored in ${ms}ms. P01 stock reset to 1.`,
      });

      setResults([]);
      setVisibleResults([]);
      setSummary(null);
      await fetchLiveStock();
    } catch (err) {
      showToast({
        type: 'error',
        code: 'RESET_FAILED',
        message: err.message,
      });
    } finally {
      setIsResetting(false);
    }
  }

  // TRIGGER RACE: POST /demo/race
  async function handleRunRace() {
    setIsRunning(true);
    setResults([]);
    setVisibleResults([]);
    setSummary(null);

    try {
      const res = await apiPost('/demo/race', {
        mode,
        productId: FIXED_PRODUCT_ID,
        storeId: FIXED_STORE_ID,
        buyers: BUYERS_COUNT,
      });

      const raceResults = res.results || [];
      const raceSummary = res.summary || {};

      setResults(raceResults);
      setSummary(raceSummary);

      // Rapid staged reveal for clear visual verification
      let idx = 0;
      const interval = setInterval(() => {
        idx += 5;
        if (idx >= raceResults.length) {
          setVisibleResults(raceResults);
          clearInterval(interval);
          setIsRunning(false);
          fetchLiveStock();
        } else {
          setVisibleResults(raceResults.slice(0, idx));
        }
      }, 40);
    } catch (err) {
      setIsRunning(false);
      showToast({
        type: 'error',
        code: 'RACE_ERROR',
        message: err.message,
      });
    }
  }

  const successCount = summary?.success ?? visibleResults.filter((r) => r.status === 201).length;
  const failedCount = summary?.failed ?? visibleResults.filter((r) => r.status === 409).length;
  const isPass = mode === 'safe' && successCount === 1 && failedCount === 49;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">
          Concurrency Test · Flash Sale Arena
        </h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          50 simultaneous checkouts competing for 1 remaining stock unit under single-statement ACID isolation.
        </p>
      </div>

      {/* Pre-flight Baseline Verification Strip */}
      {currentLiveStock !== 1 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Pre-flight Notice: P01 stock at BLR-01 is currently <strong>{currentLiveStock}</strong> (expected: 1). Reset demo state before testing.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isResetting}
            className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs cursor-pointer transition-colors shrink-0"
          >
            {isResetting ? 'Resetting...' : 'Reset Demo Stock'}
          </button>
        </div>
      )}

      {/* Configuration & Controls Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Test Parameters */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="p-2.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">TARGET PRODUCT</span>
            <span className="font-semibold text-slate-900">boAt Airdopes 141 (P01)</span>
          </div>

          <div className="p-2.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">STORE HUB</span>
            <span className="font-semibold text-slate-900">BLR-01 Indiranagar</span>
          </div>

          <div className="p-2.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg font-mono">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">CONCURRENT BUYERS</span>
            <span className="font-bold text-slate-900">50 requests</span>
          </div>

          <div className="p-2.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg font-mono">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">CURRENT STOCK</span>
            <span className="font-bold text-slate-900">{currentLiveStock} unit</span>
          </div>
        </div>

        {/* Mode Segmented Switch & Run Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center p-1 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setMode('safe')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                mode === 'safe'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Safe (Atomic)
            </button>
            <button
              type="button"
              onClick={() => setMode('naive')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                mode === 'naive'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Naive (Oversell)
            </button>
          </div>

          <button
            type="button"
            onClick={handleRunRace}
            disabled={isRunning}
            className="h-[38px] px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs shadow-indigo-100 disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Running 50 Checkouts...' : 'Run Test'}</span>
          </button>
        </div>
      </div>

      {/* Live Metric Readouts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          title="Winners (201 Created)"
          value={successCount}
          tone={successCount === 1 ? 'success' : successCount > 1 ? 'danger' : 'default'}
          sublabel={mode === 'safe' ? 'Target: Exactly 1' : 'Oversell expected'}
        />

        <MetricCard
          title="Rejected (409 Stock Out)"
          value={failedCount}
          tone={failedCount === 49 ? 'success' : 'default'}
          sublabel="Safe 409 rejection"
        />

        <MetricCard
          title="Baseline Stock"
          value={summary?.baselineQty ?? 1}
          tone="default"
          sublabel="Units at T0"
        />

        <MetricCard
          title="Final PG Stock"
          value={summary?.finalStock ?? currentLiveStock}
          tone={summary?.finalStock === 0 ? 'success' : (summary?.finalStock ?? 0) < 0 ? 'danger' : 'default'}
          sublabel="Strict Non-Negative"
        />
      </div>

      {/* Result Outcome Banner */}
      {summary && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center justify-between shadow-2xs ${
            isPass
              ? 'bg-[#ECFDF5] border-emerald-200 text-[#047857]'
              : 'bg-[#FEF2F2] border-red-200 text-[#B91C1C]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isPass ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <span className="font-semibold text-base">
              {isPass
                ? 'PASS — Exactly 1 winner, 49 rejected safely, zero oversell occurred.'
                : `FAIL — Invariant breach: ${successCount} orders created for 1 stock unit.`}
            </span>
          </div>
          <span className="font-mono text-xs font-bold uppercase">
            {isPass ? 'INVARIANT VERIFIED' : 'OVERSELL DETECTED'}
          </span>
        </div>
      )}

      {/* 50-Cell Concurrency Grid & Request Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 50-Cell Matrix (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h3 className="text-base font-semibold text-[#111827]">
              50 Concurrent Requests Matrix
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {visibleResults.length}/50 Completed
            </span>
          </div>

          <div className="grid grid-cols-10 gap-2 p-3 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg">
            {Array.from({ length: 50 }).map((_, idx) => {
              const res = visibleResults[idx];
              let cellClass = 'bg-slate-200 border-slate-300 text-slate-400';

              if (res) {
                if (res.status === 201) {
                  cellClass = 'bg-[#047857] border-emerald-600 text-white shadow-xs';
                } else if (res.status === 409) {
                  cellClass = 'bg-[#B91C1C] border-red-600 text-white';
                }
              }

              return (
                <div
                  key={idx}
                  className={`aspect-square rounded-md border flex items-center justify-center font-mono text-[10px] font-bold transition-all ${cellClass}`}
                  title={res ? `Customer ${idx + 1}: HTTP ${res.status}` : `Pending customer ${idx + 1}`}
                >
                  {res ? (res.status === 201 ? '✓' : '✗') : idx + 1}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-[#6B7280] pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#047857]" />
              <span>201 Created (Winner)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-[#B91C1C]" />
              <span>409 Stock Out (Rejected Safely)</span>
            </span>
          </div>
        </div>

        {/* Request Execution Log Table (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h3 className="text-base font-semibold text-[#111827]">
              Execution Trace Log
            </h3>
            <span className="text-xs text-[#6B7280]">
              Chronological arrivals
            </span>
          </div>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Customer ID</th>
                  <th className="py-2 px-3">Result / Order ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {visibleResults.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-sans italic">
                      Click "Run Test" to trigger concurrent checkout burst.
                    </td>
                  </tr>
                ) : (
                  visibleResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            r.status === 201
                              ? 'bg-[#ECFDF5] text-[#047857]'
                              : 'bg-[#FEF2F2] text-[#B91C1C]'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-600 truncate max-w-[120px]">
                        {r.customerId}
                      </td>
                      <td className="py-1.5 px-3 font-semibold text-slate-900 truncate max-w-[150px]">
                        {r.orderId || 'INSUFFICIENT_STOCK'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
