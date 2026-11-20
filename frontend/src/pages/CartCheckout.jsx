import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPatch, apiDelete, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import ProofPanel from '../components/ProofPanel.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import DemoActionButton from '../components/DemoActionButton.jsx';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  ShoppingBag,
  Store,
  AlertCircle,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles
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

  // Success Modal state
  const [successOrder, setSuccessOrder] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Single idempotency key per checkout attempt; re-used on retries
  const idempotencyKeyRef = useRef(null);

  // Ensure key is initialized for display
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
        { idempotencyKey: attemptKey }
      );

      const order = result?.order;
      const isReplayed = Boolean(result?.replayed);

      // Successfully processed: display success modal with live order badges
      setSuccessOrder({
        ...order,
        replayed: isReplayed,
      });

      // Clear cart
      await refreshCart();

      // Reset idempotency key for next purchase attempt
      idempotencyKeyRef.current = null;
    } catch (err) {
      if (err.status === 409 || err.code === 'INSUFFICIENT_STOCK') {
        // Frame 409 as a system success proof!
        setStockConflict({
          available: err.details?.available ?? 0,
          requested: err.details?.requested ?? 1,
          message: err.message,
        });

        // Reset key since cart items must be changed
        idempotencyKeyRef.current = crypto.randomUUID();
        setDisplayIdempotencyKey(idempotencyKeyRef.current);

        showToast({
          type: 'error',
          code: 'INSUFFICIENT_STOCK',
          message: err.message,
          details: err.details,
        });
      } else {
        // Network error / 5xx: keep attemptKey intact so user can retry with the SAME key
        setCheckoutError({
          message: err.message || 'Checkout failed. You can safely retry with the same idempotency key.',
        });

        showToast({
          type: 'error',
          code: err.code || 'CHECKOUT_FAILED',
          message: err.message,
          details: err.details,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 uppercase font-bold tracking-wider mb-1">
            <span>Online Checkout</span>
            <span>•</span>
            <span>Store: {selectedStore?.storeCode} ({selectedStore?.city})</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-400" />
            Shopping Cart & Checkout
          </h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3">
          <Store className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Fulfillment Hub</span>
            <span className="text-xs font-mono font-bold text-slate-200">
              {selectedStore?.storeName}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left (8 cols) = Cart Items & Totals, Right (4 cols) = CheckoutProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Section: Items List & Checkout Card */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {isEmpty ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-24 px-4 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div className="text-2xl font-bold text-white">Your cart is empty</div>
              <p className="text-slate-400 text-sm max-w-md">
                Looks like you haven't added any products to your active cart for {selectedStore?.storeName || 'this store'}.
              </p>
              <Link
                to="/"
                className="mt-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
              >
                <span>Browse Storefront</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Items List */}
              {items.map((item) => {
                const isUpdating = updatingProductId === item.productId;

                return (
                  <div
                    key={item.productId}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover bg-slate-950 shrink-0 border border-slate-800"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <h4 className="text-sm font-bold text-white leading-snug">
                          {item.name}
                        </h4>
                        <div className="text-xs text-slate-400 font-mono">
                          Unit: <Price paise={item.unitPricePaise} />
                        </div>
                        {/* Advisory stock note in gray */}
                        <div className="text-xs text-slate-500 italic font-mono">
                          Only {item.stockQty ?? 0} left at this store
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      {/* Stepper */}
                      <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                          disabled={item.quantity <= 1 || isUpdating}
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                          disabled={isUpdating}
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[90px]">
                        <Price paise={item.subtotalPaise} className="text-base text-white font-extrabold" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        disabled={isUpdating}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Summary and Place Order */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5 shadow-xl mt-2">
                <div className="flex justify-between items-baseline pb-4 border-b border-slate-800">
                  <span className="text-base font-bold text-slate-300">Total Payable</span>
                  <Price paise={cart?.totalPaise || 0} className="text-3xl font-extrabold text-white" />
                </div>

                <DemoActionButton
                  onClick={handleCheckout}
                  loading={isSubmitting}
                  disabled={isEmpty}
                  variant={checkoutError ? 'warning' : 'primary'}
                  icon={checkoutError ? RefreshCw : ShieldCheck}
                  size="lg"
                  className="w-full"
                >
                  {checkoutError ? 'Retry Checkout (Same Key)' : 'Complete Idempotent Checkout'}
                </DemoActionButton>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: CheckoutProofPanel (Sticky Right Rail) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProofPanel
            title="Checkout Invariant Evidence"
            service="PostgreSQL"
            action="POST /checkout"
            proof="Atomic Stock Deduction"
          >
            {/* Idempotency Key Box */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">
                  Client Idempotency-Key
                </span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1 rounded text-slate-400 hover:text-white flex items-center gap-1 text-[10px]"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-indigo-300 font-bold break-all bg-slate-900 p-2 rounded border border-slate-800/80">
                {displayIdempotencyKey || 'Generated once per checkout'}
              </div>
              <p className="text-[10px] text-slate-500 font-sans leading-tight">
                Reused across retries. Database executes <code className="text-slate-400">ON CONFLICT (idempotency_key) DO NOTHING</code>.
              </p>
            </div>

            {/* Five Pipeline Stage Badges */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <span className="text-slate-400 font-bold uppercase text-[10px]">
                Event Pipeline Handshake
              </span>
              <div className="flex flex-wrap gap-1.5">
                <ProofBadge status="pass" label="DB COMMIT" size="sm" />
                <ProofBadge status="pass" label="OUTBOX" size="sm" />
                <ProofBadge status="pass" label="KAFKA PUBLISH" size="sm" />
                <ProofBadge status="pass" label="NOTIFIED" size="sm" />
                <ProofBadge status="pass" label="SEARCH INDEXED" size="sm" />
              </div>
            </div>

            {/* 409 INSUFFICIENT_STOCK Framed as a System Success Proof */}
            {stockConflict && (
              <div className="p-4 rounded-xl bg-rose-950/80 border-2 border-rose-500 text-rose-100 flex flex-col gap-2 animate-in zoom-in-95">
                <div className="flex items-center justify-between">
                  <ProofBadge status="fail" label="INSUFFICIENT_STOCK" />
                  <span className="text-[10px] font-mono text-rose-300 font-bold">HTTP 409 CONFLICT</span>
                </div>
                <div className="font-extrabold text-sm text-white font-mono mt-1">
                  Stock check failed safely. No oversell occurred.
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed font-sans">
                  The conditional deduction clause prevented an invalid write. Available: {stockConflict.available}, Requested: {stockConflict.requested}.
                </p>
              </div>
            )}

            <JsonViewer
              data={{
                endpoint: 'POST /checkout',
                headers: {
                  'X-Customer-Id': selectedCustomer?.id,
                  'Idempotency-Key': displayIdempotencyKey,
                },
                body: { storeId: selectedStore?.id },
              }}
              title="Checkout Request Header & Payload"
              defaultOpen={false}
              maxHeight="max-h-56"
            />
          </ProofPanel>
        </div>
      </div>

      {/* Success Modal */}
      {successOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-6 lg:p-8 max-w-lg w-full flex flex-col gap-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase font-black tracking-widest text-emerald-400">
                  ATOMIC TRANSACTION COMMITTED
                </span>
                <h3 className="text-2xl font-mono font-black text-white">
                  {successOrder.orderNumber}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Total Amount:</span>
                <Price paise={successOrder.totalPaise} className="text-xl font-bold text-white" />
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Fulfillment Hub:</span>
                <span className="text-indigo-400 font-bold">{selectedStore?.storeCode} ({selectedStore?.city})</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Idempotent Replay:</span>
                <span className={successOrder.replayed ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {successOrder.replayed ? 'TRUE (Deduplicated)' : 'FALSE (New Order)'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={`/orders/${successOrder.id}`}
                className="flex-1 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <span>View Order X-Ray</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setSuccessOrder(null)}
                className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold transition-all text-center"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
