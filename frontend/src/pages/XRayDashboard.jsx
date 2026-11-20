import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/client.js';
import { subscribeSSE } from '../api/sse.js';
import { useApp } from '../state/AppContext.jsx';
import Price from '../components/Price.jsx';
import ConsistencyTable from '../components/ConsistencyTable.jsx';
import ChaosSwitch from '../components/ChaosSwitch.jsx';
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
  Server
} from 'lucide-react';

export default function XRayDashboard() {
  const { showToast } = useApp();

  // Metrics bundle state
  const [metrics, setMetrics] = useState(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [sseStatus, setSseStatus] = useState('connecting');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Chaos action loadings
  const [isRequeuing, setIsRequeuing] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

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
          // Fall back to polling every 2s
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
        if (eventType === 'metrics' || data?.dashboard) {
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

    // Also initial fetch immediately to avoid blank screen
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

      // Optimistic update in metrics bundle
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

  if (loadingInitial && !metrics) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 font-mono text-sm">Connecting to X-Ray Telemetry Stream...</span>
      </div>
    );
  }

  const dashboard = metrics?.dashboard || {};
  const outbox = metrics?.outbox || dashboard.outbox || {};
  const consistency = metrics?.consistency?.checks || [];
  const chaos = metrics?.chaos || {};
  const recentOrders = metrics?.recentOrders || [];
  const recentNotifications = metrics?.recentNotifications || [];
  const lowStock = metrics?.lowStock || [];

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Top Banner & SSE Stream Status */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              SYSTEM 10/10 CONSISTENCY MONITOR
            </span>
            <span className="text-slate-400 text-xs font-mono">1s Real-time Pulse</span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-mono font-black tracking-tight text-white uppercase">
            X-RAY ARCHITECTURE DASHBOARD
          </h1>

          <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
            Live telemetry inspecting PostgreSQL source of truth, Kafka outbox drain progress,
            and OpenSearch distributed index invariants under fault injection.
          </p>
        </div>

        {/* Live SSE Stream Badge */}
        <div className="flex flex-col items-end gap-2 bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[220px]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                sseStatus === 'connected'
                  ? 'bg-emerald-500 animate-ping'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="font-mono text-xs font-bold text-white uppercase">
              {sseStatus === 'connected' ? 'STREAM CONNECTED' : 'POLLING FALLBACK'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Last beat: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'syncing…'}
          </div>
        </div>
      </div>

      {/* 1. Key Metric Cards (Large Monospace Numbers for Projector) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Total Orders
          </span>
          <span className="text-4xl font-mono font-black text-white">
            {dashboard.totalOrders ?? 0}
          </span>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-blue-400 font-bold">ON: {dashboard.ordersBySource?.ONLINE ?? 0}</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400 font-bold">POS: {dashboard.ordersBySource?.POS_STORE ?? 0}</span>
          </div>
        </div>

        {/* Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Active Catalog
          </span>
          <span className="text-4xl font-mono font-black text-indigo-400">
            {dashboard.totalProducts ?? 36}
          </span>
          <span className="text-[11px] font-mono text-slate-500">5 Product Categories</span>
        </div>

        {/* Stores */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Physical Hubs
          </span>
          <span className="text-4xl font-mono font-black text-emerald-400">
            {dashboard.totalStores ?? 6}
          </span>
          <span className="text-[11px] font-mono text-slate-500">5 Indian Metro Cities</span>
        </div>

        {/* Notifications */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Notifications
          </span>
          <span className="text-4xl font-mono font-black text-sky-400">
            {dashboard.totalNotifications ?? 0}
          </span>
          <span className="text-[11px] font-mono text-slate-500">Consumer Deduped</span>
        </div>

        {/* Low Stock SKUs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Low Stock Alerts
          </span>
          <span className="text-4xl font-mono font-black text-amber-400">
            {dashboard.lowStockCount ?? lowStock.length ?? 0}
          </span>
          <span className="text-[11px] font-mono text-amber-500/80">Threshold &le; 3 units</span>
        </div>

        {/* Oldest Pending Outbox */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-2 shadow-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider">
            Oldest Pending
          </span>
          <span
            className={`text-4xl font-mono font-black ${
              (outbox.oldestPendingAgeSeconds ?? 0) > 5 ? 'text-rose-400' : 'text-slate-300'
            }`}
          >
            {outbox.oldestPendingAgeSeconds ?? 0}s
          </span>
          <span className="text-[11px] font-mono text-slate-500">Relay Lease: 10s</span>
        </div>
      </div>

      {/* 2. MATHEMATICAL PROOF: Consistency Table (Most Prominent Panel on the Page) */}
      <ConsistencyTable checks={consistency} />

      {/* 3. Outbox Panel & Chaos Injection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Outbox Pipeline Drain Panel (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-7 shadow-xl flex flex-col gap-6">
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

            <button
              type="button"
              onClick={handleRequeueOutbox}
              disabled={isRequeuing}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-mono font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="POST /admin/outbox/requeue"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRequeuing ? 'animate-spin' : ''}`} />
              <span>Requeue Failed</span>
            </button>
          </div>

          {/* 4 Outbox Stat Blocks with Drain Progress feel */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* PENDING */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
                (outbox.pending ?? 0) > 0
                  ? 'bg-amber-950/70 border-amber-500/70 text-amber-200 shadow-md shadow-amber-950/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
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
              className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
                (outbox.processing ?? 0) > 0
                  ? 'bg-indigo-950/70 border-indigo-500/70 text-indigo-200 shadow-md shadow-indigo-950/50'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">PROCESSING</span>
              <span className="text-3xl font-mono font-black text-indigo-400">
                {outbox.processing ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Lease locked</span>
            </div>

            {/* PUBLISHED */}
            <div className="p-4 rounded-xl border bg-slate-950 border-slate-800 text-slate-300 flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400">PUBLISHED</span>
              <span className="text-3xl font-mono font-black text-emerald-400">
                {outbox.published ?? 0}
              </span>
              <span className="text-[10px] font-mono text-slate-500">Acked by Kafka</span>
            </div>

            {/* FAILED */}
            <div
              className={`p-4 rounded-xl border flex flex-col gap-1 transition-all ${
                (outbox.failed ?? 0) > 0
                  ? 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-md shadow-rose-950/60'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
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

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 leading-relaxed">
            Outbox relay polls every 1000ms using <code className="text-indigo-300">FOR UPDATE SKIP LOCKED</code>.
            Crash recovery auto-reclaims expired leases (&gt;10s) without burning attempt counters.
          </div>
        </div>

        {/* Chaos Engineering Panel (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-7 shadow-xl flex flex-col gap-6">
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

            <button
              type="button"
              onClick={handleFullReindex}
              disabled={isReindexing}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
              title="POST /admin/reindex"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
              <span>Full Reindex</span>
            </button>
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

      {/* 4. Bottom Activity Feeds: Recent Orders & Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Recent Orders (Last 10) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
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
                    <tr key={o.id} className="hover:bg-slate-800/40">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
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
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
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
    </div>
  );
}
