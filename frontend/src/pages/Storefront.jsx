import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import StockBadge from '../components/StockBadge.jsx';
import ProofPanel from '../components/ProofPanel.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import {
  Search,
  AlertTriangle,
  Plus,
  RotateCcw,
  Store,
  ShoppingBag,
  ExternalLink,
  Zap,
  Sparkles,
  Database
} from 'lucide-react';

const CATEGORIES = ['All', 'Electronics', 'Audio', 'Appliances', 'Footwear', 'Apparel'];

export default function Storefront() {
  const { selectedStore, selectedCustomer, stores, refreshCart, showToast } = useApp();

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [maxPricePaise, setMaxPricePaise] = useState(3500000); // Up to ₹35,000

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

  // Debounce search query by 300ms
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
        // Primary search call: GET /search
        const response = await apiGet('/search', { params });
        if (isCancelled) return;

        setSearchDegraded(false);
        setRawSearchResponse(response);
        setHits(response.hits || []);
        setTotalHits(response.total ?? response.hits?.length ?? 0);
        setSearchTook(response.took || 0);
      } catch (err) {
        // If /search returns 503, show amber banner and fall back to GET /products
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

            // Map fallback products to search doc shape
            const fallbackHits = (fallbackProducts || []).map((p) => ({
              productId: p.id,
              sku: p.sku,
              name: p.name,
              brand: p.brand,
              category: p.category,
              pricePaise: p.pricePaise,
              imageUrl: p.imageUrl,
              description: '',
              availability: stores.map((s) => ({
                storeId: s.id,
                storeCode: s.storeCode,
                city: s.city,
                stockQty: 5,
              })),
            }));

            setHits(fallbackHits);
            setTotalHits(fallbackHits.length);
            setSearchTook(0);
            setRawSearchResponse({ degraded: true, count: fallbackHits.length });
          } catch (fbErr) {
            if (!isCancelled) {
              showToast({
                type: 'error',
                code: fbErr.code || 'CATALOG_ERROR',
                message: fbErr.message,
              });
            }
          }
        } else {
          if (!isCancelled) {
            showToast({
              type: 'error',
              code: err.code || 'SEARCH_ERROR',
              message: err.message,
            });
          }
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

  // Handle Add to Cart (Advisory Stock rule)
  async function handleAddToCart(e, product) {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedStore?.id) {
      showToast({
        type: 'error',
        code: 'STORE_REQUIRED',
        message: 'Please select a store in the top bar before adding items.',
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
        message: `Added "${product.name}" to cart (${selectedStore.storeCode})`,
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

  function handleResetFilters() {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedCity('');
    setSelectedCategory('All');
    setMaxPricePaise(3500000);
  }

  // Find first highlight fragment in search results
  const firstHighlight = useMemo(() => {
    for (const h of hits) {
      if (h.highlight?.name?.[0]) return h.highlight.name[0];
      if (h.highlight?.description?.[0]) return h.highlight.description[0];
    }
    return null;
  }, [hits]);

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* 503 Degradation Amber Banner */}
      {searchDegraded && (
        <div className="bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-4 lg:p-5 flex items-center justify-between gap-4 text-amber-200 shadow-xl shadow-amber-950/40 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-wide text-white uppercase font-mono">
                Search unavailable — showing database catalog
              </div>
              <div className="text-sm text-amber-200/90 font-medium">
                Source: PostgreSQL (degraded — no typo tolerance). OpenSearch index is unreachable.
              </div>
            </div>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
            FALLBACK ACTIVE
          </span>
        </div>
      )}

      {/* Main Layout: Left (8 cols) = Search & Product Grid; Right (4 cols) = SearchProofPanel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Section: Filters & Grid */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Top Search & Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search input with 300ms debounce */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products or typos (e.g. 'bluetoth', 'vacum')..."
                  className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-10 pr-9 py-2.5 text-sm font-medium text-white placeholder:text-slate-500 transition-all outline-none"
                  id="search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* City Dropdown Filter */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <Store className="w-4 h-4 text-indigo-400 shrink-0" />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-2"
                  aria-label="Filter City"
                >
                  <option value="" className="bg-slate-900">All Cities</option>
                  {distinctCities.map((city) => (
                    <option key={city} value={city} className="bg-slate-900">
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset */}
              {(searchQuery || selectedCategory !== 'All' || selectedCity || maxPricePaise < 3500000) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors flex items-center justify-center"
                  title="Reset filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Chips Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Cards Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 py-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl h-80 animate-pulse p-4" />
              ))}
            </div>
          ) : hits.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl py-16 px-4 text-center flex flex-col items-center justify-center gap-3">
              <ShoppingBag className="w-10 h-10 text-slate-600" />
              <div className="text-lg font-bold text-white">No products found</div>
              <p className="text-xs text-slate-400 max-w-sm">
                No items match your query or city stock filter. Try resetting filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {hits.map((product) => {
                const storeAvailability = product.availability?.find(
                  (a) => a.storeId === selectedStore?.id
                );
                const stockQty = storeAvailability ? storeAvailability.stockQty : 0;
                const isAdding = addingProductId === product.productId;
                const highlightedName = product.highlight?.name?.[0];

                return (
                  <Link
                    key={product.productId}
                    to={`/product/${product.productId}`}
                    className="group bg-slate-900 border border-slate-800/90 hover:border-indigo-500/60 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-indigo-950/20 transition-all duration-200"
                  >
                    {/* Thumbnail & Stock Badge */}
                    <div className="relative aspect-video bg-slate-950 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute top-2.5 left-2.5">
                        <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-950/90 text-slate-300 border border-slate-800">
                          {product.sku}
                        </span>
                      </div>

                      <div className="absolute top-2.5 right-2.5">
                        <StockBadge quantity={stockQty} storeCode={selectedStore?.storeCode} />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span className="font-bold">{product.brand}</span>
                          <span className="text-[10px] text-slate-500">{product.category}</span>
                        </div>

                        <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                          {highlightedName ? (
                            <span
                              dangerouslySetInnerHTML={{ __html: highlightedName }}
                              className="[&_mark]:bg-amber-400 [&_mark]:text-slate-950 [&_mark]:px-1 [&_mark]:rounded-sm"
                            />
                          ) : (
                            product.name
                          )}
                        </h3>
                      </div>

                      {/* Price & Add to Cart */}
                      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <Price paise={product.pricePaise} className="text-lg text-white font-extrabold" />

                        <button
                          type="button"
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={isAdding}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold transition-all flex items-center gap-1 shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Section: SearchProofPanel (Sticky Right Rail) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProofPanel
            title="Search Engine Proof"
            service={searchDegraded ? 'PostgreSQL' : 'OpenSearch'}
            action={`GET /search?q=${debouncedQuery || ''}`}
            proof={searchDegraded ? 'Direct DB Fallback' : 'Fuzzy multi_match'}
          >
            {/* Source Declaration: Required Sentence */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-1 font-mono text-xs ${
                searchDegraded
                  ? 'bg-amber-950/70 border-amber-500/60 text-amber-200'
                  : 'bg-sky-950/70 border-sky-500/60 text-sky-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="uppercase text-[10px] font-bold">Execution Source</span>
                <ProofBadge
                  status={searchDegraded ? 'warn' : 'pass'}
                  label={searchDegraded ? 'PostgreSQL' : 'OpenSearch'}
                />
              </div>
              <div className="font-bold text-white text-sm mt-0.5">
                {searchDegraded
                  ? 'Source: PostgreSQL (degraded — no typo tolerance)'
                  : 'Results served by OpenSearch — not PostgreSQL.'}
              </div>
            </div>

            {/* Query Metadata */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Query Sent:</span>
                <span className="text-indigo-300 font-bold">
                  {debouncedQuery ? `"${debouncedQuery}"` : '(browse match_all)'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Latency:</span>
                <span className="text-white font-bold">{searchTook}ms</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Total Matched:</span>
                <span className="text-emerald-400 font-extrabold">{totalHits} docs</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active City:</span>
                <span className="text-slate-200 font-bold">{selectedCity || 'All Metros'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400">Active Category:</span>
                <span className="text-slate-200 font-bold">{selectedCategory}</span>
              </div>
            </div>

            {/* Highlight Fragment Proof */}
            {firstHighlight && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5 font-mono text-xs">
                <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>OpenSearch &lt;mark&gt; Highlight Fragment</span>
                </span>
                <div
                  dangerouslySetInnerHTML={{ __html: firstHighlight }}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs leading-relaxed [&_mark]:bg-amber-400 [&_mark]:text-slate-950 [&_mark]:font-bold [&_mark]:px-1 [&_mark]:rounded-sm"
                />
              </div>
            )}

            {/* Collapsible raw JSON response */}
            <JsonViewer
              data={rawSearchResponse}
              title="GET /search Contract JSON"
              defaultOpen={false}
              maxHeight="max-h-56"
            />
          </ProofPanel>
        </div>
      </div>
    </div>
  );
}
