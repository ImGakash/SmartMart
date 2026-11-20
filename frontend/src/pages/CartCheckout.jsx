import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPatch, apiDelete, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
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
  AlertCircle
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

  const [loading, setLoading] = useState(false);
  const [updatingProductId, setUpdatingProductId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  // Single idempotency key per checkout attempt; re-used on retries
  const idempotencyKeyRef = useRef(null);

  // Initialize or fetch active cart
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  // Handle item quantity increment / decrement via PATCH /cart/items/:productId
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

  // Handle item deletion via DELETE /cart/items/:productId?storeId=...
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
  // Rule 2: Idempotency-Key: generated client-side via crypto.randomUUID() ONCE per checkout attempt.
  // If request fails with network error or 5xx, RETRY with SAME key.
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

    // Generate idempotency key ONCE if not already generated for this attempt
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    const attemptKey = idempotencyKeyRef.current;

    setIsSubmitting(true);
    setCheckoutError(null);

    try {
      // POST /checkout with items omitted (server loads the active cart)
      const result = await apiPost(
        '/checkout',
        { storeId: selectedStore.id },
        { idempotencyKey: attemptKey }
      );

      // Successfully processed: reset key for future attempts
      idempotencyKeyRef.current = null;
      await refreshCart();

      const order = result?.order;
      const isReplayed = Boolean(result?.replayed);

      // Navigate to /orders/:id with replayed flag in state
      navigate(`/orders/${order?.id || 'sample'}`, {
        state: { replayed: isReplayed },
      });
    } catch (err) {
      // 409 INSUFFICIENT_STOCK: allow customer to adjust quantity and reset key
      if (err.status === 409 || err.code === 'INSUFFICIENT_STOCK') {
        idempotencyKeyRef.current = null; // New attempt needed since cart needs adjustment
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
          canRetry: true,
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
      {/* Top Banner & Context Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 uppercase font-bold tracking-wider mb-1">
            <span>Online Cart</span>
            <span>•</span>
            <span>Store: {selectedStore?.storeCode} ({selectedStore?.city})</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-indigo-400" />
            Your Shopping Cart
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

      {/* Main Cart Content */}
      {isEmpty ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl py-24 px-4 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
          <div className="w-20 h-20 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500">
            <ShoppingBag className="w-10 h-10" />
          </div>
          <div className="text-2xl font-bold text-white">Your cart is empty</div>
          <p className="text-slate-400 text-sm max-w-md">
            Looks like you haven't added any products to your active cart for {selectedStore?.storeName || 'this store'}.
          </p>
          <Link
            to="/"
            className="mt-3 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2"
          >
            <span>Browse Storefront</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {items.map((item) => {
              const isUpdating = updatingProductId === item.productId;

              return (
                <div
                  key={item.productId}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-lg transition-all"
                >
                  {/* Left: Thumbnail & Name */}
                  <div className="flex items-center gap-4 flex-1">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-20 h-20 rounded-xl object-cover bg-slate-950 shrink-0 border border-slate-800"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
                      }}
                    />
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base font-bold text-white leading-snug">
                        {item.name}
                      </h4>
                      <div className="text-xs text-slate-400 font-mono">
                        Unit: <Price paise={item.unitPricePaise} />
                      </div>
                      {/* Advisory Stock Note in Gray per prompt */}
                      <div className="text-xs text-slate-400 italic">
                        Only {item.stockQty ?? 0} left at this store
                      </div>
                    </div>
                  </div>

                  {/* Right: Quantity Controls & Subtotal */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1 || isUpdating}
                        className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 flex items-center justify-center transition-colors"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-8 text-center font-mono font-bold text-sm text-white">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        disabled={isUpdating}
                        className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 flex items-center justify-center transition-colors"
                        title="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="flex flex-col text-right min-w-[100px]">
                      <span className="text-[10px] text-slate-400 uppercase font-mono">Subtotal</span>
                      <Price
                        paise={item.subtotalPaise}
                        className="text-lg text-white font-extrabold"
                      />
                    </div>

                    {/* Delete Item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.productId)}
                      disabled={isUpdating}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Checkout Order Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-7 flex flex-col gap-6 shadow-2xl sticky top-24">
            <h3 className="text-lg font-extrabold text-white pb-3 border-b border-slate-800">
              Order Summary
            </h3>

            <div className="flex flex-col gap-3.5 text-sm">
              <div className="flex justify-between items-center text-slate-400">
                <span>Customer</span>
                <span className="text-white font-mono font-medium truncate max-w-[180px]">
                  {selectedCustomer?.name || 'Guest Customer'}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span>Total Items</span>
                <span className="text-white font-mono font-bold">
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span>Store Code</span>
                <span className="text-indigo-400 font-mono font-bold">
                  {selectedStore?.storeCode} ({selectedStore?.city})
                </span>
              </div>

              {idempotencyKeyRef.current && (
                <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono">
                  <span className="text-slate-400">Idempotency Key (Locked for Retry):</span>
                  <span className="text-indigo-400 truncate">{idempotencyKeyRef.current}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between items-baseline">
              <span className="text-base font-bold text-slate-300">Total Payable</span>
              <Price
                paise={cart?.totalPaise || 0}
                className="text-3xl font-extrabold text-white"
              />
            </div>

            {/* Error & Retry Banner if request failed with network / 5xx */}
            {checkoutError && (
              <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold">Transaction Failed</div>
                  <div>{checkoutError.message}</div>
                </div>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={isSubmitting || isEmpty}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-bold text-base transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              id="checkout-button"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Placing Order (Atomic Lock)...</span>
                </>
              ) : checkoutError ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Retry Checkout (Same Key)</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Place Order (Idempotent)</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Submits atomic transaction with client-generated <code className="font-mono text-slate-300">Idempotency-Key</code>.
              Deducts PG stock, writes outbox event, and transitions to live order timeline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
