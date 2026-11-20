import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import StockBadge from '../components/StockBadge.jsx';
import {
  Search,
  AlertTriangle,
  Plus,
  RotateCcw,
  Store,
  ShoppingBag
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
                stockQty: 5, // fallback nominal
              })),
            }));

            setHits(fallbackHits);
            setTotalHits(fallbackHits.length);
            setSearchTook(0);
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

  // Handle Add to Cart
  // Rule 4: Stock shown in the UI is ADVISORY. Never block add-to-cart client-side based on stock;
  // let the server return 409 INSUFFICIENT_STOCK and show it as a toast:
  // "Only {available} left — you asked for {requested}".
  async function handleAddToCart(product) {
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
      // Passes ApiError straight to toast which parses INSUFFICIENT_STOCK per Rule 5
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

  // Quick reset for filters
  function handleResetFilters() {
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedCity('');
    setSelectedCategory('All');
    setMaxPricePaise(3500000);
  }

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Search Degradation Amber Banner (Intentional Fallback) */}
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
                OpenSearch engine is offline (HTTP 503). Graceful degradation active: browsing PostgreSQL direct catalog.
              </div>
            </div>
          </div>
          <span className="font-mono text-xs px-3 py-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
            FALLBACK MODE
          </span>
        </div>
      )}

      {/* Top Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 lg:p-6 shadow-xl flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input with 300ms debounce */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, or typos (e.g. 'bluetoth', 'vacum')..."
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-12 pr-10 py-3.5 text-base font-medium text-white placeholder:text-slate-500 transition-all outline-none"
              id="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-sm font-bold"
                title="Clear query"
              >
                ✕
              </button>
            )}
          </div>

          {/* City Dropdown Filter (from /stores) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5">
              <Store className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-0.5">
                  Filter City
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-3"
                  aria-label="Filter by City"
                >
                  <option value="" className="bg-slate-900">All Cities (All Stores)</option>
                  {distinctCities.map((city) => (
                    <option key={city} value={city} className="bg-slate-900">
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price Max Slider */}
            <div className="hidden sm:flex flex-col bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 min-w-[200px]">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold mb-1">
                <span>Max Price</span>
                <Price paise={maxPricePaise} className="text-indigo-400 text-xs" />
              </div>
              <input
                type="range"
                min="100000"
                max="3500000"
                step="50000"
                value={maxPricePaise}
                onChange={(e) => setMaxPricePaise(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Reset Button */}
            {(searchQuery || selectedCategory !== 'All' || selectedCity || maxPricePaise < 3500000) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-bold"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Chips Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2 shrink-0">
            Category:
          </span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Stats & Active Store Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="text-white font-bold">{totalHits}</span> products found
          </span>
          {searchTook > 0 && (
            <span className="text-slate-500">
              (in <span className="text-indigo-400 font-bold">{searchTook}ms</span> via OpenSearch)
            </span>
          )}
          {debouncedQuery && (
            <span className="text-slate-300">
              Query: <span className="text-indigo-400 font-bold">"{debouncedQuery}"</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-lg text-[11px]">
          <span className="text-slate-400">Inventory perspective:</span>
          <span className="text-indigo-300 font-bold">
            {selectedStore?.storeCode} ({selectedStore?.city})
          </span>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 py-12">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-2xl h-96 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="bg-slate-800 rounded-xl h-48 w-full" />
              <div className="space-y-3">
                <div className="bg-slate-800 h-4 rounded w-3/4" />
                <div className="bg-slate-800 h-4 rounded w-1/2" />
                <div className="bg-slate-800 h-8 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : hits.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl py-20 px-4 text-center flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="text-xl font-bold text-white">No products found</div>
          <p className="text-slate-400 text-sm max-w-md">
            No items match your active filters or query. Try adjusting your search term, city filter, or price limit.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {hits.map((product) => {
            // Find store stock for the selected store
            const storeAvailability = product.availability?.find(
              (a) => a.storeId === selectedStore?.id
            );
            const stockQty = storeAvailability ? storeAvailability.stockQty : 0;
            const isAdding = addingProductId === product.productId;

            // Highlighted name if OpenSearch returned highlight fragments
            const highlightedName = product.highlight?.name?.[0];

            return (
              <div
                key={product.productId}
                className="group bg-slate-900 border border-slate-800/90 hover:border-indigo-500/50 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-indigo-950/20 transition-all duration-200"
              >
                {/* Product Image & Badges */}
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
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-950/90 text-slate-300 border border-slate-700/80 backdrop-blur-sm">
                      {product.sku}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <StockBadge
                      quantity={stockQty}
                      storeCode={selectedStore?.storeCode}
                    />
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                      <span>{product.brand}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-300">
                        {product.category}
                      </span>
                    </div>

                    {/* Product Name with <mark> support */}
                    <h3 className="text-base font-bold text-white line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                      {highlightedName ? (
                        <span
                          dangerouslySetInnerHTML={{ __html: highlightedName }}
                          className="[&_mark]:bg-amber-400 [&_mark]:text-slate-950 [&_mark]:px-1 [&_mark]:rounded-sm"
                        />
                      ) : (
                        product.name
                      )}
                    </h3>

                    {product.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Add to Cart Action */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        Price (Paise ÷ 100)
                      </span>
                      <Price
                        paise={product.pricePaise}
                        className="text-2xl text-white font-extrabold"
                      />
                    </div>

                    {/* Never disable button based on stock per Rule 4 */}
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={isAdding}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                    >
                      {isAdding ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
