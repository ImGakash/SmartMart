import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { apiGet } from '../api/client.js';
import Price from '../components/Price.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import ProofPanel from '../components/ProofPanel.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import {
  CheckCircle2,
  Mail,
  Search,
  Store,
  User,
  Clock,
  ArrowRight,
  AlertCircle,
  Copy,
  Sparkles,
  Radio,
  Layers,
  Inbox,
  Check,
  Package
} from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();

  const isReplayed = Boolean(location.state?.replayed);

  const [order, setOrder] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isIndexedDone, setIsIndexedDone] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Raw SSE log: newest first
  const [rawEventLog, setRawEventLog] = useState([]);
  const [duplicateSkippedCount, setDuplicateSkippedCount] = useState(0);
  const [indexedCount, setIndexedCount] = useState(0);

  // Fetch Order Details
  const fetchOrder = useCallback(async () => {
    try {
      const data = await apiGet(`/orders/${id}`);
      setOrder(data);
    } catch (err) {
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const notifs = await apiGet(`/orders/${id}/notifications`);
      setNotifications(notifs || []);
    } catch (err) {
      console.warn('Failed to load notifications:', err.message);
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
    fetchNotifications();
  }, [fetchOrder, fetchNotifications]);

  const handleStageChange = useCallback((stage, detail) => {
    if (stage === 'NOTIFIED') {
      fetchNotifications();
    }
    if (stage === 'INDEXED') {
      setIsIndexedDone(true);
      setIndexedCount((prev) => prev + 1);
    }
    if (stage === 'DUPLICATE_SKIPPED') {
      setDuplicateSkippedCount((prev) => prev + 1);
    }
  }, [fetchNotifications]);

  const handleRawEvent = useCallback((eventObj) => {
    setRawEventLog((prev) => [eventObj, ...prev]);
  }, []);

  function copyOrderNumber() {
    if (order?.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-saffron border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 font-mono text-sm">Loading order #{id}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="p-4 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-500/50">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Order Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md">{error || 'Order does not exist or has been truncated.'}</p>
        <Link
          to="/"
          className="mt-2 px-5 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-white text-sm font-semibold transition-colors border border-slate-700"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const items = order.items || [];

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Duplicate Replay Detection Banner (Idempotency Proof) */}
      {isReplayed && (
        <div className="bg-sky-950/80 border-2 border-sky-500/80 rounded-2xl p-4 lg:p-5 flex items-center justify-between gap-4 text-sky-200 shadow-xl shadow-sky-950/40 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-wide text-white uppercase font-mono">
                Duplicate request detected — showing your existing order
              </div>
              <div className="text-sm text-sky-200/90 font-medium font-sans">
                Server returned HTTP 200 with matching idempotency key. Zero duplicate stock deductions occurred.
              </div>
            </div>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold uppercase">
            REPLAYED: TRUE
          </span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-ink-800/70 border border-line rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-saffron/15 text-saffron border border-saffron/30 uppercase">
              ORDER TELEMETRY
            </span>
            <span className="text-slate-400 text-xs font-mono">
              Source: <strong className="text-white">{order.source}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl lg:text-4xl font-mono font-black text-white tracking-tight">
              #{order.orderNumber}
            </h1>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="p-1.5 rounded-lg bg-ink-950 border border-slate-700 hover:bg-ink-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Copy Order Number"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <span>Store: <strong className="text-slate-200">{order.storeCode}</strong> ({order.storeCity})</span>
            <span>•</span>
            <span>Customer: <strong className="text-slate-200">{order.customerName || 'Walk-in'}</strong></span>
            <span>•</span>
            <span>Date: <strong className="text-slate-200">{new Date(order.createdAt).toLocaleTimeString()}</strong></span>
          </div>
        </div>

        <div className="bg-ink-950 border border-slate-800 rounded-2xl p-4 text-right min-w-[200px]">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-1">
            Total Charged
          </span>
          <Price paise={order.totalPaise} className="text-3xl font-black font-mono text-saffron-bright" />
        </div>
      </div>

      {/* Main Grid: Left (7 cols) = Items & Notifications; Right (5 cols) = OrderTimeline & ProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items & Customer Notifications */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Order Items Table */}
          <div className="bg-ink-800/70 border border-line rounded-3xl p-6 shadow-xl flex flex-col gap-4 backdrop-blur-md">
            <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
              <Package className="w-4 h-4 text-saffron" />
              <span>Purchased Line Items</span>
            </h2>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-ink-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-ink-900/80 text-[10px] text-slate-400 uppercase">
                    <th className="py-2.5 px-3">Product SKU</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-ink-900/50">
                      <td className="py-3 px-3 text-saffron font-bold">{item.sku}</td>
                      <td className="py-3 px-3 text-slate-200">{item.name}</td>
                      <td className="py-3 px-3 text-center font-bold text-white">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-black text-white">
                        <Price paise={item.pricePaise * item.quantity} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Notifications (Deduplicated Consumer) */}
          <div className="bg-ink-800/70 border border-line rounded-3xl p-6 shadow-xl flex flex-col gap-4 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono">
                <Mail className="w-4 h-4 text-sky-400" />
                <span>Simulated Customer Notifications</span>
              </h2>
              <span className="text-xs font-mono text-slate-400">
                Kafka Consumer Deduped
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {notifications.length === 0 ? (
                <div className="p-6 rounded-2xl bg-ink-950 border border-slate-800 text-center text-xs font-mono text-slate-500">
                  Awaiting notification consumer stage from Kafka...
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-2xl bg-ink-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                        {n.channel || 'EMAIL'}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs font-sans">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: OrderTimeline + ProofPanel */}
        <div className="lg:col-span-5 flex flex-col gap-6 sticky top-24">
          <OrderTimeline
            orderId={id}
            totalItems={items.length}
            onStageChange={handleStageChange}
            onRawEvent={handleRawEvent}
            source={order.source}
          />

          {/* Order Proof Telemetry & Event Log */}
          <ProofPanel
            title="Kafka Outbox & Dedup Proof"
            service="Kafka"
            action={`GET /orders/${id}/events`}
            proof="4 Stages + Idempotent Skip"
          >
            {/* Counts */}
            <div className="grid grid-cols-3 gap-2 font-mono text-xs text-center">
              <div className="p-2.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase">Notified</span>
                <span className="text-lg font-black text-sky-400">{notifications.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase">Dedup Skip</span>
                <span className="text-lg font-black text-amber-400">{duplicateSkippedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase">Indexed</span>
                <span className="text-lg font-black text-emerald-400">{indexedCount}</span>
              </div>
            </div>

            {/* Live SSE Raw Payload Stream */}
            <JsonViewer
              data={rawEventLog}
              title={`Raw SSE Payload Stream (${rawEventLog.length} events)`}
              defaultOpen={true}
              maxHeight="max-h-60"
            />
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
