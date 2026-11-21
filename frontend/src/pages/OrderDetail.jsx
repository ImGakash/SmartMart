import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { apiGet } from '../api/client.js';
import Price from '../components/Price.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import ProductImage from '../components/ProductImage.jsx';
import {
  CheckCircle2,
  Mail,
  Store,
  User,
  Clock,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  Package,
  ChevronDown,
  ChevronUp,
  Database,
  Radio,
  MapPin,
  CheckCircle
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

  // Customer-facing tracking stage state
  const [highestStage, setHighestStage] = useState('COMMITTED');

  // Collapsible technical proof section (default collapsed)
  const [proofOpen, setProofOpen] = useState(false);

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

  const handleStageChange = useCallback(
    (stage, detail) => {
      if (stage === 'NOTIFIED') {
        fetchNotifications();
        setHighestStage('NOTIFIED');
      } else if (stage === 'INDEXED') {
        setIsIndexedDone(true);
        setIndexedCount((prev) => prev + 1);
        setHighestStage('INDEXED');
      } else if (stage === 'OUTBOX_PUBLISHED') {
        setHighestStage((prev) => (prev === 'NOTIFIED' || prev === 'INDEXED' ? prev : 'OUTBOX_PUBLISHED'));
      }

      if (stage === 'DUPLICATE_SKIPPED') {
        setDuplicateSkippedCount((prev) => prev + 1);
      }
    },
    [fetchNotifications]
  );

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
      <div className="bg-white border border-slate-200/80 rounded-xl p-16 flex flex-col items-center justify-center gap-3 shadow-2xs">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Loading order #{id}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-12 flex flex-col items-center justify-center gap-3 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md">{error || 'Order does not exist or has expired.'}</p>
        <Link
          to="/"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-100"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const placedDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Just now';

  // Tracking stepper states
  const isConfirmed = true; // DB committed
  const isProcessing = highestStage === 'OUTBOX_PUBLISHED' || highestStage === 'NOTIFIED' || highestStage === 'INDEXED';
  const isReady = highestStage === 'INDEXED';

  return (
    <div className="flex flex-col gap-4">
      {/* Duplicate Replay Detection Banner (Idempotency Proof) */}
      {isReplayed && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <span className="font-semibold block text-indigo-950">
                Duplicate request safely recognized — displaying existing order
              </span>
              <span className="text-indigo-700">
                Server matched idempotent token in 200 OK response. No redundant inventory deduction occurred.
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900 font-bold uppercase">
            REPLAYED: TRUE
          </span>
        </div>
      )}

      {/* Top Order Confirmation Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 md:p-6 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">Order Confirmed</h1>
              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                #{order.orderNumber}
              </span>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Copy order number"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span>Placed on {placedDate}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-700">
                <Mail className="w-3 h-3 text-indigo-600" />
                Receipt sent to <strong>{order.customerEmail || 'customer'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="text-left md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 w-full md:w-auto">
          <span className="text-xs text-slate-400 block">Total Amount Paid</span>
          <Price paise={order.totalPaise} className="text-lg font-bold text-slate-900" />
        </div>
      </div>

      {/* Modern Connected Step Progress Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 md:p-6 shadow-2xs">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Fulfillment Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Step 1: Confirmed */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-200">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-slate-900 block">Order Committed</span>
              <span className="text-[11px] text-slate-500">
                PostgreSQL ACID transaction completed
              </span>
            </div>
          </div>

          {/* Step 2: Processing */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isProcessing
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-200'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-slate-900 block">
                {isProcessing ? 'Dispatched to Outbox' : 'Processing Outbox'}
              </span>
              <span className="text-[11px] text-slate-500">
                Kafka publisher relayed event
              </span>
            </div>
          </div>

          {/* Step 3: Ready */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isReady
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-200'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-slate-900 block">
                {isReady ? 'Synchronized & Ready' : 'Synchronizing Store Stock'}
              </span>
              <span className="text-[11px] text-slate-500">
                OpenSearch inventory reconciled
              </span>
            </div>
          </div>
        </div>

        {/* Duplicate skipped alert row */}
        {duplicateSkippedCount > 0 && (
          <div className="mt-4 p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 text-xs text-amber-900 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Kafka redelivery detected — duplicate event safely skipped by consumer
            </span>
            <span className="font-mono text-[11px] font-bold">
              Skipped: {duplicateSkippedCount}
            </span>
          </div>
        )}
      </div>

      {/* 2-Column: Left = Items, Right = Delivery Store & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (8 cols): Ordered Items */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-100 shadow-2xs">
          <div className="p-3 bg-slate-50/70 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl">
            Items in this order ({items.length})
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-lg border border-slate-100 p-1 bg-slate-50/70 shrink-0 flex items-center justify-center overflow-hidden">
                <ProductImage
                  src={item.imageUrl}
                  alt={item.name}
                  category={item.category}
                  sku={item.sku}
                  loading="lazy"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                  {item.name}
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>Quantity: <strong className="text-slate-800">{item.quantity}</strong></span>
                  <span>•</span>
                  <span>Price: <Price paise={item.unitPricePaise} className="text-slate-800" /></span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">Subtotal</span>
                <Price paise={item.subtotalPaise} className="text-sm font-bold text-slate-900" />
              </div>
            </div>
          ))}
        </div>

        {/* Right (4 cols): Delivery Store & Price Summary */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex flex-col gap-3 text-xs">
            <span className="font-semibold text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
              Delivery Information
            </span>

            <div className="flex items-start gap-2.5 text-slate-800">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-slate-900">{order.customerName || 'Customer'}</span>
                <span className="text-slate-500">
                  Fulfillment Hub: <strong>{order.storeCode}</strong> ({order.storeCity})
                </span>
                <span className="text-slate-500 block mt-0.5">
                  Method: {order.source === 'POS' ? 'Store Counter POS' : 'Online Store Pickup & Delivery'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <Price paise={order.totalPaise} />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charges</span>
                <span className="text-emerald-700 font-semibold">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-dashed border-slate-200">
                <span>Total Paid</span>
                <Price paise={order.totalPaise} className="text-lg text-slate-900" />
              </div>
            </div>

            <Link
              to="/"
              className="mt-2 w-full h-[40px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs shadow-indigo-100"
            >
              <span>Continue Shopping</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* KEEP Technical X-Ray Section inside COLLAPSED expandable section (Demo Proof) */}
      <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>View System Processing Details (Demo Proof)</span>
            <span className="font-mono text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full font-bold">
              SSE Event Stream
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            {proofOpen ? 'Hide Technical X-Ray' : 'Show Technical X-Ray'}
            {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {proofOpen && (
          <div className="p-4 border-t border-slate-100 flex flex-col gap-4 text-xs">
            {/* Live SSE Timeline Hook */}
            <OrderTimeline
              orderId={id}
              totalItems={items.length}
              onStageChange={handleStageChange}
              onRawEvent={handleRawEvent}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">NOTIFICATIONS (PG)</span>
                <span className="font-bold text-slate-800">{notifications.length} logged</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">DUPLICATES SKIPPED</span>
                <span className="font-bold text-slate-800">{duplicateSkippedCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">OPENSEARCH SYNCED</span>
                <span className="font-bold text-slate-800">{isIndexedDone ? 'YES' : 'PENDING'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">REPLAY DETECTED</span>
                <span className="font-bold text-slate-800">{String(isReplayed)}</span>
              </div>
            </div>

            {/* Raw JSON event stream */}
            {rawEventLog.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-slate-400 block mb-1">
                  LIVE SSE EVENTS LOG (NEWEST FIRST):
                </span>
                <JsonViewer data={rawEventLog} defaultExpanded={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
