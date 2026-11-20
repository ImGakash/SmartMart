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
  Inbox
} from 'lucide-react';

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();

  // Check if this was a replayed idempotent request
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

  // Stage changes from OrderTimeline
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

  // Collect raw SSE events
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
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
          className="mt-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const primaryItemName = items[0]?.productId ? 'boAt' : 'item';

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
              <div className="text-sm text-sky-200/90 font-medium">
                Server returned HTTP 200 with matching idempotency key. Zero duplicate stock deductions occurred.
              </div>
            </div>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold uppercase">
            REPLAYED: TRUE
          </span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-slate-400 uppercase tracking-wider font-bold">
              Order Confirmed
            </span>

            {/* Source Badge */}
            {order.source === 'ONLINE' ? (
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                SOURCE: ONLINE
              </span>
            ) : (
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                SOURCE: POS_STORE
              </span>
            )}

            {/* Status Badge */}
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {order.status || 'CONFIRMED'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl lg:text-4xl font-extrabold font-mono text-white tracking-tight">
              {order.orderNumber}
            </h1>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Copy Order Number"
            >
              <Copy className="w-4 h-4" />
            </button>
            {copiedId && (
              <span className="text-xs font-mono text-emerald-400">Copied!</span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Placed: {new Date(order.createdAt).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Order Grand Total */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 min-w-[220px] text-right">
          <div className="text-xs text-slate-400 uppercase font-mono font-bold mb-1">
            Total Paid (Paise ÷ 100)
          </div>
          <Price
            paise={order.totalPaise}
            className="text-3xl font-extrabold text-white"
          />
        </div>
      </div>

      {/* Main Grid: Details & Live Event Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Order Summary & Notifications (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
              <User className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Customer</span>
                <span className="text-sm font-bold text-white">
                  {order.customer?.name || 'Walk-in Customer'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {order.customer?.email || 'N/A (POS)'}
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
              <Store className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Store Hub</span>
                <span className="text-sm font-bold text-white">
                  {order.store?.storeCode || 'BLR-01'} — {order.store?.city || 'Bengaluru'}
                </span>
                <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
                  ID: {order.storeId}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <h3 className="text-base font-extrabold text-white pb-3 border-b border-slate-800 flex items-center justify-between">
              <span>Order Items ({items.length})</span>
              <span className="text-xs font-mono text-slate-400">Snapshot Unit Prices</span>
            </h3>

            <div className="flex flex-col divide-y divide-slate-800">
              {items.map((item, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-white font-mono">
                      Product ID: {item.productId}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Qty: {item.quantity} × <Price paise={item.unitPricePaise} />
                    </span>
                  </div>

                  <Price
                    paise={item.subtotalPaise}
                    className="text-base font-extrabold text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Customer Notifications Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-extrabold text-white">
                  Customer Notifications
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                GET /orders/{id}/notifications
              </span>
            </div>

            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs font-mono text-slate-500">
                Waiting for NOTIFIED consumer event...
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                        {n.channel}
                      </span>
                      <span className="text-slate-500">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed font-sans">
                      {n.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Order Timeline SSE & Proof Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <OrderTimeline
            orderId={id}
            totalItems={items.length}
            source={order.source}
            onStageChange={handleStageChange}
            onRawEvent={handleRawEvent}
          />

          {/* Action After INDEXED Completes: "Verify in search" */}
          {isIndexedDone && (
            <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-500/80 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>Search Document Synchronized</span>
              </div>
              <h4 className="text-lg font-bold text-white">
                Live OpenSearch Indexing Complete!
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kafka consumers processed the inventory decrement and pushed the new stock to OpenSearch in &lt; 2 seconds.
              </p>
              <Link
                to={`/?q=boAt`}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <span>Verify in Search</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* ProofPanel: Notification Count, Duplicates-Skipped Counter, Raw Event Log */}
          <ProofPanel
            title="Async Event Stream Evidence"
            service="Kafka"
            action="GET /orders/:id/events"
            proof="At-Least-Once Consumer Dedup"
          >
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] uppercase text-slate-400 font-bold">Notifs</span>
                <span className="text-xl font-bold text-indigo-400">{notifications.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] uppercase text-slate-400 font-bold">Indexed</span>
                <span className="text-xl font-bold text-emerald-400">{indexedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col">
                <span className="text-[9px] uppercase text-slate-400 font-bold">Dup Skip</span>
                <span className="text-xl font-bold text-amber-400">{duplicateSkippedCount}</span>
              </div>
            </div>

            {/* Raw SSE Event Log (Newest First) */}
            <JsonViewer
              data={rawEventLog.length > 0 ? rawEventLog : { status: 'Listening to SSE stream...' }}
              title={`Raw SSE Event Log (${rawEventLog.length} events)`}
              defaultOpen={rawEventLog.length > 0}
              maxHeight="max-h-60"
            />
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
