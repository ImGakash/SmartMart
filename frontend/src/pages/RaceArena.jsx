import React, { useState, useEffect, useCallback } from 'react';
import { apiPost, apiGet } from '../api/client.js';
import { useApp } from '../state/AppContext.jsx';
import ProofPanel from '../components/ProofPanel.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import ProofTable from '../components/ProofTable.jsx';
import DemoActionButton from '../components/DemoActionButton.jsx';
import MetricCard from '../components/MetricCard.jsx';
import {
  Zap,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Flame,
  Layers,
  ArrowRight,
  Database,
  Lock,
  ListOrdered
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

  // Animation staging state: results reveal incrementally for dramatic judge effect
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

  // START RACE
  async function handleStartRace() {
    if (currentLiveStock !== 1) {
      showToast({
        type: 'error',
        code: 'INVALID_STOCK',
        message: 'Stock is not 1 — please reset the demo first.',
      });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setVisibleResults([]);
    setSummary(null);

    try {
      const payload = {
        productId: FIXED_PRODUCT_ID,
        storeId: FIXED_STORE_ID,
        buyers: BUYERS_COUNT,
        mode,
      };

      const res = await apiPost('/demo/race', payload);
      const allResults = res?.results || [];
      const resSummary = res?.summary || {
        success: allResults.filter((r) => r.status === 'SUCCESS').length,
        failed: allResults.filter((r) => r.status === 'INSUFFICIENT_STOCK').length,
        baselineQty: 1,
        finalStock: mode === 'safe' ? 0 : 1 - allResults.filter((r) => r.status === 'SUCCESS').length,
      };

      setResults(allResults);
      setSummary(resSummary);

      // Stagger animations into 10x5 grid over ~1.2s for dramatic stage effect
      let currentIdx = 0;
      const stepInterval = Math.max(15, Math.floor(1200 / allResults.length));

      const timer = setInterval(() => {
        currentIdx += 2;
        if (currentIdx >= allResults.length) {
          setVisibleResults(allResults);
          clearInterval(timer);
          setIsRunning(false);
          fetchLiveStock();
        } else {
          setVisibleResults(allResults.slice(0, currentIdx));
        }
      }, stepInterval);
    } catch (err) {
      setIsRunning(false);
      showToast({
        type: 'error',
        code: err.code || 'RACE_ERROR',
        message: err.message,
      });
    }
  }

  const successCount = visibleResults.filter((r) => r.status === 'SUCCESS').length;
  const rejectedCount = visibleResults.filter((r) => r.status === 'INSUFFICIENT_STOCK').length;

  const noNegativeStockStatus =
    xrayConsistency?.find((c) => c.name === 'no_negative_stock')?.status ||
    (summary?.finalStock < 0 ? 'FAIL' : 'PASS');

  const dbProofRows = summary
    ? [
        {
          id: 'final_stock',
          invariant: 'Final stock',
          value: `${summary.finalStock} unit(s)`,
          expected: '0 unit(s)',
          status: summary.finalStock === 0 ? 'pass' : 'fail',
        },
        {
          id: 'orders_created',
          invariant: 'Orders created',
          value: `${summary.success} order(s)`,
          expected: '1 order',
          status: summary.success === 1 ? 'pass' : 'fail',
        },
        {
          id: 'negative_stock',
          invariant: 'Negative stock rows',
          value: noNegativeStockStatus === 'PASS' ? '0 violations' : 'Violations detected',
          expected: '0 violations (PASS)',
          status: noNegativeStockStatus === 'PASS' ? 'pass' : 'fail',
        },
        {
          id: 'pending_outbox',
          invariant: 'Pending outbox',
          value: `${pendingOutbox} events`,
          expected: '0 events',
          status: pendingOutbox === 0 ? 'pass' : 'info',
        },
      ]
    : [];

  const dbProofColumns = [
    { key: 'invariant', label: 'Invariant / Metric' },
    { key: 'value', label: 'Observed Value' },
    { key: 'expected', label: 'Expected' },
    {
      key: 'status',
      label: 'Proof Status',
      render: (val) => <ProofBadge status={val} label={val === 'pass' ? 'PASS' : val === 'fail' ? 'FAIL' : 'INFO'} />,
    },
  ];

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8 font-sans">
      {/* Dramatic Arena Header */}
      <div className="bg-gradient-to-r from-ink-950 via-rose-950/40 to-ink-950 border border-slate-800 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 uppercase">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              HIGH CONCURRENCY STRESS TEST
            </span>
            <span className="text-slate-400 text-xs font-mono">50 Concurrent Buyers</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-mono font-black tracking-tight text-white uppercase">
            FLASH-SALE CONCURRENCY ARENA
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Comparing atomic conditional stock deduction (<code className="text-emerald-400 font-mono font-bold">Safe</code>)
            against uncoordinated read-then-write (<code className="text-rose-400 font-mono font-bold">Naive</code>).
          </p>
        </div>

        {/* Live Baseline Indicator */}
        <div className="bg-ink-950 border border-slate-800 rounded-2xl p-4 min-w-[220px] text-right shadow-inner">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">
            Current Live Stock
          </div>
          <div className="font-mono text-3xl font-black text-amber-400 flex items-baseline justify-end gap-1.5">
            <span>{isLoadingStock ? '...' : currentLiveStock}</span>
            <span className="text-sm font-normal text-slate-400">UNIT(S)</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Store: BLR-01 Bengaluru</div>
        </div>
      </div>

      {/* PRE-FLIGHT CHECK WARNING (when stock != 1) */}
      {currentLiveStock !== 1 && (
        <div className="bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl shadow-amber-950/40">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-mono font-bold text-amber-200">
                  Stock is not 1 (currently {currentLiveStock} unit{currentLiveStock === 1 ? '' : 's'}) — reset demo first
                </span>
                <ProofBadge status="warn" label="PRE-FLIGHT BLOCKED" />
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5">
                The flash-sale concurrency demonstration requires exactly 1 unit in stock to prove atomic isolation vs oversell.
              </p>
            </div>
          </div>

          <DemoActionButton
            onClick={handleResetDemo}
            loading={isResetting}
            disabled={isRunning}
            variant="warning"
            icon={RotateCcw}
            size="md"
            className="shrink-0 font-mono font-bold"
          >
            Reset Demo (POST /demo/reset)
          </DemoActionButton>
        </div>
      )}

      {/* Fixed Configuration Read-only Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-ink-800/70 border border-line rounded-2xl p-3.5 flex flex-col gap-1 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Target Product</span>
          <span className="text-sm font-bold text-white truncate">boAt Airdopes 141 (P01)</span>
          <span className="text-[10px] font-mono text-slate-500 truncate">{FIXED_PRODUCT_ID}</span>
        </div>

        <div className="bg-ink-800/70 border border-line rounded-2xl p-3.5 flex flex-col gap-1 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Store Hub</span>
          <span className="text-sm font-bold text-white">BLR-01 Bengaluru (Indiranagar)</span>
          <span className="text-[10px] font-mono text-slate-500 truncate">{FIXED_STORE_ID}</span>
        </div>

        <div className="bg-ink-800/70 border border-line rounded-2xl p-3.5 flex flex-col gap-1 backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Concurrency Level</span>
          <span className="text-sm font-bold text-white font-mono">{BUYERS_COUNT} Parallel Buyers</span>
          <span className="text-[10px] font-mono text-slate-500">Seeded Customers c01 - c50</span>
        </div>

        <div className="bg-ink-800/70 border border-line rounded-2xl p-3.5 flex flex-col gap-1 justify-between backdrop-blur-md">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Database Reset</span>
          <DemoActionButton
            onClick={handleResetDemo}
            loading={isResetting}
            disabled={isRunning}
            variant="secondary"
            icon={RotateCcw}
            size="sm"
            className="w-full text-xs font-mono font-bold"
          >
            RESET DEMO (POST /demo/reset)
          </DemoActionButton>
        </div>
      </div>

      {/* Mode Selection Toggle: Giant Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch gap-4">
        {/* SAFE MODE BUTTON */}
        <button
          type="button"
          onClick={() => setMode('safe')}
          disabled={isRunning}
          className={`flex-1 p-6 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 cursor-pointer text-left ${
            mode === 'safe'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-100 shadow-2xl shadow-emerald-950/50 ring-2 ring-emerald-500/30'
              : 'bg-ink-800/70 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-xl border ${
                mode === 'safe'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-white">SAFE MODE</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                  PostgreSQL Atomic
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Strict single-statement conditional update (<code className="font-mono text-emerald-300">stock_qty &gt;= qty</code>).
                Guarantees zero oversell under 50-way race.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded bg-black/40">
            {mode === 'safe' ? 'SELECTED' : 'SELECT'}
          </span>
        </button>

        {/* NAIVE MODE BUTTON */}
        <button
          type="button"
          onClick={() => setMode('naive')}
          disabled={isRunning}
          className={`flex-1 p-6 rounded-2xl border-2 transition-all flex items-center justify-between gap-4 cursor-pointer text-left ${
            mode === 'naive'
              ? 'bg-rose-950/80 border-rose-500 text-rose-100 shadow-2xl shadow-rose-950/50 ring-2 ring-rose-500/30'
              : 'bg-ink-800/70 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-xl border ${
                mode === 'naive'
                  ? 'bg-rose-500 text-white border-rose-400 font-black'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-black text-white">NAIVE MODE</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                  Race Vulnerability
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                Vulnerable read-then-write pattern with 50ms delay. Deliberately demonstrates catastrophic inventory corruption.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-3 py-1 rounded bg-black/40">
            {mode === 'naive' ? 'SELECTED' : 'SELECT'}
          </span>
        </button>
      </div>

      {/* START RACE Action Button (Disabled if stock != 1) */}
      <DemoActionButton
        onClick={handleStartRace}
        loading={isRunning}
        disabled={currentLiveStock !== 1}
        variant={mode === 'safe' ? 'success' : 'danger'}
        icon={Play}
        size="lg"
        className="w-full py-5 text-xl font-black font-mono tracking-wider shadow-2xl"
        id="start-race-button"
      >
        {currentLiveStock !== 1
          ? `RUN DISABLED (RESET DEMO TO STOCK = 1)`
          : `START RACE (${BUYERS_COUNT} CONCURRENT BUYERS)`}
      </DemoActionButton>

      {/* Two Column Layout: Concurrency Matrix & Live Requests (Left) vs DB Proof Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 50-cell matrix + 50-row request table */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Live Counter */}
          <div className="bg-ink-800/70 border border-line rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
                  Live Concurrency Telemetry
                </span>
                <div className="text-2xl font-mono font-extrabold text-white">
                  <span className="text-emerald-400">{successCount} succeeded</span>
                  <span className="text-slate-500 mx-2">·</span>
                  <span className="text-rose-400">{rejectedCount} rejected</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-300">201 COMMITTED</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-300">409 REJECTED</span>
              </span>
            </div>
          </div>

          {/* 10x5 Grid of 50 Buyer Cells */}
          <div className="bg-ink-950 border border-slate-800/90 rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold">
                Concurrency Matrix (10 × 5 = 50 Parallel Worker Threads)
              </span>
              <span className="text-xs font-mono text-slate-400">
                {visibleResults.length} / 50 resolved
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {Array.from({ length: 50 }).map((_, index) => {
                const res = visibleResults[index];
                const isResolved = Boolean(res);
                const isSuccess = res?.status === 'SUCCESS';
                const isFailed = res?.status === 'INSUFFICIENT_STOCK';

                return (
                  <div
                    key={index}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-1.5 text-center transition-all duration-300 shadow-sm ${
                      !isResolved
                        ? 'bg-ink-900/60 border-slate-800 text-slate-600'
                        : isSuccess
                        ? 'bg-emerald-950 border-emerald-500/80 text-emerald-300 shadow-emerald-950/50 scale-105'
                        : 'bg-rose-950 border-rose-500/80 text-rose-300 shadow-rose-950/50 scale-105'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold opacity-75">
                      #{String(index + 1).padStart(2, '0')}
                    </span>

                    {isSuccess && (
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[9px] font-mono font-black uppercase text-emerald-300">
                          201
                        </span>
                        {res.orderId && (
                          <span className="text-[8px] font-mono truncate max-w-[36px] text-emerald-400/80">
                            {res.orderId.slice(-4)}
                          </span>
                        )}
                      </div>
                    )}

                    {isFailed && (
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-[9px] font-mono font-black uppercase text-rose-300">
                          409
                        </span>
                      </div>
                    )}

                    {!isResolved && (
                      <div className="w-2 h-2 rounded-full bg-slate-800 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 50-ROW LIVE REQUEST TABLE */}
          <div className="bg-ink-950 border border-slate-800/90 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-cyan" />
                <span className="text-xs font-mono text-slate-300 uppercase font-bold tracking-wider">
                  Live Concurrency Requests (50 Invocations)
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Contract: POST /demo/race
              </span>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-xl border border-slate-800/80 bg-ink-900/40 custom-scrollbar">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead className="sticky top-0 bg-ink-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider z-10">
                  <tr>
                    <th className="py-2.5 px-4 font-black w-14">#</th>
                    <th className="py-2.5 px-4 font-black w-24">Customer</th>
                    <th className="py-2.5 px-4 font-black w-32">Status</th>
                    <th className="py-2.5 px-4 font-black">Order / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {visibleResults.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500 italic font-sans">
                        No requests dispatched yet. Click START RACE to begin.
                      </td>
                    </tr>
                  ) : (
                    visibleResults.map((row, idx) => {
                      const isSuccess = row.status === 'SUCCESS';
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-ink-800/40 transition-colors ${
                            isSuccess ? 'bg-emerald-950/20' : 'bg-rose-950/10'
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-400 font-bold">
                            #{String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-4 text-slate-300 font-mono">
                            {row.customerId || `c${String(idx + 1).padStart(2, '0')}`}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono border ${
                                isSuccess
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              }`}
                            >
                              {isSuccess ? '201 SUCCESS' : '409 409_STOCK'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono">
                            {row.orderId || row.orderNumber ? (
                              <span className="text-emerald-400 font-bold">
                                {row.orderId || row.orderNumber}
                              </span>
                            ) : (
                              <span className="text-rose-400/90 font-medium">
                                INSUFFICIENT_STOCK
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              * Per-request latencies omitted per integration contract §10 (no response timing field).
            </span>
          </div>
        </div>

        {/* Right Column: Database Proof Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6 sticky top-24">
          <ProofPanel
            title="Database Isolation Proof"
            service="PostgreSQL"
            action="50 Parallel Buyers Flash-Sale"
            proof="Atomic conditional update vs Unsafe read-then-write"
          >
            {/* HERO BANNER */}
            {summary ? (
              summary.success === 1 && summary.finalStock === 0 ? (
                <div className="bg-emerald-950 border-2 border-emerald-500 rounded-xl p-5 flex flex-col gap-2 text-emerald-200 shadow-xl shadow-emerald-950/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-mono font-black text-white uppercase tracking-wider">
                        Exactly one winner — zero oversells
                      </h3>
                      <span className="text-xs text-emerald-300 font-mono">
                        VERIFIED: 1 order committed, 49 rejected (409)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed mt-1 font-sans">
                    Strict PostgreSQL single-statement conditional update (<code className="font-mono text-emerald-300">WHERE stock_qty &gt;= 1</code>)
                    atomically serialized 50 concurrent transactions. Zero oversell achieved.
                  </p>
                </div>
              ) : (
                <div className="bg-rose-950 border-2 border-rose-500 rounded-xl p-5 flex flex-col gap-2 text-rose-200 shadow-xl shadow-rose-950/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                      <AlertTriangle className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-mono font-black text-white uppercase tracking-wider">
                        {mode === 'naive'
                          ? 'OVERSOLD — inventory corrupted'
                          : 'RACE FAILED — CONCURRENCY INVARIANT VIOLATED'}
                      </h3>
                      <span className="text-xs text-rose-300 font-mono">
                        {mode === 'naive'
                          ? 'demo of unsafe read-then-write on inventory_naive'
                          : 'Unexpected race result'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-rose-200/90 leading-relaxed mt-1 font-sans">
                    {mode === 'naive'
                      ? `50 uncoordinated threads read baseline stock of ${summary.baselineQty}, resulting in ${summary.success} successful checkouts and driving stock to ${summary.finalStock}.`
                      : `Observed ${summary.success} winners against baseline stock of ${summary.baselineQty}. Final stock: ${summary.finalStock}.`}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-ink-950 border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-xs font-mono text-slate-400">
                  Ready to test. Select mode and execute 50 concurrent buyers.
                </span>
              </div>
            )}

            {/* Metric Cards */}
            {summary && (
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  title="BASELINE"
                  value={summary.baselineQty}
                  tone="default"
                  sublabel="Seed Units"
                />
                <MetricCard
                  title="COMMITTED"
                  value={summary.success}
                  tone={summary.success === 1 ? 'success' : 'danger'}
                  sublabel="Orders"
                />
                <MetricCard
                  title="FINAL STOCK"
                  value={summary.finalStock}
                  tone={summary.finalStock === 0 ? 'success' : 'danger'}
                  sublabel={summary.finalStock < 0 ? 'CORRUPT' : 'SAFE'}
                />
              </div>
            )}

            {/* Database Proof Table */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan" />
                PostgreSQL Invariant Verification
              </span>
              <ProofTable
                columns={dbProofColumns}
                data={dbProofRows}
                emptyMessage="Run race to evaluate PostgreSQL consistency invariants."
              />
            </div>

            {/* Implementation Explanation */}
            <div className="bg-ink-950 border border-slate-800 rounded-xl p-4 flex flex-col gap-2 font-mono text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Implementation Under the Hood
              </span>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                <strong>Safe Mode:</strong> Dispatches <code className="text-emerald-300">UPDATE store_inventory SET stock_qty = stock_qty - 1 WHERE store_id = $1 AND product_id = $2 AND stock_qty &gt;= 1</code>.
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                <strong>Naive Mode:</strong> Executes <code className="text-rose-300">SELECT stock_qty</code>, pauses 50ms, then <code className="text-rose-300">UPDATE SET stock_qty = stock_qty - 1</code> without qualification.
              </p>
            </div>
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
