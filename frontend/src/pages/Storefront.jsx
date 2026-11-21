import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import {
  Search,
  AlertTriangle,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Database,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles
} from 'lucide-react';

const CATEGORIES = ['All', 'Electronics', 'Audio', 'Appliances', 'Footwear', 'Apparel'];

export default function Storefront() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedStore, refreshCart, showToast, stores } = useApp();

  // Search & filter state
  const urlQuery = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQuery);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCity, setSelectedCity] = useState('');
  const [maxPricePaise, setMaxPricePaise] = useState(3500000); // Up to ₹35,000

  // Collapsible proof section state (collapsed by default)
  const [proofOpen, setProofOpen] = useState(false);

  // Result state
  const [hits, setHits] = useState([]);
  const [totalHits, setTotalHits] = useState(0);
  const [searchTook, setSearchTook] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchDegraded, setSearchDegraded] = useState(false);
  const [addingProductId, setAddingProductId] = useState(null);
  const [rawSearchResponse, setRawSearchResponse] = useState(null);

  // Distinct cities from stores
  const distinctCities = useMemo(() => {
    return [...new Set(stores.map((s) => s.city))].filter(Boolean);
  }, [stores]);

  // Sync searchQuery with URL query parameter
  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch search or catalog fallback
  useEffect(() => {
    let isCancelled = false;

    async function executeQuery() {
      setLoading(true);
      const params = {};

      if (debouncedQuery.trim()) {
        params.q = debouncedQuery.trim();
      }
      if (selectedCategory && selectedCategory !== 'All') {
        params.category = selectedCategory;
      }
      if (selectedCity) {
        params.city = selectedCity;
      }
      if (maxPricePaise < 3500000) {
        params.maxPaise = maxPricePaise;
      }

      try {
        const response = await apiGet('/search', { params });
        if (isCancelled) return;

        setSearchDegraded(false);
        setRawSearchResponse(response);
        setHits(response.hits || []);
        setTotalHits(response.total ?? response.hits?.length ?? 0);
        setSearchTook(response.took || 0);
      } catch (err) {
        if (err.status === 503 || err.code === 'SEARCH_UNAVAILABLE') {
          setSearchDegraded(true);
          try {
            const fallbackProducts = await apiGet('/products', {
              params: {
                category: selectedCategory !== 'All' ? selectedCategory : undefined,
                limit: 50,
              },
            });
            if (isCancelled) return;

            setRawSearchResponse(fallbackProducts);
            const mappedHits = (fallbackProducts || []).map((p) => ({
              productId: p.id,
              sku: p.sku,
              name: p.name,
              brand: p.brand,
              category: p.category,
              pricePaise: p.pricePaise,
              imageUrl: p.imageUrl,
              availability: p.availability || [],
            }));

            let filtered = mappedHits;
            if (selectedCity) {
              const matchingStoreIds = stores
                .filter((s) => s.city.toLowerCase() === selectedCity.toLowerCase())
                .map((s) => s.id);
              filtered = filtered.filter((p) =>
                p.availability.some((a) => matchingStoreIds.includes(a.storeId) && a.stockQty > 0)
              );
            }

            setHits(filtered);
            setTotalHits(filtered.length);
            setSearchTook(4);
          } catch (fbErr) {
            if (isCancelled) return;
            showToast({
              type: 'error',
              code: fbErr.code || 'CATALOG_ERROR',
              message: fbErr.message,
            });
          }
        } else {
          if (isCancelled) return;
          showToast({
            type: 'error',
            code: err.code || 'SEARCH_ERROR',
            message: err.message,
          });
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    executeQuery();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, selectedCategory, selectedCity, maxPricePaise, stores, showToast]);

  // Handle Add to Cart
  async function handleAddToCart(e, product) {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedStore?.id) {
      showToast({
        type: 'error',
        code: 'STORE_REQUIRED',
        message: 'Please choose a fulfillment store.',
      });
      return;
    }

    setAddingProductId(product.productId);
    try {
      await apiPost('/cart/items', {
        storeId: selectedStore.id,
        productId: product.productId,
        quantity: 1,
      });

      await refreshCart();

      showToast({
        type: 'success',
        message: `Added "${product.name}" to cart`,
      });
    } catch (err) {
      showToast({
        type: 'error',
        code: err.code,
        message: err.message,
        details: err.details,
      });
    } finally {
      setAddingProductId(null);
    }
  }

  // Calculate realistic MRP and discount
  function getMrpPaise(pricePaise) {
    const raw = Math.round((pricePaise * 1.35) / 10000) * 10000;
    return Math.max(raw, pricePaise + 10000);
  }

  function getDiscountPercent(pricePaise, mrpPaise) {
    if (!mrpPaise || mrpPaise <= pricePaise) return null;
    return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
  }

  // Get stock for current selected store
  function getStoreStock(product) {
    if (!product.availability || product.availability.length === 0) return 0;
    const storeAvail = product.availability.find((a) => a.storeId === selectedStore?.id);
    return storeAvail?.stockQty ?? 0;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 503 Fallback Banner */}
      {searchDegraded && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Showing catalog from database</strong> — OpenSearch cluster is temporarily degraded. Exact match fallback active.
          </span>
        </div>
      )}

      {/* Modern Capsule Category Pills Row */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center gap-2 overflow-x-auto shadow-2xs">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1 pr-2 shrink-0">
          Categories:
        </span>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-100'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Filter / Sort / Stats Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="font-semibold text-slate-900">
            {loading ? 'Searching catalog...' : `${hits.length} products found`}
          </span>
          {selectedCategory !== 'All' && <span>in <strong className="text-slate-800">{selectedCategory}</strong></span>}
          {debouncedQuery && <span>for "<strong className="text-slate-800">{debouncedQuery}</strong>"</span>}
        </div>

        <div className="flex items-center gap-3">
          {/* City Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">City:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Metro Cities</option>
              {distinctCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* Max Price Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Price:</span>
            <select
              value={maxPricePaise}
              onChange={(e) => setMaxPricePaise(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value={3500000}>All Prices</option>
              <option value={200000}>Under ₹2,000</option>
              <option value={500000}>Under ₹5,000</option>
              <option value={1500000}>Under ₹15,000</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-14 flex flex-col items-center justify-center gap-3 shadow-2xs">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Searching inventory catalog...</span>
        </div>
      ) : hits.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-14 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
          <span className="font-semibold text-base text-slate-900">No products found</span>
          <p className="text-xs text-slate-500 max-w-sm">
            Try adjusting your search terms, clearing filters, or switching your delivery location.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedCity('');
              setMaxPricePaise(3500000);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors shadow-xs shadow-indigo-100"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {hits.map((product) => {
            const stock = getStoreStock(product);
            const inStock = stock > 0;
            const mrp = getMrpPaise(product.pricePaise);
            const discountPct = getDiscountPercent(product.pricePaise, mrp);
            const isAdding = addingProductId === product.productId;

            return (
              <Link
                key={product.productId}
                to={`/product/${product.productId}`}
                className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all duration-200 group cursor-pointer text-left relative shadow-2xs"
              >
                {/* Product Image on light podium */}
                <div className="w-full aspect-square rounded-lg bg-slate-50/70 flex items-center justify-center mb-2.5 p-2 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>

                {/* Product Info */}
                <div className="flex flex-col flex-1 justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
                      {product.brand}
                    </span>
                    <h3
                      className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug mt-0.5 group-hover:text-indigo-600 transition-colors"
                      title={product.name}
                    >
                      {product.highlight?.name ? (
                        <span
                          dangerouslySetInnerHTML={{ __html: product.highlight.name }}
                        />
                      ) : (
                        product.name
                      )}
                    </h3>
                  </div>

                  {/* Stock Pill */}
                  <div>
                    {inStock ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        In stock ({stock})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Out of stock
                      </span>
                    )}
                  </div>

                  {/* Price Row */}
                  <div className="flex flex-wrap items-baseline gap-1.5 pt-0.5">
                    <Price paise={product.pricePaise} className="text-base font-bold text-slate-900" />
                    <Price paise={mrp} className="text-xs text-slate-400 line-through font-normal" />
                    {discountPct && (
                      <span className="text-xs font-semibold text-emerald-600">
                        {discountPct}% off
                      </span>
                    )}
                  </div>

                  {/* Action Button: Add to Cart */}
                  <button
                    type="button"
                    onClick={(e) => handleAddToCart(e, product)}
                    disabled={isAdding || !inStock}
                    className="mt-2 w-full h-[36px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shadow-indigo-100 active:scale-[0.98]"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>{isAdding ? 'Adding...' : inStock ? 'Add to Cart' : 'Out of Stock'}</span>
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Small Collapsible OpenSearch Proof Section (Collapsed by Default) */}
      <div className="mt-4 border border-slate-200/90 rounded-xl bg-white overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setProofOpen(!proofOpen)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            <span>Search Engine Telemetry & Proof</span>
            <span className="font-mono text-[10px] text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full font-bold">
              {searchDegraded ? 'PostgreSQL Fallback' : 'OpenSearch Live'}
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
                <span className="text-slate-400 block text-[10px]">ENGINE</span>
                <span className="font-bold text-slate-800">
                  {searchDegraded ? 'PostgreSQL (503 Fallback)' : 'OpenSearch'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">QUERY TOOK</span>
                <span className="font-bold text-slate-800">{searchTook} ms</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">TOTAL HITS</span>
                <span className="font-bold text-slate-800">{totalHits}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-slate-400 block text-[10px]">QUERY ECHO</span>
                <span className="font-bold text-slate-800 truncate block">
                  {debouncedQuery || '(empty/browse)'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Results served by OpenSearch — not PostgreSQL. On 503 fallback, served by PostgreSQL with degraded typo tolerance.
            </p>

            {rawSearchResponse && (
              <div className="mt-1">
                <span className="text-[10px] font-mono text-slate-400 block mb-1">
                  RAW SEARCH PAYLOAD:
                </span>
                <JsonViewer data={rawSearchResponse} defaultExpanded={false} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
