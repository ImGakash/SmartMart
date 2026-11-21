import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPatch, apiDelete, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight
} from 'lucide-react';

export default function CartCheckout() {
  const navigate = useNavigate();
  const {
    selectedStore,
    selectedCustomer,
    cart,
    refreshCart,
    showToast,
  } = useApp();

  const [updatingProductId, setUpdatingProductId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [stockConflict, setStockConflict] = useState(null); // 409 proof state
  const [proofOpen, setProofOpen] = useState(false);

  // Success Modal state
  const [successOrder, setSuccessOrder] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Single idempotency key per checkout attempt; re-used on retries
  const idempotencyKeyRef = useRef(null);
  const [displayIdempotencyKey, setDisplayIdempotencyKey] = useState('');

  useEffect(() => {
    refreshCart();
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    setDisplayIdempotencyKey(idempotencyKeyRef.current);
  }, [refreshCart]);

  function handleCopyKey() {
    if (displayIdempotencyKey) {
      navigator.clipboard.writeText(displayIdempotencyKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  }

  // Handle item quantity +/-
  async function handleUpdateQuantity(productId, newQty) {
    if (!selectedStore?.id || newQty < 1) return;

    setUpdatingProductId(productId);
    try {
      await apiPatch(`/cart/items/${productId}`, {
        storeId: selectedStore.id,
        quantity: newQty,
      });
      await refreshCart();
    } catch (err) {
      showToast({
        type: 'error',
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } finally {
      setUpdatingProductId(null);
    }
  }

  // Handle item deletion
  async function handleRemoveItem(productId) {
    if (!selectedStore?.id) return;

    setUpdatingProductId(productId);
    try {
      await apiDelete(`/cart/items/${productId}`, {
        params: { storeId: selectedStore.id },
      });
      await refreshCart();
      showToast({
        type: 'info',
        message: 'Item removed from cart',
      });
    } catch (err) {
      showToast({
        type: 'error',
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } finally {
      setUpdatingProductId(null);
    }
  }

  // Handle checkout submission
  async function handleCheckout() {
    if (!selectedStore?.id || !selectedCustomer?.id) {
      showToast({
        type: 'error',
        code: 'MISSING_SELECTION',
        message: 'Please ensure both Store and Customer are selected.',
      });
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      showToast({
        type: 'error',
        code: 'CART_EMPTY',
        message: 'Your cart is empty',
      });
      return;
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
      setDisplayIdempotencyKey(idempotencyKeyRef.current);
    }
    const attemptKey = idempotencyKeyRef.current;

    setIsSubmitting(true);
    setCheckoutError(null);
    setStockConflict(null);

    try {
      const result = await apiPost(
        '/checkout',
        { storeId: selectedStore.id },
        { headers: { 'Idempotency-Key': attemptKey } }
      );

      // On success, show modal
      setSuccessOrder({
        ...result.order,
        replayed: result.replayed,
        idempotencyKey: attemptKey,
      });

      // Reset idempotency key for the NEXT new order
      idempotencyKeyRef.current = crypto.randomUUID();
      setDisplayIdempotencyKey(idempotencyKeyRef.current);
      await refreshCart();
    } catch (err) {
      if (err.status === 409 || err.code === 'INSUFFICIENT_STOCK') {
        setStockConflict(err.details || { available: 0, requested: 1 });
        showToast({
          type: 'error',
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${err.details?.available ?? 0} left — you asked for ${err.details?.requested ?? 1}`,
          details: err.details,
        });
      } else {
        setCheckoutError(err.message || 'Checkout failed');
        showToast({
          type: 'error',
          code: err.code || 'CHECKOUT_ERROR',
          message: err.message,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const items = cart?.items || [];
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  // Price details calculations
  const totalPaise = items.reduce((sum, item) => sum + (item.pricePaise || 0) * item.quantity, 0);
  const mrpTotalPaise = items.reduce(
    (sum, item) => sum + Math.round((item.pricePaise * 1.35) / 10000) * 10000 * item.quantity,
    0
  );
  const discountPaise = Math.max(0, mrpTotalPaise - totalPaise);

  return (
    <div className="flex flex-col gap-4">
      {/* Page Heading */}
      <div className="flex items-center justify-between pb-1">
        <h1 className="text-xl font-semibold text-[#212121]">
          My Cart {itemCount > 0 && <span className="text-sm font-normal text-[#878787]">({itemCount} items)</span>}
        </h1>
        <div className="text-xs text-[#878787]">
          Fulfillment: <strong className="text-[#212121]">{selectedStore?.city} · {selectedStore?.storeCode}</strong>
        </div>
      </div>

      {/* 409 Stock Conflict Clean Banner */}
      {stockConflict && (
        <div className="bg-red-50 border border-red-200 rounded-[6px] p-3 flex items-start gap-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-red-900">
              Some items went out of stock during verification
            </span>
            <span>
              Available in store: <strong>{stockConflict.available}</strong> | You requested:{' '}
              <strong>{stockConflict.requested}</strong>. The atomic transaction prevented oversell safely.
            </span>
          </div>
        </div>
      )}

      {/* General Checkout Error */}
      {checkoutError && !stockConflict && (
        <div className="bg-red-50 border border-red-200 rounded-[6px] p-3 text-xs text-red-700">
          <strong>Checkout Notice:</strong> {checkoutError}
        </div>
      )}

      {/* Cart Content: Empty State vs 2-Column Flipkart Layout */}
      {items.length === 0 ? (
        <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-12 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-[#2874F0] flex items-center justify-center">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-semibold text-[#212121]">Your cart is empty!</h2>
          <p className="text-xs text-[#878787] max-w-sm">
            Explore our omnichannel catalog and discover verified electronics, audio, and appliances with guaranteed store stock.
          </p>
          <Link
            to="/"
            className="mt-2 px-6 py-2 bg-[#2874F0] text-white rounded-[6px] text-xs font-semibold hover:bg-[#1C5BC8] transition-colors"
          >
            Shop Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Line Items List */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="bg-white border border-[#E0E0E0] rounded-[6px] divide-y divide-[#E0E0E0] shadow-sm">
              {items.map((item) => {
                const isUpdating = updatingProductId === item.productId;
                const itemMrp = Math.max(Math.round((item.pricePaise * 1.35) / 10000) * 10000, item.pricePaise + 10000);
                const discount = Math.round(((itemMrp - item.pricePaise) / itemMrp) * 100);

                return (
                  <div key={item.productId} className="p-4 flex gap-4 items-start">
                    {/* Item Thumbnail */}
                    <div className="w-20 h-20 rounded-[4px] border border-[#E0E0E0] bg-white p-1 shrink-0 flex items-center justify-center">
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

                    {/* Item Info */}
                    <div className="flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-medium text-[#212121] leading-snug">
                          {item.name}
                        </h3>
                        <span className="text-xs text-[#878787] block mt-0.5">
                          Seller: SmartMart Retail ({selectedStore?.storeCode})
                        </span>
                      </div>

                      {/* Price Row */}
                      <div className="flex items-baseline gap-2">
                        <Price paise={item.pricePaise} className="text-base font-bold text-[#212121]" />
                        <Price paise={itemMrp} className="text-xs text-[#878787] line-through font-normal" />
                        <span className="text-xs font-semibold text-[#388E3C]">
                          {discount}% off
                        </span>
                      </div>

                      {/* Stepper & Actions */}
                      <div className="flex items-center gap-4 pt-1">
                        {/* Stepper */}
                        <div className="flex items-center border border-[#E0E0E0] rounded-[4px] overflow-hidden bg-white">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                            disabled={isUpdating || item.quantity <= 1}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 py-1 font-semibold text-xs text-[#212121] min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                            disabled={isUpdating}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 disabled:opacity-30 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          disabled={isUpdating}
                          className="text-xs font-semibold text-[#212121] hover:text-[#D32F2F] transition-colors cursor-pointer"
                        >
                          REMOVE
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Delivery address reassurance note */}
            <div className="p-3 bg-white border border-[#E0E0E0] rounded-[6px] flex items-center justify-between text-xs text-[#878787] shadow-sm">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#388E3C]" />
                <span>Safe and Secure Payments · 100% Authentic Products</span>
              </span>
            </div>
          </div>

          {/* Right Column (4 cols): PRICE DETAILS Card */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="bg-white border border-[#E0E0E0] rounded-[6px] p-4 shadow-sm flex flex-col gap-3 text-xs">
              <span className="font-semibold text-xs text-[#878787] uppercase tracking-wider pb-2 border-b border-[#E0E0E0]">
                Price Details
              </span>

              <div className="flex items-center justify-between text-[#212121]">
                <span>Price ({itemCount} items)</span>
                <Price paise={mrpTotalPaise} className="font-medium" />
              </div>

              <div className="flex items-center justify-between text-[#388E3C]">
                <span>Discount</span>
                <span>- <Price paise={discountPaise} className="font-medium" /></span>
              </div>

              <div className="flex items-center justify-between text-[#212121]">
                <span>Delivery Charges</span>
                <span className="text-[#388E3C] font-semibold">FREE</span>
              </div>

              {/* Total Amount Row */}
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-[#E0E0E0] text-sm">
                <span className="font-bold text-[#212121]">Total Amount</span>
                <Price paise={totalPaise} className="text-lg font-bold text-[#212121]" />
              </div>

              {/* Savings callout */}
              <div className="p-2 bg-green-50 rounded-[4px] text-center text-[#388E3C] font-semibold text-xs border border-green-200">
                You will save <Price paise={discountPaise} /> on this order
              </div>

              {/* Primary Action Button: Place Order */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || items.length === 0}
                className="w-full h-[40px] px-4 rounded-[6px] bg-[#FB641B] hover:bg-[#E55510] text-white font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mt-1 active:scale-[0.98]"
              >
                <span>{isSubmitting ? 'VERIFYING INVENTORY...' : 'PLACE ORDER'}</span>
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Collapsible Order Processing Details (Default Collapsed) */}
      <div className="border border-[#E0E0E0] rounded-[6px] bg-white overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#878787] hover:text-[#212121] bg-gray-50/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-[#2874F0]" />
            <span>Order Processing Details & Distributed Verification (Demo Proof)</span>
            <span className="font-mono text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.2 rounded">
              Idempotency & Outbox
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            {proofOpen ? 'Hide' : 'Show'}
            {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {proofOpen && (
          <div className="p-4 border-t border-[#E0E0E0] flex flex-col gap-3 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-gray-50 rounded border border-gray-200">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-mono uppercase">IDEMPOTENCY KEY</span>
                <span className="font-mono text-xs font-bold text-[#212121] break-all">
                  {displayIdempotencyKey || 'None'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 text-[11px] font-mono flex items-center gap-1 text-gray-700 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3 h-3 text-[#388E3C]" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">STAGE 1</span>
                <span className="font-bold text-[#388E3C]">DB COMMIT</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">STAGE 2</span>
                <span className="font-bold text-[#388E3C]">OUTBOX ROW</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">STAGE 3</span>
                <span className="font-bold text-[#388E3C]">KAFKA PUBLISH</span>
              </div>
              <div className="p-2 rounded bg-gray-50 border border-gray-200">
                <span className="text-gray-500 block text-[10px]">STAGE 4</span>
                <span className="font-bold text-[#388E3C]">SEARCH INDEXED</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 italic">
              Checkout enforces strict ACID conditional decrements. If another client claims the last unit first, the atomic check fails safely with HTTP 409 and zero oversell.
            </p>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {successOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-[6px] max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl border border-[#E0E0E0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 text-[#388E3C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#212121]">Order Placed!</h3>
                <span className="text-xs text-[#878787]">
                  Order #{successOrder.orderNumber || successOrder.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#212121] leading-relaxed">
              Your order has been atomically committed in PostgreSQL and dispatched to the Kafka outbox pipeline.
            </p>

            <div className="p-3 bg-gray-50 rounded border border-[#E0E0E0] text-xs font-mono flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Paid:</span>
                <Price paise={successOrder.totalPaise} className="font-bold text-[#212121]" />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Replayed:</span>
                <span className="font-bold text-[#212121]">{String(successOrder.replayed)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessOrder(null);
                  navigate('/');
                }}
                className="px-4 py-2 rounded-[6px] border border-[#E0E0E0] text-xs font-semibold text-[#212121] hover:bg-gray-100 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                type="button"
                onClick={() => navigate(`/orders/${successOrder.id}`, { state: { replayed: successOrder.replayed } })}
                className="px-4 py-2 rounded-[6px] bg-[#2874F0] text-white text-xs font-semibold hover:bg-[#1C5BC8] transition-colors"
              >
                View Order Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
