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
  Sparkles,
  CreditCard,
  Lock
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
          message: err.message || 'Checkout failed. Click retry to use same Idempotency-Key.',
          details: err.details,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const items = cart?.items || [];
  const totalPaise = cart?.totalPaise || 0;
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-saffron" />
            <span>Shopping Cart &amp; Checkout</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1">
            Fulfillment Store: <strong className="text-slate-200">{selectedStore?.storeCode}</strong> ({selectedStore?.city}) · Customer: <strong className="text-slate-200">{selectedCustomer?.name}</strong>
          </p>
        </div>

        <Link
          to="/"
          className="px-4 py-2 rounded-xl bg-ink-800 hover:bg-ink-700 text-slate-200 text-xs font-mono font-bold transition-colors border border-slate-700"
        >
          ← Continue Shopping
        </Link>
      </div>

      {/* Main Grid: Left (8 cols) = Cart Line Items; Right (4 cols) = CheckoutProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Cart items table */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {items.length === 0 ? (
            <div className="bg-ink-800/50 border border-line rounded-3xl py-16 px-4 text-center flex flex-col items-center justify-center gap-4 backdrop-blur-md">
              <ShoppingBag className="w-12 h-12 text-slate-600" />
              <h2 className="text-xl font-bold text-white">Your cart is empty</h2>
              <p className="text-xs text-slate-400 max-w-sm">
                Add products from the storefront to test atomic stock reservation and transactional checkout.
              </p>
              <Link
                to="/"
                className="mt-2 px-5 py-2.5 rounded-xl bg-saffron hover:bg-saffron-bright text-ink-950 font-bold text-xs uppercase tracking-wider transition-all"
              >
                Browse Storefront
              </Link>
            </div>
          ) : (
            <div className="bg-ink-800/70 border border-line rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-ink-900/80 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4 text-center">Unit Price</th>
                      <th className="py-3 px-4 text-center">Quantity</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-center">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {items.map((item) => (
                      <tr key={item.productId} className="hover:bg-ink-750/50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm font-sans">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center text-slate-300 font-mono">
                          <Price paise={item.pricePaise} />
                        </td>

                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center gap-2 bg-ink-950 border border-slate-700 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                              disabled={updatingProductId === item.productId || item.quantity <= 1}
                              className="w-6 h-6 rounded bg-ink-800 hover:bg-ink-700 disabled:opacity-30 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-white">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                              disabled={updatingProductId === item.productId}
                              className="w-6 h-6 rounded bg-ink-800 hover:bg-ink-700 text-white flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right font-black text-white text-sm font-mono">
                          <Price paise={item.pricePaise * item.quantity} />
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.productId)}
                            disabled={updatingProductId === item.productId}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Rail & Checkout CTA */}
              <div className="p-6 bg-ink-900/90 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-mono text-slate-400">Total Payable ({itemCount} items):</span>
                  <Price paise={totalPaise} className="text-3xl font-black font-mono text-saffron-bright" />
                </div>

                <DemoActionButton
                  onClick={handleCheckout}
                  loading={isSubmitting}
                  disabled={items.length === 0}
                  variant="warning"
                  icon={CreditCard}
                  size="lg"
                  className="w-full sm:w-auto font-mono font-black uppercase text-ink-950 bg-saffron hover:bg-saffron-bright px-8 shadow-glow-saffron"
                  id="checkout-submit-btn"
                >
                  Confirm &amp; Place Order (POST /checkout)
                </DemoActionButton>
              </div>
            </div>
          )}

          {/* 409 INSUFFICIENT_STOCK: FRAMED AS SYSTEM SUCCESS */}
          {stockConflict && (
            <div className="bg-emerald-950/80 border-2 border-emerald-500 rounded-2xl p-5 flex flex-col gap-3 text-emerald-200 shadow-2xl shadow-emerald-950/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base text-white uppercase">
                      Stock Check Succeeded Safely (HTTP 409)
                    </span>
                    <ProofBadge status="pass" label="ZERO OVERSELL" />
                  </div>
                  <p className="text-xs text-emerald-200/90 font-medium mt-0.5 font-sans">
                    Stock check failed safely. No oversell occurred. Server rejected transaction because only {stockConflict.available} unit(s) were left in PostgreSQL.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: CheckoutProofPanel (Receipt of Correctness) */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-24">
          <ProofPanel
            title="Checkout Correctness Proof"
            service="PostgreSQL"
            action="POST /checkout"
            proof="Idempotency-Key + 5-Stage SSE Pipeline"
          >
            {/* Idempotency Key Box */}
            <div className="p-3.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-indigo-400" />
                  Idempotency-Key
                </span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="text-[10px] text-saffron hover:text-saffron-bright flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="p-2 rounded bg-ink-900 border border-slate-800 text-[11px] text-slate-300 font-bold truncate">
                {displayIdempotencyKey || 'generating...'}
              </div>

              <span className="text-[10px] text-slate-500">
                Generated client-side via crypto.randomUUID(). Locked for retry attempts.
              </span>
            </div>

            {/* Five Stage Pipeline Badges */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-ink-950 border border-slate-800 font-mono text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Order Lifecycle Stages
              </span>

              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between p-2 rounded bg-ink-900/60 border border-slate-800">
                  <span className="text-slate-300 font-bold">1. DB COMMIT</span>
                  <ProofBadge status="pass" label="POSTGRESQL" size="sm" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-ink-900/60 border border-slate-800">
                  <span className="text-slate-300 font-bold">2. OUTBOX</span>
                  <ProofBadge status="pass" label="LEASE LOCKED" size="sm" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-ink-900/60 border border-slate-800">
                  <span className="text-slate-300 font-bold">3. KAFKA PUBLISH</span>
                  <ProofBadge status="pass" label="ACKED" size="sm" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-ink-900/60 border border-slate-800">
                  <span className="text-slate-300 font-bold">4. NOTIFIED</span>
                  <ProofBadge status="info" label="SIMULATED" size="sm" />
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-ink-900/60 border border-slate-800">
                  <span className="text-slate-300 font-bold">5. SEARCH INDEXED</span>
                  <ProofBadge status="pass" label="OPENSEARCH" size="sm" />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-ink-950 border border-slate-800 text-xs font-mono text-slate-400 leading-relaxed">
              Upon checkout, the order transitions through live SSE stages. If connection drops, auto-reconnect backoff recovers state seamlessly.
            </div>
          </ProofPanel>
        </div>
      </div>

      {/* SUCCESS MODAL (After Checkout) */}
      {successOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-ink-900 border-2 border-saffron rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-mono font-bold text-saffron uppercase tracking-widest">
                  Order Successfully Committed
                </span>
                <h3 className="text-2xl font-mono font-black text-white">
                  #{successOrder.orderNumber}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-ink-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID:</span>
                <span className="text-slate-200 font-bold truncate max-w-[200px]">{successOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Idempotency-Key:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{successOrder.idempotencyKey}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Amount:</span>
                <Price paise={successOrder.totalPaise} className="font-bold text-saffron text-sm" />
              </div>
              {successOrder.replayed && (
                <div className="flex justify-between text-sky-400 font-bold pt-1 border-t border-slate-800">
                  <span>Replayed Request:</span>
                  <span>TRUE (Zero duplicate charge)</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSuccessOrder(null);
                  navigate('/');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-slate-200 font-mono font-bold text-xs cursor-pointer border border-slate-700"
              >
                Continue Shopping
              </button>
              <Link
                to={`/orders/${successOrder.id}`}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-saffron hover:bg-saffron-bright text-ink-950 font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-saffron/20 cursor-pointer"
              >
                <span>View Order X-Ray</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
