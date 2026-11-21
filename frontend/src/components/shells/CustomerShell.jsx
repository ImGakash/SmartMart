import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  ShoppingCart,
  Store,
  User,
  MapPin,
  Compass,
  Check,
  ChevronDown,
  X,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../state/AppContext.jsx';
import RoleSwitcher from '../RoleSwitcher.jsx';
import ToastContainer from '../Toast.jsx';
import { requestDeviceLocation } from '../../utils/geolocation.js';

export default function CustomerShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    stores,
    selectedStore,
    setSelectedStore,
    customers,
    selectedCustomer,
    cartCount,
    role,
    toasts,
    dismissToast,
    showToast,
  } = useApp();

  const isGuest = role === 'guest';

  // Location popover state
  const [locationOpen, setLocationOpen] = useState(false);
  const [detectedCity, setDetectedCity] = useState(null);
  const [locating, setLocating] = useState(false);
  const popoverRef = useRef(null);

  // Search input in header
  const [headerSearch, setHeaderSearch] = useState(searchParams.get('q') || '');

  // Keep search input synced with URL on storefront
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setHeaderSearch(q);
  }, [searchParams]);

  // Close location popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setLocationOpen(false);
      }
    }
    if (locationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [locationOpen]);

  // Client-side auto-attempt on entry only if already granted
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((result) => {
          if (result.state === 'granted' && stores.length > 0 && !detectedCity) {
            handleDetectLocation(false);
          }
        })
        .catch(() => {});
    }
  }, [stores]);

  async function handleDetectLocation(notify = true) {
    setLocating(true);
    try {
      const result = await requestDeviceLocation(stores);
      if (result?.store) {
        setSelectedStore(result.store);
        setDetectedCity(`${result.cityName} (${result.defaultStoreCode})`);
        if (notify) {
          showToast({
            type: 'info',
            message: `Detected nearest store: ${result.cityName} (${result.defaultStoreCode}) ~${result.distanceKm} km`,
          });
        }
      }
    } catch (err) {
      // Permission denied or timeout: silent fallback to default
      if (notify) {
        showToast({
          type: 'info',
          message: 'Location unavailable — continuing with selected store.',
        });
      }
    } finally {
      setLocating(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const trimmed = headerSearch.trim();
    if (location.pathname === '/') {
      const nextParams = new URLSearchParams(searchParams);
      if (trimmed) {
        nextParams.set('q', trimmed);
      } else {
        nextParams.delete('q');
      }
      setSearchParams(nextParams);
    } else {
      navigate(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/');
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans relative z-10 selection:bg-indigo-500 selection:text-white">
      {/* Light, Airy, Modern Omnichannel Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-colors shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between gap-3 md:gap-6">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-4 shrink-0">
            <Link to="/" className="flex items-center gap-2 group select-none">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-200 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">
                    Smart<span className="text-indigo-600">Mart</span>
                  </span>
                  <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                    Omnichannel
                  </span>
                </div>
              </div>
            </Link>

            {/* Location Control ("Deliver to: City · storeCode") */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setLocationOpen(!locationOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/90 text-slate-700 text-xs transition-colors cursor-pointer border border-slate-200/90 shadow-2xs"
                title="Change delivery location / store"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] text-slate-500 leading-none">Deliver to</span>
                  <span className="font-semibold text-xs text-slate-900 truncate max-w-[140px]">
                    {selectedStore ? `${selectedStore.city} · ${selectedStore.storeCode}` : 'Select Store'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {/* Location Popover Menu */}
              {locationOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100">
                    <span className="font-semibold text-xs text-slate-900">Choose Delivery Store</span>
                    <button
                      type="button"
                      onClick={() => setLocationOpen(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Geolocation Button */}
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => handleDetectLocation(true)}
                      disabled={locating}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-60 shadow-xs shadow-indigo-100"
                    >
                      <Compass className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                      <span>{locating ? 'Detecting nearest metro...' : 'Detect my location'}</span>
                    </button>
                    {detectedCity && (
                      <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                        <span>Detected: {detectedCity}</span>
                        <span className="font-semibold text-indigo-600">Active</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Selection Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Or Select Store Manually
                    </label>
                    <select
                      value={selectedStore?.id || ''}
                      onChange={(e) => {
                        const found = stores.find((s) => s.id === e.target.value);
                        if (found) {
                          setSelectedStore(found);
                          setDetectedCity(null);
                        }
                      }}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.city} — {s.storeCode} ({s.storeName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle: Modern Light Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-[500px] relative hidden sm:block"
          >
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search products, brands and inventory..."
              className="w-full h-[38px] pl-3.5 pr-10 text-xs md:text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-900 placeholder-slate-400 rounded-lg border border-slate-200/70 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all shadow-2xs"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-[38px] px-3 text-slate-400 hover:text-indigo-600 flex items-center justify-center cursor-pointer transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Right: Customer Profile, Cart, Switch Role */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Customer Chip */}
            <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/90 shadow-2xs">
              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-slate-500 uppercase font-semibold leading-none">
                  {isGuest ? 'Guest' : 'Customer'}
                </span>
                <span className="font-semibold text-xs text-slate-900 truncate max-w-[100px] md:max-w-[130px]">
                  {isGuest ? 'c01 (Asha)' : selectedCustomer?.name || 'Customer'}
                </span>
              </div>
            </div>

            {/* Cart Link with Badge */}
            <Link
              to="/cart"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/90 text-indigo-700 font-semibold text-xs md:text-sm transition-colors border border-indigo-100 shadow-2xs"
            >
              <div className="relative flex items-center">
                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                {cartCount > 0 && (
                  <span className="ml-1.5 font-bold text-[11px] px-1.5 py-0.2 rounded-full bg-indigo-600 text-white min-w-[18px] text-center shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline">Cart</span>
            </Link>

            {/* Switch Role Button */}
            <RoleSwitcher className="!bg-slate-50 hover:!bg-slate-100 !text-slate-700 !border-slate-200 !shadow-2xs" />
          </div>
        </div>

        {/* Mobile Search Input Sub-bar */}
        <div className="sm:hidden px-4 pb-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search products, brands and inventory..."
              className="w-full h-[38px] pl-3.5 pr-10 text-xs bg-slate-100 hover:bg-slate-100/90 focus:bg-white text-slate-900 placeholder-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-[38px] px-3 text-slate-400 hover:text-indigo-600"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Page Content Container */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-4 md:py-6 flex flex-col">
        <Outlet />
      </main>

      {/* Clean modern retail footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 text-xs text-slate-500">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <span className="font-semibold text-slate-800">SmartMart Omnichannel Retail</span>
            <span>•</span>
            <span>Stores in 5 Indian Metro Cities</span>
            <span>•</span>
            <span>100% Genuine Inventory</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Aiven PostgreSQL · Apache Kafka · OpenSearch
          </div>
        </div>
      </footer>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
