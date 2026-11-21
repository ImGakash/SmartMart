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
    setSelectedCustomer,
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
    <div className="min-h-screen bg-[#F1F3F6] text-[#212121] flex flex-col font-sans relative z-10 selection:bg-[#2874F0] selection:text-white">
      {/* Flipkart-Style Crisp Blue Header */}
      <header className="sticky top-0 z-40 bg-[#2874F0] text-white shadow-sm transition-colors">
        <div className="max-w-[1200px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3 md:gap-6">
          {/* Left: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex flex-col group select-none">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-lg md:text-xl tracking-tight text-white italic">
                  Smart<span className="text-[#FFE500]">Mart</span>
                </span>
                <span className="text-[10px] font-bold text-[#FFE500] italic leading-none pl-0.5">
                  Plus
                </span>
              </div>
              <span className="text-[10px] text-white/80 font-medium tracking-wide">
                Omnichannel Retail
              </span>
            </Link>

            {/* Location Control ("Deliver to: City · storeCode") */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setLocationOpen(!locationOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1C5BC8] hover:bg-[#1648A5] text-white text-xs transition-colors cursor-pointer border border-white/10"
                title="Change delivery location / store"
              >
                <MapPin className="w-3.5 h-3.5 text-[#FFE500] shrink-0" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="text-[10px] text-white/80 leading-none">Deliver to</span>
                  <span className="font-semibold text-xs text-white truncate max-w-[140px]">
                    {selectedStore ? `${selectedStore.city} · ${selectedStore.storeCode}` : 'Select Store'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 ml-0.5" />
              </button>

              {/* Location Popover Menu */}
              {locationOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-[6px] shadow-xl border border-[#E0E0E0] p-3 text-[#212121] z-50 text-xs animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E0E0E0]">
                    <span className="font-semibold text-xs text-[#212121]">Choose Delivery Store</span>
                    <button
                      type="button"
                      onClick={() => setLocationOpen(false)}
                      className="text-gray-400 hover:text-gray-600 p-0.5"
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
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-[6px] bg-[#2874F0] hover:bg-[#1C5BC8] text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <Compass className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
                      <span>{locating ? 'Detecting nearest metro...' : 'Detect my location'}</span>
                    </button>
                    {detectedCity && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#388E3C] bg-green-50 px-2 py-1 rounded border border-green-200">
                        <span>Detected: {detectedCity}</span>
                        <span className="font-semibold text-[#2874F0]">Active</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Selection Dropdown */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[#878787] uppercase tracking-wider">
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
                      className="w-full p-2 border border-[#E0E0E0] rounded-[6px] text-xs text-[#212121] bg-white focus:outline-none focus:border-[#2874F0] cursor-pointer"
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

          {/* Middle: Prominent Clean Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-[550px] relative hidden sm:block"
          >
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search for products, brands and more..."
              className="w-full h-[36px] pl-3 pr-10 text-xs md:text-sm bg-white text-[#212121] placeholder-gray-400 rounded-[2px] shadow-sm focus:outline-none focus:ring-1 focus:ring-white/50"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-[36px] px-3 text-[#2874F0] hover:text-[#1C5BC8] flex items-center justify-center cursor-pointer"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Right: Customer Chip, Cart, Switch Role */}
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Customer Chip */}
            <div className="flex items-center gap-1.5 text-xs text-white bg-[#1C5BC8] px-2.5 py-1.5 rounded border border-white/10">
              <User className="w-3.5 h-3.5 text-[#FFE500] shrink-0" />
              <div className="flex flex-col text-left">
                <span className="text-[9px] text-white/70 uppercase font-semibold leading-none">
                  {isGuest ? 'Guest' : 'Customer'}
                </span>
                <span className="font-semibold text-xs truncate max-w-[110px] md:max-w-[140px]">
                  {isGuest ? 'c01 (Asha)' : selectedCustomer?.name || 'Customer'}
                </span>
              </div>
            </div>

            {/* Cart Link with Badge */}
            <Link
              to="/cart"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[#1C5BC8] text-white font-medium text-xs md:text-sm transition-colors relative"
            >
              <div className="relative">
                <ShoppingCart className="w-4 h-4 text-white" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 font-bold text-[10px] px-1 py-0.2 rounded-full bg-[#FFE500] text-[#212121] min-w-[16px] text-center shadow">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="hidden md:inline font-semibold">Cart</span>
            </Link>

            {/* Switch Role Button */}
            <RoleSwitcher className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 !shadow-none" />
          </div>
        </div>

        {/* Mobile Search Input Sub-bar */}
        <div className="sm:hidden px-4 pb-2.5">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              placeholder="Search for products, brands and more..."
              className="w-full h-[36px] pl-3 pr-10 text-xs bg-white text-[#212121] placeholder-gray-400 rounded-[4px] shadow-sm focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 h-[36px] px-3 text-[#2874F0]"
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

      {/* Clean Flipkart-style retail footer */}
      <footer className="mt-auto border-t border-[#E0E0E0] bg-white py-4 text-xs text-[#878787]">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <span className="font-semibold text-[#212121]">SmartMart Retail</span>
            <span>•</span>
            <span>Bengaluru · Mumbai · Delhi · Hyderabad · Chennai</span>
            <span>•</span>
            <span>100% Genuine Inventory</span>
          </div>
          <div className="text-[11px] text-[#878787] font-mono">
            PostgreSQL · Apache Kafka · OpenSearch
          </div>
        </div>
      </footer>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
