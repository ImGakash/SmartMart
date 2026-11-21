import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPatch, apiDelete, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import ProductImage from '../components/ProductImage.jsx';
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
        <h1 className="text-xl font-bold text-slate-900">
          My Cart {itemCount > 0 && <span className="text-sm font-normal text-slate-500">({itemCount} items)</span>}
        </h1>
        <div className="text-xs text-slate-500">
          Fulfillment: <strong className="text-slate-800">{selectedStore?.city} · {selectedStore?.storeCode}</strong>
        </div>
      </div>

      {/* 409 Stock Conflict Clean Banner */}
      {stockConflict && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-rose-900 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-rose-950">
              Some items went out of stock during verification
            </span>
            <span>
              Available in store: <strong>{stockConflict.available}</strong> | You requested:{' '}
              <strong>{stockConflict.requested}</strong>. Single-statement atomic isolation safely prevented oversell.
            </span>
          </div>
        </div>
      )}

      {/* General Checkout Error */}
      {checkoutError && !stockConflict && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 shadow-2xs">
          <strong>Checkout Notice:</strong> {checkoutError}
        </div>
      )}

      {/* Cart Content: Empty State vs 2-Column Modern Layout */}
      {items.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-14 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Your cart is empty</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Explore our catalog to discover authentic electronics, audio gear, and appliances across Indian metro retail hubs.
          </p>
          <Link
            to="/"
            className="mt-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-100"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (8 cols): Line Items List */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-100 shadow-2xs">
              {items.map((item) => {
                const isUpdating = updatingProductId === item.productId;
                const itemMrp = Math.max(Math.round((item.pricePaise * 1.35) / 10000) * 10000, item.pricePaise + 10000);
                const discount = Math.round(((itemMrp - item.pricePaise) / itemMrp) * 100);

                return (
                  <div key={item.productId} className="p-4 flex gap-4 items-start">
                    {/* Item Thumbnail on neutral podium */}
                    <div className="w-20 h-20 rounded-lg border border-slate-100 bg-slate-50/70 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                      <ProductImage
                        src={item.imageUrl}
                        alt={item.name}
                        category={item.category}
                        sku={item.sku}
                        loading="lazy"
                      />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                          {item.name}
                        </h3>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Fulfillment: SmartMart Store ({selectedStore?.storeCode})
                        </span>
                      </div>

                      {/* Price Row */}
                      <div className="flex items-baseline gap-2">
                        <Price paise={item.pricePaise} className="text-base font-bold text-slate-900" />
                        <Price paise={itemMrp} className="text-xs text-slate-400 line-through font-normal" />
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-100">
                          {discount}% off
                        </span>
                      </div>

                      {/* Stepper & Actions */}
                      <div className="flex items-center gap-4 pt-1">
                        {/* Stepper */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                            disabled={isUpdating || item.quantity <= 1}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-3 py-1 font-semibold text-xs text-slate-900 min-w-[28px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                            disabled={isUpdating}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          disabled={isUpdating}
                          className="text-xs font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security reassurance banner */}
            <div className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-600 shadow-2xs">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% Genuine Retail Inventory · Safe & Verified Pickup</span>
              </span>
            </div>
          </div>

          {/* Right Column (4 cols): PRICE DETAILS Card */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs flex flex-col gap-3 text-xs">
              <span className="font-semibold text-xs text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
                Price Breakdown
              </span>

              <div className="flex items-center justify-between text-slate-800">
                <span>Items Subtotal ({itemCount} items)</span>
                <Price paise={mrpTotalPaise} className="font-medium" />
              </div>

              <div className="flex items-center justify-between text-emerald-700">
                <span>Direct Savings</span>
                <span>- <Price paise={discountPaise} className="font-medium" /></span>
              </div>

              <div className="flex items-center justify-between text-slate-800">
                <span>Store Pickup & Delivery</span>
                <span className="text-emerald-700 font-semibold">FREE</span>
              </div>

              {/* Total Amount Row */}
              <div className="flex items-center justify-between pt-3 border-t border-dashed border-slate-200 text-sm">
                <span className="font-bold text-slate-900">Total Payable</span>
                <Price paise={totalPaise} className="text-lg font-bold text-slate-900" />
              </div>

              {/* Savings callout */}
              <div className="p-2.5 bg-emerald-50 rounded-lg text-center text-emerald-800 font-semibold text-xs border border-emerald-100">
                You will save <Price paise={discountPaise} /> on this order
              </div>

              {/* Primary Action Button: Place Order */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || items.length === 0}
                className="w-full h-[42px] px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed mt-1 active:scale-[0.98]"
              >
                <span>{isSubmitting ? 'Verifying inventory...' : 'Place Order'}</span>
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Collapsible Order Processing Details (Default Collapsed) */}
      <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Order Processing Details & Distributed Verification (Demo Proof)</span>
            <span className="font-mono text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full font-bold">
              Idempotency & Outbox
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            {proofOpen ? 'Hide' : 'Show'}
            {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {proofOpen && (
          <div className="p-4 border-t border-slate-100 flex flex-col gap-3 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-mono uppercase">IDEMPOTENCY KEY</span>
                <span className="font-mono text-xs font-bold text-slate-800 break-all">
                  {displayIdempotencyKey || 'None'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-mono flex items-center gap-1 text-slate-700 cursor-pointer"
              >
                {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">STAGE 1</span>
                <span className="font-bold text-indigo-600">DB COMMIT</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">STAGE 2</span>
                <span className="font-bold text-indigo-600">OUTBOX ROW</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">STAGE 3</span>
                <span className="font-bold text-indigo-600">KAFKA PUBLISH</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">STAGE 4</span>
                <span className="font-bold text-indigo-600">SEARCH INDEXED</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Checkout enforces strict ACID conditional decrements. If another client claims the last unit first, the atomic check fails safely with HTTP 409 and zero oversell.
            </p>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {successOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Order Confirmed!</h3>
                <span className="text-xs text-slate-500">
                  Order #{successOrder.orderNumber || successOrder.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your order has been atomically committed in PostgreSQL and dispatched into the Kafka outbox pipeline.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Paid:</span>
                <Price paise={successOrder.totalPaise} className="font-bold text-slate-900" />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Replayed:</span>
                <span className="font-bold text-slate-900">{String(successOrder.replayed)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessOrder(null);
                  navigate('/');
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                type="button"
                onClick={() => navigate(`/orders/${successOrder.id}`, { state: { replayed: successOrder.replayed } })}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-100"
              >
                Track Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
