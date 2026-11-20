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
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
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
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
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
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO STOREFRONT</span>
        </Link>
      </div>

      {/* Main Grid: Left = User Action (Hero & Table), Right = ProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Hero + Store Availability Table + Add to Cart */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* Hero Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row gap-8 shadow-xl">
            {/* Image */}
            <div className="w-full md:w-80 h-72 md:h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
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
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
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
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {product.description}
                  </p>
                )}
              </div>

              {/* Price & Selection */}
              <div className="pt-4 border-t border-slate-800 flex flex-col gap-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-mono text-slate-500 uppercase">Price:</span>
                  <Price paise={product.pricePaise} className="text-3xl font-black text-white" />
                </div>

                {/* Stepper + Fulfillment Store + Add to Cart */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-200 flex items-center justify-center transition-colors"
                      title="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-sm text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 flex items-center justify-center transition-colors"
                      title="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Add to Cart Button */}
                  <DemoActionButton
                    onClick={handleAddToCart}
                    loading={isAdding}
                    variant="primary"
                    icon={ShoppingCart}
                    className="flex-1 min-w-[200px]"
                  >
                    Add {quantity} to Cart ({selectedStore?.storeCode})
                  </DemoActionButton>
                </div>
              </div>
            </div>
          </div>

          {/* Store Availability Table: Proves Retail Chain Model */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-7 shadow-xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-indigo-400" />
                  <span>Physical Store Network Inventory</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Live multi-hub inventory ledger (not a single central warehouse)
                </p>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
                5 Metros • 6 Hubs
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider bg-slate-900/60">
                    <th className="py-2.5 px-4">Store Code</th>
                    <th className="py-2.5 px-4">City</th>
                    <th className="py-2.5 px-4">Location Name</th>
                    <th className="py-2.5 px-4">Live Stock</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {availability.map((storeRow) => {
                    const isSelected = selectedStore?.id === storeRow.storeId;

                    return (
                      <tr
                        key={storeRow.storeId}
                        className={`transition-colors ${
                          isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-3 px-4 font-black text-white">{storeRow.storeCode}</td>
                        <td className="py-3 px-4 text-slate-300">{storeRow.city}</td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{storeRow.storeName}</td>
                        <td className="py-3 px-4">
                          <StockBadge quantity={storeRow.stockQty} storeCode={storeRow.storeCode} />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStore({
                                id: storeRow.storeId,
                                storeCode: storeRow.storeCode,
                                storeName: storeRow.storeName,
                                city: storeRow.city,
                              });
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isSelected ? 'SELECTED' : 'SELECT'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): ProofPanel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProofPanel
            title="Catalog Invariant Evidence"
            service="PostgreSQL"
            action="GET /products/:id"
            proof="Multi-Store Stock Ledger"
          >
            {/* Source info */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Inventory Source:</span>
                <span className="text-indigo-400 font-bold">PostgreSQL [inventory]</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Across Stores:</span>
                <span className="text-white font-extrabold">{product.totalStock ?? 0} Units</span>
              </div>
            </div>

            {/* Reconciliation Comparison with OpenSearch */}
            {reconciliationRow && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Reconciliation Sync Check
                  </span>
                  <SyncBadge status={reconciliationRow.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">PG Total Stock:</span>
                  <span className="text-white font-bold">{reconciliationRow.pgTotalStock}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">OpenSearch Stock:</span>
                  <span className="text-sky-300 font-bold">{reconciliationRow.osTotalStock}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500">Indexed Cities:</span>
                  <span className="text-slate-300 truncate max-w-[140px]">
                    {reconciliationRow.osCities?.join(', ') || 'None'}
                  </span>
                </div>
              </div>
            )}

            {/* Direct Link to Search Verification */}
            <Link
              to={`/?q=${encodeURIComponent(product.name)}&city=${encodeURIComponent(selectedStore?.city || '')}`}
              className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold transition-all flex items-center justify-between shadow-md"
            >
              <span>View in Search (OpenSearch)</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            </Link>

            {/* Raw JSON Contract Viewer */}
            <JsonViewer
              data={product}
              title="GET /products/:id Contract JSON"
              defaultOpen={false}
              maxHeight="max-h-56"
            />
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
