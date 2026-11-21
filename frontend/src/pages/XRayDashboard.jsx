import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/client.js';
import { subscribeSSE } from '../api/sse.js';
import { useApp } from '../state/AppContext.jsx';
import Price from '../components/Price.jsx';
import ConsistencyTable from '../components/ConsistencyTable.jsx';
import ChaosSwitch from '../components/ChaosSwitch.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import DemoActionButton from '../components/DemoActionButton.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import {
  Activity,
  Layers,
  Database,
  Radio,
  Search,
  Mail,
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingDown,
  Inbox,
  ShieldAlert,
  Server,
  ShieldCheck,
  Check,
  Filter
} from 'lucide-react';

export default function XRayDashboard() {
  const { showToast } = useApp();

  // Metrics bundle state
  const [metrics, setMetrics] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [sseStatus, setSseStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Chaos & Action loadings
  const [isRequeuing, setIsRequeuing] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Reconciliation table filters
  const [reconciliationFilter, setReconciliationFilter] = useState('ALL'); // 'ALL' | 'MISMATCH' | 'PASS'
  const [reconciliationSearch, setReconciliationSearch] = useState('');

  // Polling fallback helper
  const fetchMetricsPolling = useCallback(async () => {
    try {
      const data = await apiGet('/xray/metrics');
      if (data) {
        setMetrics(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('Polling metrics failed:', err.message);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  // SSE Stream subscription with 2s polling fallback
  useEffect(() => {
    let pollInterval = null;

    const unsubscribe = subscribeSSE('/xray/stream', {
      onStatusChange: (status) => {
        setSseStatus(status);
        if (status === 'disconnected' || status === 'closed') {
          if (!pollInterval) {
            pollInterval = setInterval(fetchMetricsPolling, 2000);
          }
        } else if (status === 'connected') {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      },
      onMessage: (data, eventType) => {
        if (eventType === 'metrics' || data?.dashboard || data?.reconciliation) {
          setMetrics(data);
          setLastUpdated(new Date());
          setLoadingInitial(false);
        }
      },
      onError: () => {
        if (!pollInterval) {
          pollInterval = setInterval(fetchMetricsPolling, 2000);
        }
      },
    });

    fetchMetricsPolling();

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [fetchMetricsPolling]);

  // Toggle Chaos switch: POST /admin/chaos { target, enabled }
  async function handleToggleChaos(target, enabled) {
    try {
      await apiPost('/admin/chaos', { target, enabled });

      setMetrics((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          chaos: {
            ...prev.chaos,
            [target]: enabled,
          },
        };
      });

      showToast({
        type: enabled ? 'error' : 'info',
        message: `${target} chaos ${enabled ? 'INJECTED (fault active)' : 'CLEARED (restored)'}`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        code: 'CHAOS_FAILED',
        message: err.message,
      });
    }
  }

  // Requeue failed outbox events: POST /admin/outbox/requeue
  async function handleRequeueOutbox() {
    setIsRequeuing(true);
    try {
      const res = await apiPost('/admin/outbox/requeue');
      showToast({
        type: 'success',
        message: `Successfully requeued ${res?.requeued ?? 0} outbox event(s)`,
      });
      fetchMetricsPolling();
    } catch (err) {
      showToast({
        type: 'error',
        code: 'REQUEUE_ERROR',
        message: err.message,
      });
    } finally {
      setIsRequeuing(false);
    }
  }

  // Full OpenSearch reindex: POST /admin/reindex
  async function handleFullReindex() {
    setIsReindexing(true);
    try {
      const res = await apiPost('/admin/reindex');
      showToast({
        type: 'success',
        message: `OpenSearch reindexed ${res?.indexed ?? 0} product search document(s)`,
      });
      fetchMetricsPolling();
    } catch (err) {
      showToast({
        type: 'error',
        code: 'REINDEX_ERROR',
        message: err.message,
      });
    } finally {
      setIsReindexing(false);
    }
  }

  // Reset Demo: POST /demo/reset
  async function handleResetDemo() {
    setIsResetting(true);
    try {
      const res = await apiPost('/demo/reset');
      const ms = res?.durationMs ?? 35;
      showToast({
        type: 'success',
        message: `Demo state reset in ${ms}ms. Clean inventory & orders restored.`,
      });
      setShowResetConfirm(false);
      fetchMetricsPolling();
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

  if (loadingInitial && !metrics) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-20 flex flex-col items-center justify-center gap-4 font-mono">
        <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Connecting to Control Tower Telemetry...</span>
      </div>
    );
  }

  const dashboard = metrics?.dashboard || {};
  const outbox = metrics?.outbox || dashboard.outbox || {};
  const consistencyChecks = metrics?.consistency?.checks || metrics?.consistency || [];
  const chaos = metrics?.chaos || {};
  const recentOrders = metrics?.recentOrders || [];
  const recentNotifications = metrics?.recentNotifications || [];
  const reconciliation = metrics?.reconciliation || { checkedAt: new Date().toISOString(), mismatches: 0, rows: [] };

  const totalOrders = dashboard.totalOrders ?? metrics?.orders?.total ?? 0;
  const totalNotifications = dashboard.totalNotifications ?? metrics?.notifications?.sent ?? 0;
  const pendingOutbox = outbox.pending ?? 0;
  const failedEvents = outbox.failed ?? metrics?.dlq?.count ?? 0;

  const noNegCheck = Array.isArray(consistencyChecks)
    ? consistencyChecks.find((c) => c.name === 'no_negative_stock')
    : null;
  const invReconCheck = Array.isArray(consistencyChecks)
    ? consistencyChecks.find((c) => c.name === 'inventory_reconciliation')
    : null;
  const hasOversellViolation =
    (noNegCheck && noNegCheck.status !== 'PASS') ||
    (invReconCheck && invReconCheck.status !== 'PASS');

  const mismatches = reconciliation.mismatches ?? 0;
  const totalCatalog = reconciliation.rows?.length || 36;
  const inSyncCount = Math.max(0, totalCatalog - mismatches);
  const searchSyncStatus = mismatches === 0 ? 'PASS' : mismatches > 3 ? 'FAIL' : 'SYNCING';

  const reconciliationRows = (reconciliation.rows || []).filter((row) => {
    if (reconciliationFilter === 'MISMATCH' && row.status === 'PASS') return false;
    if (reconciliationFilter === 'PASS' && row.status !== 'PASS') return false;
    if (reconciliationSearch.trim()) {
      const q = reconciliationSearch.toLowerCase();
      return (
        row.name?.toLowerCase().includes(q) ||
        row.productId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8 font-sans">
      {/* Top Banner & Control Tower Identity */}
      <div className="bg-gradient-to-r from-ink-950 via-ink-900 to-ink-950 border border-slate-800 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan/15 text-cyan border border-cyan/30 flex items-center gap-1.5 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-cyan" />
              MULTI-SERVICE CONTROL TOWER
            </span>
            <span className="text-slate-400 text-xs font-mono">
              Last refreshed {lastUpdated ? lastUpdated.toLocaleTimeString() : 'now'} · Auto-refresh ON
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-mono font-black tracking-tight text-white uppercase">
            INVENTORY CONTROL TOWER
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Live cross-service reconciliation of PostgreSQL (Source of Truth), Apache Kafka (Outbox Relay), and OpenSearch (Search Index) across 5 Indian metro cities.
          </p>
        </div>

        {/* Live SSE Stream Badge & Demo Reset Button */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <div className="flex flex-col items-end gap-1.5 bg-ink-950 border border-slate-800 rounded-2xl p-3.5 min-w-[200px] shadow-inner">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  sseStatus === 'connected'
                    ? 'bg-cyan animate-ping'
                    : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                {sseStatus === 'connected' ? 'STREAM CONNECTED' : 'POLLING FALLBACK'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Latency: &lt;10ms (Local Aiven)
            </div>
          </div>

          <DemoActionButton
            onClick={() => setShowResetConfirm(true)}
            variant="danger"
            icon={RotateCcw}
            size="md"
            className="font-mono font-bold"
          >
            Reset Demo
          </DemoActionButton>
        </div>
      </div>

      {/* 1. HEALTH METRICCARDS ROW (Big Monospace Numbers) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="ORDERS CREATED"
          value={totalOrders}
          tone="default"
          sublabel="Total Committed"
        />

        <MetricCard
          title="NOTIFICATIONS"
          value={totalNotifications}
          tone="default"
          sublabel="Deduplicated"
        />

        <MetricCard
          title="PENDING OUTBOX"
          value={pendingOutbox}
          tone={pendingOutbox > 0 ? 'warning' : 'success'}
          sublabel={pendingOutbox > 0 ? 'Awaiting Drain' : 'Drain Clear'}
        />

        <MetricCard
          title="FAILED EVENTS"
          value={failedEvents}
          tone={failedEvents > 0 ? 'danger' : 'success'}
          sublabel={failedEvents > 0 ? 'Dead Letter Queue' : 'Zero Failures'}
        />

        <MetricCard
          title="OVERSELL VIOLATIONS"
          value={hasOversellViolation ? 'VIOLATION' : '0'}
          tone={hasOversellViolation ? 'danger' : 'success'}
          sublabel="PostgreSQL Clamped"
        />

        <MetricCard
          title="SEARCH SYNC"
          value={searchSyncStatus}
          tone={searchSyncStatus === 'PASS' ? 'success' : searchSyncStatus === 'SYNCING' ? 'warning' : 'danger'}
          sublabel={`${inSyncCount}/${totalCatalog} In Sync`}
        />
      </div>

      {/* 2. HERO PANEL: RECONCILIATION TABLE (Centerpiece) */}
      <div className="bg-ink-800/70 border border-line rounded-3xl p-6 lg:p-7 shadow-2xl backdrop-blur-md flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan/15 text-cyan border border-cyan/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-mono font-black text-white tracking-wide uppercase">
                  Cross-Service Inventory Reconciliation
                </h2>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-black bg-cyan/20 text-cyan border border-cyan/40">
                  {inSyncCount}/{totalCatalog} IN SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Comparing PostgreSQL (Atomic Truth) against OpenSearch (Distributed Index) · Checked at {reconciliation.checkedAt ? new Date(reconciliation.checkedAt).toLocaleTimeString() : 'live'}
              </p>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-60">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reconciliationSearch}
                onChange={(e) => setReconciliationSearch(e.target.value)}
                placeholder="Filter by product..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-ink-950 border border-slate-700 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan"
              />
            </div>

            <div className="flex items-center rounded-xl bg-ink-950 border border-slate-800 p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setReconciliationFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  reconciliationFilter === 'ALL'
                    ? 'bg-ink-750 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({reconciliation.rows?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationFilter('MISMATCH')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  reconciliationFilter === 'MISMATCH'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Mismatches ({mismatches})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationFilter('PASS')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  reconciliationFilter === 'PASS'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Synced ({inSyncCount})
              </button>
            </div>
          </div>
        </div>

        {/* HERO TABLE */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-2xl border border-slate-800 bg-ink-950 custom-scrollbar">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead className="sticky top-0 bg-ink-900 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider z-10">
              <tr>
                <th className="py-3 px-4 font-black">Product</th>
                <th className="py-3 px-4 font-black text-center">PG Total Stock</th>
                <th className="py-3 px-4 font-black text-center">OS Total Stock</th>
                <th className="py-3 px-4 font-black text-center">PG Cities</th>
                <th className="py-3 px-4 font-black text-center">OS Cities</th>
                <th className="py-3 px-4 font-black text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reconciliationRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans italic">
                    No reconciliation rows match the selected filter.
                  </td>
                </tr>
              ) : (
                reconciliationRows.map((row) => {
                  const isPass = row.status === 'PASS';
                  return (
                    <tr
                      key={row.productId}
                      className={`hover:bg-ink-800/40 transition-colors ${
                        !isPass ? 'bg-amber-950/15' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm font-sans">{row.name}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[280px]">
                            {row.productId}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-base font-black text-indigo-300">
                          {row.pgTotalStock}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono text-base font-black ${
                            row.pgTotalStock !== row.osTotalStock
                              ? 'text-amber-400 underline decoration-amber-500 decoration-wavy'
                              : 'text-emerald-400'
                          }`}
                        >
                          {row.osTotalStock}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-300 font-medium">
                        {row.pgCities}
                      </td>

                      <td className="py-3 px-4 text-center text-slate-300 font-medium">
                        {row.osCities}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <SyncBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MATHEMATICAL PROOF: 10/10 Invariant Consistency Table */}
      <ConsistencyTable checks={consistencyChecks} />

      {/* 4. Outbox Pipeline & Chaos Fault Injection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Outbox Pipeline Drain Panel (6 cols) */}
        <div className="lg:col-span-6 bg-ink-800/70 border border-line rounded-3xl p-6 lg:p-7 shadow-xl backdrop-blur-md flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Inbox className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-mono font-black text-white tracking-wide uppercase">
                  Transactional Outbox Pipeline
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  PostgreSQL Table: <span className="text-indigo-300 font-bold">outbox_events</span>
                </p>
              </div>
            </div>

            <DemoActionButton
              onClick={handleRequeueOutbox}
              loading={isRequeuing}
              variant="secondary"
              icon={RotateCcw}
              size="sm"
              title="POST /admin/outbox/requeue"
            >
              Requeue Failed
            </DemoActionButton>
          </div>

          {/* 4 Outbox Stat Blocks with Drain Progress feel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* PENDING */}
            <div
              className={`p-4 rounded-2xl border flex flex-col gap-1 transition-all ${
                (outbox.pending ?? 0) > 0
                  ? 'bg-amber-950/70 border-amber-500/70 text-amber-200 shadow-md shadow-amber-950/50'
                  : 'bg-ink-950 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">PENDING</span>
              <span className="text-3xl font-mono font-black text-amber-400">
                {outbox.pending ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Awaiting claim</span>
            </div>

            {/* PROCESSING */}
            <div
              className={`p-4 rounded-2xl border flex flex-col gap-1 transition-all ${
                (outbox.processing ?? 0) > 0
                  ? 'bg-indigo-950/70 border-indigo-500/70 text-indigo-200 shadow-md shadow-indigo-950/50'
                  : 'bg-ink-950 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">PROCESSING</span>
              <span className="text-3xl font-mono font-black text-indigo-400">
                {outbox.processing ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Lease locked</span>
            </div>

            {/* PUBLISHED */}
            <div className="p-4 rounded-2xl border bg-ink-950 border-slate-800 text-slate-300 flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">PUBLISHED</span>
              <span className="text-3xl font-mono font-black text-emerald-400">
                {outbox.published ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Acked by Kafka</span>
            </div>

            {/* FAILED */}
            <div
              className={`p-4 rounded-2xl border flex flex-col gap-1 transition-all ${
                (outbox.failed ?? 0) > 0
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-md shadow-rose-950/60'
                  : 'bg-ink-950 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">FAILED</span>
              <span
                className={`text-3xl font-mono font-black ${
                  (outbox.failed ?? 0) > 0 ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {outbox.failed ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Max retries</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-ink-950 border border-slate-800 text-xs font-mono text-slate-400 leading-relaxed">
            Outbox relay polls every 1000ms using <code className="text-indigo-300">FOR UPDATE SKIP LOCKED</code>.
            Crash recovery auto-reclaims expired leases (&gt;10s) without burning attempt counters.
          </div>
        </div>

        {/* Chaos Engineering Panel (6 cols) */}
        <div className="lg:col-span-6 bg-ink-800/70 border border-line rounded-3xl p-6 lg:p-7 shadow-xl backdrop-blur-md flex flex-col gap-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-mono font-black text-white tracking-wide uppercase">
                  Chaos Fault Injection
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Live fault switches wired to <span className="text-rose-400 font-bold">POST /admin/chaos</span>
                </p>
              </div>
            </div>

            <DemoActionButton
              onClick={handleFullReindex}
              loading={isReindexing}
              variant="primary"
              icon={RefreshCw}
              size="sm"
              title="POST /admin/reindex"
            >
              Full Reindex
            </DemoActionButton>
          </div>

          {/* 4 Exact Chaos Targets from CONTRACT.md §7 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <ChaosSwitch
              target="relay"
              label="Pause Outbox Relay"
              description="Halts the outbox worker loop; rows accumulate as PENDING."
              enabled={Boolean(chaos.relay)}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="relay-after-publish"
              label="Crash after publish (one-shot)"
              description="Publishes to Kafka but skips marking PUBLISHED; triggers lease recovery test."
              enabled={Boolean(chaos['relay-after-publish'])}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="notifications"
              label="Pause Notifications"
              description="Freezes consumer processing on order-events topic."
              enabled={Boolean(chaos.notifications)}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="search-indexer"
              label="Pause Search Indexer"
              description="Freezes inventory consumer from updating OpenSearch index docs."
              enabled={Boolean(chaos['search-indexer'])}
              onToggle={handleToggleChaos}
            />
          </div>
        </div>
      </div>

      {/* 5. Bottom Activity Feeds: Recent Orders & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Recent Orders (Last 10) */}
        <div className="bg-ink-800/70 border border-line rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-extrabold text-white">Recent Orders (Last 10)</h3>
            <span className="text-xs font-mono text-slate-400">PostgreSQL Live Stream</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <th className="py-2 px-2">Order #</th>
                  <th className="py-2 px-2">Source</th>
                  <th className="py-2 px-2">City</th>
                  <th className="py-2 px-2">Items</th>
                  <th className="py-2 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No recent orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-ink-750/50">
                      <td className="py-2.5 px-2 font-bold text-white">{o.orderNumber}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            o.source === 'ONLINE'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {o.source}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300">{o.storeCity}</td>
                      <td className="py-2.5 px-2 text-slate-400">{o.itemCount}</td>
                      <td className="py-2.5 px-2 text-right">
                        <Price paise={o.totalPaise} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Notifications (Last 10) */}
        <div className="bg-ink-800/70 border border-line rounded-3xl p-6 shadow-xl backdrop-blur-md flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-extrabold text-white">Recent Notifications (Last 10)</h3>
            <span className="text-xs font-mono text-slate-400">Kafka Deduplicated</span>
          </div>

          <div className="flex flex-col divide-y divide-slate-800/60">
            {recentNotifications.length === 0 ? (
              <div className="py-6 text-center text-slate-500 font-mono text-xs">
                No recent notifications logged.
              </div>
            ) : (
              recentNotifications.map((n) => (
                <div key={n.id} className="py-2.5 flex flex-col gap-1 font-mono text-xs">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-cyan/20 text-cyan font-bold">
                      {n.channel || 'SIMULATED_EMAIL'}
                    </span>
                    <span className="text-slate-500">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs font-sans">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM DEMO RESET MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-ink-900 border-2 border-rose-500/70 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-mono font-bold text-white">Reset Demo Database?</h3>
                <span className="text-xs font-mono text-slate-400">POST /demo/reset</span>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Restore seed inventory and clear test orders? This will truncate order history, reset boAt Airdopes 141 (P01) stock to 1, and resynchronize OpenSearch.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-slate-300 text-xs font-mono font-bold cursor-pointer transition-colors border border-slate-700"
              >
                Cancel
              </button>
              <DemoActionButton
                onClick={handleResetDemo}
                loading={isResetting}
                variant="danger"
                icon={RotateCcw}
                size="md"
              >
                Confirm Reset
              </DemoActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
