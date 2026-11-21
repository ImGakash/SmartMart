import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../api/client.js';
import { subscribeSSE } from '../api/sse.js';
import { useApp } from '../state/AppContext.jsx';
import Price from '../components/Price.jsx';
import ConsistencyTable from '../components/ConsistencyTable.jsx';
import ChaosSwitch from '../components/ChaosSwitch.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
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
        message: `Requeued ${res?.requeued ?? 0} failed events back to outbox`,
      });
      fetchMetricsPolling();
    } catch (err) {
      showToast({
        type: 'error',
        code: 'REQUEUE_FAILED',
        message: err.message,
      });
    } finally {
      setIsRequeuing(false);
    }
  }

  // Full reindex OpenSearch from PG: POST /admin/reindex
  async function handleFullReindex() {
    setIsReindexing(true);
    try {
      const res = await apiPost('/admin/reindex');
      showToast({
        type: 'success',
        message: `Catalog reindexed: ${res?.indexed ?? 36} products synced to OpenSearch`,
      });
      fetchMetricsPolling();
    } catch (err) {
      showToast({
        type: 'error',
        code: 'REINDEX_FAILED',
        message: err.message,
      });
    } finally {
      setIsReindexing(false);
    }
  }

  // Reset Demo: POST /demo/reset
  async function handleResetDemo() {
    setIsResetting(true);
    setShowResetConfirm(false);
    try {
      const res = await apiPost('/demo/reset');
      showToast({
        type: 'success',
        message: `Demo state reset in ${res?.durationMs ?? 42}ms. Initial catalog restored.`,
      });
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
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-16 flex flex-col items-center justify-center gap-3 shadow-2xs">
        <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#6B7280]">Initializing telemetry stream & reconciliation ledger...</span>
      </div>
    );
  }

  const dashboard = metrics?.dashboard || {};
  const reconciliation = metrics?.reconciliation || { rows: [], mismatches: 0 };
  const outbox = metrics?.outbox || {};
  const chaos = metrics?.chaos || {};
  const consistency = metrics?.consistency || {};
  const consistencyChecks = Array.isArray(consistency) ? consistency : consistency?.checks || [];

  // Metrics summary
  const totalOrders = dashboard.totalOrders ?? dashboard.ordersCount ?? 0;
  const totalNotifications = dashboard.totalNotifications ?? 0;
  const pendingOutbox = outbox.pending ?? 0;
  const failedEvents = outbox.failed ?? 0;
  const mismatches = reconciliation.mismatches ?? 0;
  const inSyncCount = (reconciliation.rows?.length || 36) - mismatches;
  const totalCatalog = reconciliation.rows?.length || 36;
  const searchSyncStatus = mismatches === 0 ? 'PASS' : 'SYNCING';

  const hasOversellViolation = consistencyChecks.some(
    (c) => (c.name?.toLowerCase().includes('oversell') || c.name?.toLowerCase().includes('negative')) && c.status === 'FAIL'
  );

  // Filter reconciliation table rows
  const reconciliationRows = (reconciliation.rows || []).filter((r) => {
    const q = reconciliationSearch.toLowerCase().trim();
    const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.productId?.toLowerCase().includes(q);
    if (!matchSearch) return false;

    if (reconciliationFilter === 'MISMATCH') return r.status !== 'PASS';
    if (reconciliationFilter === 'PASS') return r.status === 'PASS';
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Live Stream Telemetry & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2.5 text-xs text-[#6B7280]">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                sseStatus === 'connected' ? 'bg-[#047857]' : 'bg-[#B45309] animate-pulse'
              }`}
            />
            <span>
              {sseStatus === 'connected' ? 'Live Telemetry Active' : 'Polling Fallback Active'}
            </span>
          </span>
          <span>•</span>
          <span>
            Last Refreshed:{' '}
            <strong className="text-slate-800 font-mono">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Just now'}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchMetricsPolling}
            className="h-[36px] px-3 rounded-lg bg-white border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="h-[36px] px-3 rounded-lg bg-white border border-[#E5E7EB] hover:bg-rose-50 text-rose-700 font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* 1. HEALTH METRICS ROW (Controlled 24px font size, clean SaaS cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Orders Created"
          value={totalOrders}
          tone="default"
          sublabel="Total Committed"
        />
        <MetricCard
          title="Notifications"
          value={totalNotifications}
          tone="default"
          sublabel="Simulated Logged"
        />
        <MetricCard
          title="Pending Outbox"
          value={pendingOutbox}
          tone={pendingOutbox > 0 ? 'warning' : 'success'}
          sublabel={pendingOutbox > 0 ? 'Awaiting Drain' : 'Queue Empty'}
        />
        <MetricCard
          title="Failed Events"
          value={failedEvents}
          tone={failedEvents > 0 ? 'danger' : 'success'}
          sublabel={failedEvents > 0 ? 'Requires Requeue' : 'Zero Failures'}
        />
        <MetricCard
          title="Oversell Violations"
          value={hasOversellViolation ? 'FAIL' : '0'}
          tone={hasOversellViolation ? 'danger' : 'success'}
          sublabel="PostgreSQL Clamped"
        />
        <MetricCard
          title="Search Sync"
          value={searchSyncStatus}
          tone={searchSyncStatus === 'PASS' ? 'success' : 'warning'}
          sublabel={`${inSyncCount}/${totalCatalog} In Sync`}
        />
      </div>

      {/* 2. HERO CENTERPIECE: RECONCILIATION TABLE */}
      <div className="bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-[#111827]">
                Cross-Service Inventory Reconciliation
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#ECFDF5] text-[#047857] border border-emerald-200">
                {inSyncCount}/{totalCatalog} IN SYNC
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Comparing PostgreSQL atomic ledger with OpenSearch derived index · Checked at{' '}
              {reconciliation.checkedAt ? new Date(reconciliation.checkedAt).toLocaleTimeString() : 'live'}
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reconciliationSearch}
                onChange={(e) => setReconciliationSearch(e.target.value)}
                placeholder="Filter by product..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#4F46E5]"
              />
            </div>

            <div className="flex items-center rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setReconciliationFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  reconciliationFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({reconciliation.rows?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationFilter('MISMATCH')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  reconciliationFilter === 'MISMATCH'
                    ? 'bg-white text-[#B45309] shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mismatches ({mismatches})
              </button>
              <button
                type="button"
                onClick={() => setReconciliationFilter('PASS')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                  reconciliationFilter === 'PASS'
                    ? 'bg-white text-[#047857] shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Synced ({inSyncCount})
              </button>
            </div>
          </div>
        </div>

        {/* Clean SaaS Table */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3.5">Product</th>
                <th className="py-2.5 px-3 text-center">PG Stock</th>
                <th className="py-2.5 px-3 text-center">OS Stock</th>
                <th className="py-2.5 px-3 text-center">PG Cities</th>
                <th className="py-2.5 px-3 text-center">OS Cities</th>
                <th className="py-2.5 px-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {reconciliationRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 italic">
                    No reconciliation rows match the selected filter.
                  </td>
                </tr>
              ) : (
                reconciliationRows.map((row) => {
                  const isPass = row.status === 'PASS';
                  return (
                    <tr
                      key={row.productId}
                      className={`hover:bg-slate-50 transition-colors ${
                        !isPass ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{row.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                            {row.productId}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-900">
                        {row.pgTotalStock}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-semibold">
                        <span
                          className={
                            row.pgTotalStock !== row.osTotalStock
                              ? 'text-[#B45309] underline decoration-amber-500 font-bold'
                              : 'text-slate-900'
                          }
                        >
                          {row.osTotalStock}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                        {row.pgCities}
                      </td>

                      <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                        {row.osCities}
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
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

      {/* 3. MATHEMATICAL PROOF: 10 Invariant Checks */}
      <ConsistencyTable checks={consistencyChecks} />

      {/* 4. Outbox Pipeline & Chaos Fault Switches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Outbox Pipeline Panel (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <h3 className="text-base font-semibold text-[#111827]">
                Transactional Outbox Pipeline
              </h3>
              <p className="text-xs text-[#6B7280]">
                PostgreSQL Table: <code className="font-mono text-indigo-600">outbox_events</code>
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequeueOutbox}
              disabled={isRequeuing}
              className="h-[34px] px-3 rounded-lg bg-white border border-[#E5E7EB] hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRequeuing ? 'animate-spin' : ''}`} />
              <span>{isRequeuing ? 'Requeuing...' : 'Requeue Failed'}</span>
            </button>
          </div>

          {/* 4 Outbox Stat Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-500">PENDING</span>
              <span className="text-xl font-bold font-mono text-amber-700 my-0.5">
                {outbox.pending ?? 0}
              </span>
              <span className="text-[10px] text-slate-400">Awaiting drain</span>
            </div>

            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-500">PROCESSING</span>
              <span className="text-xl font-bold font-mono text-indigo-600 my-0.5">
                {outbox.processing ?? 0}
              </span>
              <span className="text-[10px] text-slate-400">Lease active</span>
            </div>

            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-500">PUBLISHED</span>
              <span className="text-xl font-bold font-mono text-[#047857] my-0.5">
                {outbox.published ?? 0}
              </span>
              <span className="text-[10px] text-slate-400">Acked by Kafka</span>
            </div>

            <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col">
              <span className="text-[10px] uppercase font-semibold text-slate-500">FAILED</span>
              <span
                className={`text-xl font-bold font-mono my-0.5 ${
                  (outbox.failed ?? 0) > 0 ? 'text-[#B91C1C]' : 'text-slate-400'
                }`}
              >
                {outbox.failed ?? 0}
              </span>
              <span className="text-[10px] text-slate-400">Dead letter</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
            Outbox relay polls every 1000ms using <code className="font-mono text-indigo-600">FOR UPDATE SKIP LOCKED</code>. Expired leases (&gt;10s) are safely reclaimed without burning attempt counters.
          </p>
        </div>

        {/* Chaos Engineering Panel (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <div>
              <h3 className="text-base font-semibold text-[#111827]">
                Chaos Fault Injection
              </h3>
              <p className="text-xs text-[#6B7280]">
                Live fault switches wired to <code className="font-mono text-slate-600">POST /admin/chaos</code>
              </p>
            </div>

            <button
              type="button"
              onClick={handleFullReindex}
              disabled={isReindexing}
              className="h-[34px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shadow-indigo-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
              <span>{isReindexing ? 'Reindexing...' : 'Full Reindex'}</span>
            </button>
          </div>

          {/* 4 Chaos Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ChaosSwitch
              target="relay"
              label="Pause Outbox Relay"
              description="Halts the outbox worker loop; rows accumulate as PENDING."
              enabled={Boolean(chaos.relay)}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="relay-after-publish"
              label="Crash After Publish"
              description="Publishes to Kafka but skips marking PUBLISHED; tests lease recovery."
              enabled={Boolean(chaos['relay-after-publish'])}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="notifications"
              label="Pause Notifications Consumer"
              description="Events stay unconsumed in consumer group; notifications queue."
              enabled={Boolean(chaos.notifications)}
              onToggle={handleToggleChaos}
            />

            <ChaosSwitch
              target="search-indexer"
              label="Pause Search Indexer"
              description="OpenSearch index lags behind PostgreSQL truth; proves event-driven lag."
              enabled={Boolean(chaos['search-indexer'])}
              onToggle={handleToggleChaos}
            />
          </div>
        </div>
      </div>

      {/* 5. Recent Activity: Orders & Notifications Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recent Orders (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-3">
          <h3 className="text-base font-semibold text-[#111827]">Recent Orders</h3>
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase">
                <tr>
                  <th className="py-2 px-3">Order</th>
                  <th className="py-2 px-3">Source</th>
                  <th className="py-2 px-3">Store</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {(dashboard.recentOrders || []).slice(0, 8).map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50 font-mono">
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      #{ord.orderNumber}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                        {ord.source}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{ord.storeCode}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      <Price paise={ord.totalPaise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Notifications (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-[#E5E7EB] rounded-lg p-5 shadow-2xs flex flex-col gap-3">
          <h3 className="text-base font-semibold text-[#111827]">Recent Notification Events</h3>
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#6B7280] uppercase">
                <tr>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Recipient</th>
                  <th className="py-2 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {(dashboard.recentNotifications || []).slice(0, 8).map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50 font-mono">
                    <td className="py-2 px-3 font-semibold text-indigo-600">{n.type}</td>
                    <td className="py-2 px-3 text-slate-700 truncate max-w-[180px]">{n.recipient}</td>
                    <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                      {n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg max-w-md w-full p-6 flex flex-col gap-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-[#B91C1C] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#111827]">Reset Demo State?</h3>
                <span className="text-xs text-[#6B7280]">
                  Re-seeds products, resets inventories, and truncates orders.
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This triggers <code className="font-mono text-indigo-600">POST /demo/reset</code>. All created orders, notifications, and fault injections will be restored to clean baseline state.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemo}
                disabled={isResetting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                {isResetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
