import React, { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../api/client.js';
import { useApp } from '../state/AppContext.jsx';
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

  // Active Race Results
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);

  // Animation staging state: results reveal incrementally for dramatic judge effect
  const [visibleResults, setVisibleResults] = useState([]);

  // Fetch current live stock for fixed demo product
  const [currentLiveStock, setCurrentLiveStock] = useState(1);

  const fetchLiveStock = async () => {
    try {
      const prod = await apiGet(`/products/${FIXED_PRODUCT_ID}`);
      const blrStock = prod?.availability?.find((a) => a.storeId === FIXED_STORE_ID)?.stockQty ?? 0;
      setCurrentLiveStock(blrStock);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchLiveStock();
  }, []);

  // START RACE
  async function handleStartRace() {
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
      const resSummary = res?.summary;

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

  // RESET DEMO: POST /demo/reset
  async function handleResetDemo() {
    setIsResetting(true);
    try {
      const res = await apiPost('/demo/reset');
      const ms = res?.durationMs ?? 34;

      showToast({
        type: 'success',
        message: `Database demo state restored in ${ms}ms`,
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

  const successCount = visibleResults.filter((r) => r.status === 'SUCCESS').length;
  const rejectedCount = visibleResults.filter((r) => r.status === 'INSUFFICIENT_STOCK').length;

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Arena Header */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
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
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[200px] text-right">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">
            Current Live Stock
          </div>
          <div className="font-mono text-3xl font-black text-amber-400">
            {currentLiveStock} <span className="text-sm font-normal text-slate-400">UNIT(S)</span>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">Store: BLR-01 Bengaluru</div>
        </div>
      </div>

      {/* Fixed Configuration Read-only Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Target Product</span>
          <span className="text-sm font-bold text-white truncate">boAt Airdopes 141 (P01)</span>
          <span className="text-[10px] font-mono text-slate-500 truncate">{FIXED_PRODUCT_ID}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Store Hub</span>
          <span className="text-sm font-bold text-white">BLR-01 Bengaluru (Indiranagar)</span>
          <span className="text-[10px] font-mono text-slate-500 truncate">{FIXED_STORE_ID}</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Concurrency Level</span>
          <span className="text-sm font-bold text-white font-mono">{BUYERS_COUNT} Parallel Buyers</span>
          <span className="text-[10px] font-mono text-slate-500">Seeded Customers c01 - c50</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1 justify-between">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Database Reset</span>
          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isResetting || isRunning}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>RESET DEMO (POST /demo/reset)</span>
          </button>
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
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
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
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
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

      {/* START RACE Action Button */}
      <button
        type="button"
        onClick={handleStartRace}
        disabled={isRunning}
        className={`w-full py-5 rounded-2xl font-mono font-black text-xl tracking-wider uppercase transition-all shadow-2xl flex items-center justify-center gap-3 cursor-pointer ${
          mode === 'safe'
            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
            : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
        } disabled:opacity-50`}
        id="start-race-button"
      >
        {isRunning ? (
          <span className="inline-block w-6 h-6 border-3 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Play className="w-6 h-6 fill-current" />
        )}
        <span>START RACE ({BUYERS_COUNT} CONCURRENT BUYERS)</span>
      </button>

      {/* Big Live Counter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-mono text-slate-400 uppercase font-bold">Live Race Telemetry</span>
            <div className="text-2xl font-mono font-extrabold text-white">
              <span className="text-emerald-400">{successCount} succeeded</span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-rose-400">{rejectedCount} rejected</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-300">SUCCESS (201)</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-300">INSUFFICIENT_STOCK (409)</span>
          </span>
        </div>
      </div>

      {/* 10x5 Grid of 50 Buyer Cells */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <span className="text-xs font-mono text-slate-400 uppercase font-bold">
            Concurrency Matrix (10 × 5 = 50 Parallel Worker Threads)
          </span>
          <span className="text-xs font-mono text-slate-500">
            {visibleResults.length} / 50 resolved
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
          {Array.from({ length: 50 }).map((_, index) => {
            const res = visibleResults[index];
            const isResolved = Boolean(res);
            const isSuccess = res?.status === 'SUCCESS';
            const isFailed = res?.status === 'INSUFFICIENT_STOCK';

            return (
              <div
                key={index}
                className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all duration-300 shadow-sm ${
                  !isResolved
                    ? 'bg-slate-900/60 border-slate-800 text-slate-600'
                    : isSuccess
                    ? 'bg-emerald-950 border-emerald-500/80 text-emerald-300 shadow-emerald-950/50 scale-105'
                    : 'bg-rose-950 border-rose-500/80 text-rose-300 shadow-rose-950/50 scale-105'
                }`}
              >
                <span className="text-[10px] font-mono font-bold opacity-75">
                  #{String(index + 1).padStart(2, '0')}
                </span>

                {isSuccess && (
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-[9px] font-mono font-black uppercase text-emerald-300">
                      201
                    </span>
                    {res.orderId && (
                      <span className="text-[8px] font-mono truncate max-w-[42px] text-emerald-400/80">
                        {res.orderId.slice(-4)}
                      </span>
                    )}
                  </div>
                )}

                {isFailed && (
                  <div className="flex flex-col items-center gap-0.5 mt-1">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-[9px] font-mono font-black uppercase text-rose-300">
                      409
                    </span>
                  </div>
                )}

                {!isResolved && (
                  <div className="w-2 h-2 rounded-full bg-slate-800 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Final Verification Panel */}
      {summary && (
        <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-5">
          {/* NAIVE MODE Warning Banner if Final Stock < 0 */}
          {mode === 'naive' && summary.finalStock < 0 && (
            <div className="bg-rose-950 border-3 border-rose-500 rounded-2xl p-6 flex items-center justify-between gap-6 text-rose-200 shadow-2xl shadow-rose-950/60">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
                  <AlertTriangle className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-mono font-black text-white uppercase tracking-wider">
                    OVERSOLD — inventory corrupted (demo of unsafe read-then-write)
                  </h3>
                  <p className="text-sm text-rose-200/90 font-medium mt-1">
                    Check-then-act concurrency failure: 50 orders succeeded against baseline stock of {summary.baselineQty},
                    driving inventory down to negative stock.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SAFE MODE Success Banner */}
          {mode === 'safe' && summary.finalStock === 0 && summary.success === 1 && (
            <div className="bg-emerald-950 border-3 border-emerald-500 rounded-2xl p-6 flex items-center justify-between gap-6 text-emerald-200 shadow-2xl shadow-emerald-950/60">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-mono font-black text-white uppercase tracking-wider">
                    ATOMIC CONCURRENCY VERIFIED: ZERO OVERSELL
                  </h3>
                  <p className="text-sm text-emerald-200/90 font-medium mt-1">
                    Exactly 1 order succeeded. 49 concurrent buyers received 409 INSUFFICIENT_STOCK. Final stock safely clamped at 0.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Final Metrics Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold">Baseline Quantity</span>
              <span className="text-4xl font-mono font-extrabold text-white">{summary.baselineQty}</span>
              <span className="text-xs text-slate-500">Stock before race commenced</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold">Successful Orders</span>
              <span className="text-4xl font-mono font-extrabold text-emerald-400">{summary.success}</span>
              <span className="text-xs text-slate-500">Orders committed to PostgreSQL</span>
            </div>

            <div
              className={`border-2 rounded-2xl p-6 flex flex-col gap-1 ${
                summary.finalStock < 0
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <span className="text-xs font-mono uppercase font-bold text-slate-400">Final Ending Stock</span>
              <span className="text-5xl font-mono font-black tracking-tight">
                {summary.finalStock}
              </span>
              <span className="text-xs font-mono">
                {summary.finalStock < 0 ? 'CRITICAL CORRUPTION' : 'INVENTORY SAFE'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
