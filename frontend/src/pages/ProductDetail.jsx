import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import StockBadge from '../components/StockBadge.jsx';
import ProofPanel from '../components/ProofPanel.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import DemoActionButton from '../components/DemoActionButton.jsx';
import {
  ArrowLeft,
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Database
} from 'lucide-react';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedStore, setSelectedStore, refreshCart, showToast } = useApp();

  const [product, setProduct] = useState(null);
  const [reconciliationRow, setReconciliationRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

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
        message: `Added ${quantity} × "${product.name}" to cart (${selectedStore.storeCode})`,
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

  if (loading) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-24 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-saffron border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 font-mono text-sm">Loading product & retail stock ledger...</span>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-16 text-center flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold text-white">Product Not Found</h2>
        <p className="text-slate-400 text-sm max-w-md">{error || 'Unable to retrieve product details.'}</p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-ink-800 hover:bg-ink-700 text-white font-semibold text-sm transition-colors border border-slate-700"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const availability = product.availability || [];
  const selectedStoreAvailability = availability.find((a) => a.storeId === selectedStore?.id);
  const currentStoreStock = selectedStoreAvailability?.stockQty ?? 0;

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Back button */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-ink-800"
        >
          <ArrowLeft className="w-4 h-4 text-saffron" />
          <span>BACK TO STOREFRONT</span>
        </Link>
      </div>

      {/* Main Grid: Left = User Action (Hero & Table), Right = ProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Hero + Store Availability Table + Add to Cart */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Hero Section */}
          <div className="bg-ink-800/70 border border-line rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row gap-8 shadow-2xl backdrop-blur-md">
            {/* Image */}
            <div className="w-full md:w-80 h-72 md:h-80 rounded-2xl overflow-hidden bg-ink-950 border border-slate-800 shrink-0">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
                }}
              />
            </div>

            {/* Details */}
            <div className="flex-1 flex flex-col justify-between gap-6">
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-ink-950 text-saffron border border-slate-800">
                    {product.sku}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                    {product.brand}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs font-bold text-slate-400">
                    {product.category}
                  </span>
                </div>

                <h1 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                  {product.name}
                </h1>

                {product.description && (
                  <p className="text-sm text-slate-300 leading-relaxed font-sans">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price & Selection */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-mono text-slate-500 uppercase">Price:</span>
                  <Price paise={product.pricePaise} className="text-3xl font-black font-mono text-white" />
                </div>

                {/* Stepper + Fulfillment Store + Add to Cart */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 bg-ink-950 border border-slate-700 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-ink-800 hover:bg-ink-700 disabled:opacity-40 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono font-black text-sm text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-ink-800 hover:bg-ink-700 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Add to Cart Button */}
                  <DemoActionButton
                    onClick={handleAddToCart}
                    loading={isAdding}
                    variant="warning"
                    icon={ShoppingCart}
                    size="md"
                    className="flex-1 font-mono font-black uppercase text-ink-950 bg-saffron hover:bg-saffron-bright"
                  >
                    Add to Cart ({quantity})
                  </DemoActionButton>
                </div>
              </div>
            </div>
          </div>

          {/* Store Availability Table: Proves retail-chain model */}
          <div className="bg-ink-800/70 border border-line rounded-3xl p-6 shadow-xl flex flex-col gap-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                  <Store className="w-4 h-4 text-saffron" />
                  <span>Physical Store Chain Inventory Ledger</span>
                </h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Live availability per hub proving omnichannel multi-city retail — not single warehouse.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                5 Metro Cities · 6 Physical Stores
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-ink-950">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-ink-900/80 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4 font-black">Store Code</th>
                    <th className="py-3 px-4 font-black">Location / Hub</th>
                    <th className="py-3 px-4 font-black text-right">In-Stock Quantity</th>
                    <th className="py-3 px-4 font-black text-center">Fulfillment Status</th>
                    <th className="py-3 px-4 font-black text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {availability.map((store) => {
                    const isSelected = selectedStore?.id === store.storeId;
                    return (
                      <tr
                        key={store.storeId}
                        className={`transition-colors ${
                          isSelected ? 'bg-saffron/10 text-white' : 'hover:bg-ink-900/50 text-slate-300'
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          <span>{store.storeCode}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200">{store.storeName}</span>
                            <span className="text-[10px] text-slate-400">{store.city}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-sm">
                          {store.stockQty}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StockBadge quantity={store.stockQty} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isSelected ? (
                            <span className="px-2.5 py-1 rounded bg-saffron/20 text-saffron font-bold text-[10px] uppercase border border-saffron/40">
                              Active Store
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStore({
                                  id: store.storeId,
                                  storeCode: store.storeCode,
                                  storeName: store.storeName,
                                  city: store.city,
                                });
                                showToast({
                                  type: 'info',
                                  message: `Switched store to ${store.storeCode} (${store.city})`,
                                });
                              }}
                              className="px-2.5 py-1 rounded bg-ink-900 hover:bg-ink-700 text-slate-300 hover:text-white text-[10px] font-bold transition-colors cursor-pointer border border-slate-700"
                            >
                              Select Store
                            </button>
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

        {/* Right Column (4 cols): Sticky Proof Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-24">
          <ProofPanel
            title="Inventory Ledger Proof"
            service="PostgreSQL"
            action={`GET /products/${id}`}
            proof="Multi-hub row ledger"
          >
            {/* Inventory Source Info */}
            <div className="p-3.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col gap-2 font-mono text-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                <span>Database Source</span>
                <span className="text-indigo-400">TABLE: store_inventory</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Inventory source: <strong>PostgreSQL</strong>. Stock is queried directly from transactional rows with city-level granularity.
              </p>
            </div>

            {/* Reconciliation Cross-Service Row */}
            {reconciliationRow ? (
              <div className="p-3.5 rounded-xl bg-ink-950 border border-slate-800 flex flex-col gap-2.5 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Control Tower Reconciliation
                  </span>
                  <SyncBadge status={reconciliationRow.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-ink-900 border border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400">PostgreSQL Total</span>
                    <span className="text-base font-black text-indigo-300">
                      {reconciliationRow.pgTotalStock} units
                    </span>
                  </div>
                  <div className="p-2 rounded bg-ink-900 border border-slate-800 flex flex-col">
                    <span className="text-[10px] text-slate-400">OpenSearch Total</span>
                    <span className="text-base font-black text-emerald-300">
                      {reconciliationRow.osTotalStock} units
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400">
                  Cities Synced: <strong>{reconciliationRow.osCities} / {reconciliationRow.pgCities}</strong>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-ink-950 border border-slate-800 text-xs font-mono text-slate-400 text-center">
                Fetching cross-service reconciliation diff...
              </div>
            )}

            {/* View in Search Link */}
            <Link
              to={`/?q=${encodeURIComponent(product.name.split(' ')[0] || product.name)}&city=${encodeURIComponent(selectedStore?.city || '')}`}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan/15 hover:bg-cyan/25 border border-cyan/40 text-cyan font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>View in search (?q={product.name.split(' ')[0]}&city={selectedStore?.city})</span>
            </Link>

            {/* Raw JSON */}
            <JsonViewer
              data={product}
              title="Raw Product Availability JSON"
              defaultOpen={false}
              maxHeight="max-h-56"
            />
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
