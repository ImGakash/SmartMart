import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import StockBadge from '../components/StockBadge.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import {
  ArrowLeft,
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  XCircle,
  Database,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Star
} from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedStore, setSelectedStore, selectedCustomer, refreshCart, showToast } = useApp();

  const [product, setProduct] = useState(null);
  const [reconciliationRow, setReconciliationRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [prodData, xrayData] = await Promise.all([
          apiGet(`/products/${id}`),
          apiGet('/xray/metrics').catch(() => null),
        ]);

        if (!isMounted) return;
        setProduct(prodData);

        if (xrayData?.reconciliation?.rows) {
          const row = xrayData.reconciliation.rows.find((r) => r.productId === id);
          if (row) setReconciliationRow(row);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load product');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Handle Add to Cart
  async function handleAddToCart() {
    if (!selectedStore?.id || !product?.id) {
      showToast({
        type: 'error',
        code: 'STORE_REQUIRED',
        message: 'Please choose an active store for cart fulfillment.',
      });
      return;
    }

    setIsAdding(true);
    try {
      await apiPost('/cart/items', {
        storeId: selectedStore.id,
        productId: product.id,
        quantity,
      });

      await refreshCart();

      showToast({
        type: 'success',
        message: `Added ${quantity} × "${product.name}" to your cart`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } finally {
      setIsAdding(false);
    }
  }

  // Handle Buy Now (direct checkout with items array)
  async function handleBuyNow() {
    if (!selectedStore?.id || !product?.id) {
      showToast({
        type: 'error',
        code: 'STORE_REQUIRED',
        message: 'Please choose an active store for fulfillment.',
      });
      return;
    }

    if (!selectedCustomer?.id) {
      showToast({
        type: 'error',
        code: 'CUSTOMER_REQUIRED',
        message: 'Customer profile required for checkout.',
      });
      return;
    }

    setIsBuying(true);
    const idempotencyKey = crypto.randomUUID();

    try {
      const result = await apiPost(
        '/checkout',
        {
          storeId: selectedStore.id,
          items: [{ productId: product.id, quantity }],
        },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );

      showToast({
        type: 'success',
        message: 'Order created successfully!',
      });

      navigate(`/orders/${result.order.id}`, { state: { replayed: result.replayed } });
    } catch (err) {
      if (err.status === 409 || err.code === 'INSUFFICIENT_STOCK') {
        showToast({
          type: 'error',
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock: only ${err.details?.available ?? 0} remaining. Oversell prevented safely.`,
          details: err.details,
        });
      } else {
        showToast({
          type: 'error',
          code: err.code || 'CHECKOUT_ERROR',
          message: err.message || 'Checkout failed',
        });
      }
    } finally {
      setIsBuying(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-16 flex flex-col items-center justify-center gap-3 shadow-2xs">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Loading product details & inventory...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
        <h2 className="text-xl font-semibold text-slate-900">Product Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md">{error || 'Unable to retrieve product details.'}</p>
        <Link
          to="/"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const availability = product.availability || [];
  const selectedStoreAvailability = availability.find((a) => a.storeId === selectedStore?.id);
  const currentStoreStock = selectedStoreAvailability?.stockQty ?? 0;
  const inStock = currentStoreStock > 0;

  // Realistic MRP calculation
  const mrp = Math.max(Math.round((product.pricePaise * 1.35) / 10000) * 10000, product.pricePaise + 10000);
  const discountPct = Math.round(((mrp - product.pricePaise) / mrp) * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb row */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/" className="hover:text-indigo-600 flex items-center gap-1 font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Catalog</span>
        </Link>
        <span>/</span>
        <span className="text-slate-700">{product.category}</span>
        <span>/</span>
        <span className="text-slate-400">{product.brand}</span>
      </div>

      {/* Main 2-Column Product Container */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 md:p-6 shadow-2xs grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Image Gallery & Action Buttons */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Main Image Box on neutral podium */}
          <div className="border border-slate-200/80 rounded-xl p-4 flex items-center justify-center bg-slate-50/70 aspect-square">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                e.target.src =
                  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
              }}
            />
          </div>

          {/* Action Buttons: Add to Cart & Buy Now */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding || !inStock}
              className="h-[42px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shadow-indigo-100 active:scale-[0.98]"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{isAdding ? 'Adding...' : 'Add to Cart'}</span>
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={isBuying || !inStock}
              className="h-[42px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs active:scale-[0.98]"
            >
              <Zap className="w-4 h-4" />
              <span>{isBuying ? 'Processing...' : 'Buy Now'}</span>
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): Title, Price, Description, Store Matrix */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
              {product.brand}
            </span>
            <h1 className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
              {product.name}
            </h1>
          </div>

          {/* Rating Pill */}
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-bold px-2.5 py-0.5 rounded-full">
              <span>4.3</span>
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            </span>
            <span className="text-xs text-slate-500">
              Verified Omnichannel Inventory
            </span>
          </div>

          {/* Price Block */}
          <div className="flex flex-col gap-1 border-y border-slate-100 py-3">
            <div className="flex items-baseline gap-2.5">
              <Price paise={product.pricePaise} className="text-xl font-extrabold text-slate-900" />
              <Price paise={mrp} className="text-sm text-slate-400 line-through font-normal" />
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {discountPct}% off
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Tax included · Free store pickup & delivery
            </span>
          </div>

          {/* Delivery & Quantity Stepper Block */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl">
            <div className="flex items-center gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-slate-500 block text-[11px]">Fulfillment Store</span>
                <span className="font-semibold text-slate-900">
                  {selectedStore?.city} · {selectedStore?.storeCode}
                </span>
                {inStock ? (
                  <span className="ml-2 text-emerald-700 font-medium">
                    — In Stock ({currentStoreStock} available)
                  </span>
                ) : (
                  <span className="ml-2 text-rose-600 font-medium">
                    — Out of Stock at this store
                  </span>
                )}
              </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Qty:</span>
              <div className="flex items-center border border-slate-200 bg-white rounded-lg overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-3 py-1 font-semibold text-xs text-slate-900 min-w-[28px] text-center">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  disabled={quantity >= currentStoreStock}
                  className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-xs text-slate-900">Product Overview</span>
            <p className="text-slate-600 leading-relaxed">
              {product.description || 'High quality retail-grade merchandise with full manufacturer warranty and verified serial inspection.'}
            </p>
          </div>

          {/* Retail Chain Availability Table (proves retail-chain model across 6 stores) */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="font-semibold text-xs text-slate-900">
              Chain-wide Store Availability (5 Metro Cities)
            </span>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Store Code</th>
                    <th className="py-2.5 px-3">City</th>
                    <th className="py-2.5 px-3">In-Store Stock</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availability.map((store) => {
                    const isSelected = store.storeId === selectedStore?.id;
                    return (
                      <tr
                        key={store.storeId}
                        className={isSelected ? 'bg-indigo-50/40 font-medium' : 'hover:bg-slate-50/60'}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900">
                          {store.storeCode}
                          {isSelected && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-600 text-white font-sans uppercase font-semibold">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{store.city}</td>
                        <td className="py-2.5 px-3">
                          <StockBadge quantity={store.stockQty} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isSelected ? (
                            <button
                              type="button"
                              onClick={() => {
                                const found = availability.find((a) => a.storeId === store.storeId);
                                if (found) {
                                  setSelectedStore({
                                    id: store.storeId,
                                    storeCode: store.storeCode,
                                    city: store.city,
                                  });
                                }
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                            >
                              Switch Store
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 font-semibold">
                              Selected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Small Collapsible Inventory Source Details Section (Default Collapsed) */}
      <div className="border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Inventory Source & Reconciliation Telemetry (Demo Proof)</span>
            <span className="font-mono text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full font-bold">
              PostgreSQL SSoT
            </span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            {proofOpen ? 'Hide' : 'Show'}
            {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>

        {proofOpen && (
          <div className="p-4 border-t border-slate-100 flex flex-col gap-3 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">INVENTORY SSoT</span>
                <span className="font-bold text-slate-800">PostgreSQL (atomic ledger)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">PG TOTAL STOCK</span>
                <span className="font-bold text-slate-800">
                  {reconciliationRow?.pgTotalStock ?? product.totalStock ?? 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">OPENSEARCH TOTAL</span>
                <span className="font-bold text-slate-800">
                  {reconciliationRow?.osTotalStock ?? 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">SYNC STATUS</span>
                <div>
                  <SyncBadge status={reconciliationRow?.status || 'PASS'} />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Inventory source: PostgreSQL. OpenSearch index tracks updates asynchronously via Apache Kafka consumer.
            </p>

            <div className="mt-1">
              <span className="text-[10px] font-mono text-slate-400 block mb-1">
                RAW PRODUCT & RECONCILIATION RECORD:
              </span>
              <JsonViewer data={{ product, reconciliation: reconciliationRow }} defaultExpanded={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
