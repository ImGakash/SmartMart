import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { apiGet } from '../api/client.js';
import Price from '../components/Price.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
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
      <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-16 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#2874F0] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-[#878787]">Loading order #{id}...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-12 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-[#212121]">Order Not Found</h2>
        <p className="text-xs text-[#878787] max-w-md">{error || 'Order does not exist or has expired.'}</p>
        <Link
          to="/"
          className="px-4 py-2 bg-[#2874F0] text-white rounded-[6px] text-xs font-semibold hover:bg-[#1C5BC8] transition-colors"
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
        <div className="bg-sky-50 border border-sky-200 rounded-[6px] p-3 flex items-center justify-between gap-3 text-xs text-sky-900 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2874F0] shrink-0" />
            <div>
              <span className="font-semibold block">
                Duplicate request detected — showing your existing order
              </span>
              <span className="text-sky-700">
                Server returned HTTP 200 with matching idempotency key. Zero duplicate stock deductions occurred.
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sky-200 text-sky-800 font-bold uppercase">
            REPLAYED: TRUE
          </span>
        </div>
      )}

      {/* Top Flipkart Confirmation Card */}
      <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-4 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 text-[#388E3C] flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-[#388E3C]">Order Confirmed</h1>
              <span className="font-mono text-xs font-semibold text-[#212121] bg-gray-100 px-2 py-0.5 rounded">
                #{order.orderNumber}
              </span>
              <button
                type="button"
                onClick={copyOrderNumber}
                className="text-gray-400 hover:text-gray-600 p-0.5"
                title="Copy order number"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#388E3C]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-xs text-[#878787] mt-1 flex flex-wrap items-center gap-2">
              <span>Placed on {placedDate}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#212121]">
                <Mail className="w-3 h-3 text-[#2874F0]" />
                Confirmation sent to <strong>{order.customerEmail || 'customer email'}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="text-left md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-[#E0E0E0] w-full md:w-auto">
          <span className="text-xs text-[#878787] block">Total Amount</span>
          <Price paise={order.totalPaise} className="text-lg font-bold text-[#212121]" />
        </div>
      </div>

      {/* Clean Flipkart-style Horizontal Stepper */}
      <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-4 md:p-6 shadow-sm">
        <h2 className="text-base font-semibold text-[#212121] mb-4">Order Status & Tracking</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Step 1: Confirmed */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#388E3C] text-white flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-[#212121] block">Order Confirmed</span>
              <span className="text-[11px] text-[#878787]">
                PostgreSQL ACID transaction committed
              </span>
            </div>
          </div>

          {/* Step 2: Processing */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isProcessing
                  ? 'bg-[#388E3C] text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-[#212121] block">
                {isProcessing ? 'Processed & Notified' : 'Processing'}
              </span>
              <span className="text-[11px] text-[#878787]">
                Kafka Outbox relay dispatched event
              </span>
            </div>
          </div>

          {/* Step 3: Ready */}
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isReady
                  ? 'bg-[#388E3C] text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-xs text-[#212121] block">
                {isReady ? 'Ready for Pickup / Delivery' : 'Preparing Store Stock'}
              </span>
              <span className="text-[11px] text-[#878787]">
                OpenSearch inventory synchronized
              </span>
            </div>
          </div>
        </div>

        {/* Duplicate skipped alert row */}
        {duplicateSkippedCount > 0 && (
          <div className="mt-4 p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Kafka redelivered — duplicate skipped safely by consumer group
            </span>
            <span className="font-mono text-[11px] font-bold">
              Duplicates skipped: {duplicateSkippedCount}
            </span>
          </div>
        )}
      </div>

      {/* 2-Column: Left = Items, Right = Delivery Store & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left (8 cols): Ordered Items */}
        <div className="lg:col-span-8 bg-white border border-[#E0E0E0] rounded-[6px] divide-y divide-[#E0E0E0] shadow-sm">
          <div className="p-3 bg-gray-50 text-xs font-semibold text-[#878787] uppercase tracking-wider">
            Items in this order ({items.length})
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-[4px] border border-[#E0E0E0] p-1 bg-white shrink-0 flex items-center justify-center">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80';
                  }}
                />
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <h4 className="text-sm font-medium text-[#212121] leading-snug">
                  {item.name}
                </h4>
                <div className="flex items-center gap-3 text-xs text-[#878787] mt-1">
                  <span>Qty: <strong className="text-[#212121]">{item.quantity}</strong></span>
                  <span>•</span>
                  <span>Unit Price: <Price paise={item.unitPricePaise} className="text-[#212121]" /></span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-[#878787] block">Subtotal</span>
                <Price paise={item.subtotalPaise} className="text-sm font-bold text-[#212121]" />
              </div>
            </div>
          ))}
        </div>

        {/* Right (4 cols): Delivery Store & Price Summary */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-4 shadow-sm flex flex-col gap-3 text-xs">
            <span className="font-semibold text-xs text-[#878787] uppercase tracking-wider pb-2 border-b border-[#E0E0E0]">
              Delivery Details
            </span>

            <div className="flex items-start gap-2 text-[#212121]">
              <MapPin className="w-4 h-4 text-[#2874F0] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">{order.customerName || 'Customer'}</span>
                <span className="text-[#878787]">
                  Fulfillment Store: <strong>{order.storeCode}</strong> ({order.storeCity})
                </span>
                <span className="text-[#878787] block mt-0.5">
                  Method: {order.source === 'POS' ? 'Store Counter POS' : 'Online Store Pickup / Delivery'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E0E0E0] flex flex-col gap-1.5">
              <div className="flex justify-between text-[#878787]">
                <span>Items Subtotal</span>
                <Price paise={order.totalPaise} />
              </div>
              <div className="flex justify-between text-[#878787]">
                <span>Delivery Charges</span>
                <span className="text-[#388E3C] font-semibold">FREE</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#212121] pt-2 border-t border-dashed border-[#E0E0E0]">
                <span>Total Paid</span>
                <Price paise={order.totalPaise} className="text-lg text-[#212121]" />
              </div>
            </div>

            <Link
              to="/"
              className="mt-2 w-full h-[38px] px-4 rounded-[6px] bg-[#2874F0] hover:bg-[#1C5BC8] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span>Continue Shopping</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* KEEP Technical X-Ray Section inside COLLAPSED expandable section (Demo Proof) */}
      <div className="border border-[#E0E0E0] rounded-[6px] bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#878787] hover:text-[#212121] bg-gray-50/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#2874F0]" />
            <span>View system processing details (demo proof)</span>
            <span className="font-mono text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded">
              SSE Event Stream
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            {proofOpen ? 'Hide Technical X-Ray' : 'Show Technical X-Ray'}
            {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {proofOpen && (
          <div className="p-4 border-t border-[#E0E0E0] flex flex-col gap-4 text-xs">
            {/* Live SSE Timeline Hook */}
            <OrderTimeline
              orderId={id}
              totalItems={items.length}
              onStageChange={handleStageChange}
              onRawEvent={handleRawEvent}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[11px]">
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">NOTIFICATIONS (PG)</span>
                <span className="font-bold text-[#212121]">{notifications.length} logged</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">DUPLICATES SKIPPED</span>
                <span className="font-bold text-[#212121]">{duplicateSkippedCount}</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">OPENSEARCH SYNCED</span>
                <span className="font-bold text-[#212121]">{isIndexedDone ? 'YES' : 'PENDING'}</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">REPLAY DETECTED</span>
                <span className="font-bold text-[#212121]">{String(isReplayed)}</span>
              </div>
            </div>

            {/* Raw JSON event stream */}
            {rawEventLog.length > 0 && (
              <div>
                <span className="text-[10px] font-mono text-gray-400 block mb-1">
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
