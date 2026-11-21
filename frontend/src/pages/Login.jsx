import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { checkHealth } from '../api/client.js';
import {
  ShoppingBag,
  Store,
  Activity,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Database,
  Radio
} from 'lucide-react';

const SEEDED_CUSTOMER_ID = '30000000-0000-4000-8000-000000000001';
const SEEDED_STORE_ID = '20000000-0000-4000-8000-000000000001';

const HEALTH_SERVICES = [
  { key: 'pg', label: 'PostgreSQL' },
  { key: 'kafka', label: 'Kafka' },
  { key: 'opensearch', label: 'OpenSearch' },
];

export default function Login() {
  const navigate = useNavigate();
  const {
    stores,
    customers,
    selectedStore,
    setSelectedStore,
    setSelectedCustomer,
    setRole,
    enterAsGuest,
    healthStatus: appHealthStatus,
  } = useApp();

  const [navigatingRole, setNavigatingRole] = useState(null);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [selectedPosStoreId, setSelectedPosStoreId] = useState('');
  const [healthData, setHealthData] = useState(appHealthStatus || null);
  const [healthLoading, setHealthLoading] = useState(!appHealthStatus);
  const [healthError, setHealthError] = useState(false);

  // Sync / fetch live health status
  useEffect(() => {
    let isMounted = true;
    if (appHealthStatus) {
      setHealthData(appHealthStatus);
      setHealthLoading(false);
      setHealthError(false);
      return;
    }

    async function fetchHealth() {
      try {
        const data = await checkHealth();
        if (isMounted) {
          setHealthData(data);
          setHealthLoading(false);
        }
      } catch {
        if (isMounted) {
          setHealthError(true);
          setHealthLoading(false);
        }
      }
    }
    fetchHealth();

    return () => {
      isMounted = false;
    };
  }, [appHealthStatus]);

  // Set default POS store ID once stores are available
  useEffect(() => {
    if (stores && stores.length > 0 && !selectedPosStoreId) {
      const defaultStore =
        stores.find((s) => s.id === (selectedStore?.id || SEEDED_STORE_ID)) ||
        stores[0];
      setSelectedPosStoreId(defaultStore.id);
    }
  }, [stores, selectedStore, selectedPosStoreId]);

  // BUTTON 1 — Continue as Customer
  function handleEnterCustomer() {
    if (navigatingRole) return;
    setNavigatingRole('customer');

    const customer =
      customers.find((c) => c.id === SEEDED_CUSTOMER_ID) ||
      customers[0] ||
      { id: SEEDED_CUSTOMER_ID, name: 'Asha Rao', email: 'c01@demo.smartmart.in', city: 'Bengaluru' };

    const store =
      stores.find((s) => s.id === SEEDED_STORE_ID) ||
      stores[0] ||
      { id: SEEDED_STORE_ID, storeCode: 'BLR-01', storeName: 'SmartMart Indiranagar', city: 'Bengaluru' };

    setSelectedCustomer(customer);
    setSelectedStore(store);
    setRole('customer');
    navigate('/');
  }

  // BUTTON 2 — Toggle inline POS store selector
  function handleTogglePosStoreSelector() {
    setShowStorePicker((prev) => !prev);
  }

  // Launch POS Terminal with chosen store
  function handleLaunchPos(storeId) {
    if (navigatingRole) return;
    setNavigatingRole('store');

    const targetId = storeId || selectedPosStoreId || SEEDED_STORE_ID;
    const store =
      stores.find((s) => s.id === targetId) ||
      stores[0] ||
      { id: SEEDED_STORE_ID, storeCode: 'BLR-01', storeName: 'SmartMart Indiranagar', city: 'Bengaluru' };

    setSelectedStore(store);
    setRole('store');
    navigate('/pos');
  }

  // BUTTON 3 — Enter Operations Console (Admin)
  function handleEnterAdmin() {
    if (navigatingRole) return;
    setNavigatingRole('admin');
    setRole('admin');
    navigate('/xray');
  }

  // BUTTON 4 / SECONDARY — Continue as Guest
  function handleEnterGuest() {
    if (navigatingRole) return;
    setNavigatingRole('guest');
    enterAsGuest();
    navigate('/');
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-[#F1F3F6] text-[#212121] font-sans relative z-10 selection:bg-[#2874F0] selection:text-white">
      {/* Full-Screen Top Header Bar */}
      <header className="w-full bg-white border-b border-[#E0E0E0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#2874F0] flex items-center justify-center text-white font-bold text-base shadow-sm">
            SM
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-semibold text-[#2874F0] tracking-tight">
              SmartMart
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F1F3F6] text-[#64748B] border border-[#E0E0E0]">
              Omnichannel Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E0E0E0] text-[11px] text-[#64748B]">
            <span className="w-2 h-2 rounded-full bg-[#388E3C] ring-2 ring-emerald-100" />
            <span className="font-medium text-[#212121]">Aiven Cloud Live</span>
          </div>
        </div>
      </header>

      {/* Main Full-Screen Split Content */}
      <div className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
        {/* Left Side: SmartMart Platform Showcase (Fills the previously empty screen) */}
        <div className="flex-1 max-w-[620px] flex flex-col gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>HIGH-PERFORMANCE OMNICHANNEL ENGINE</span>
            </div>
            <h2 className="text-[28px] sm:text-[34px] font-bold text-[#212121] leading-tight tracking-tight mb-3">
              One Authoritative Inventory. <br className="hidden sm:inline" />
              Every Channel Synchronized.
            </h2>
            <p className="text-[14px] sm:text-[15px] text-[#64748B] leading-relaxed">
              SmartMart unites customer e-commerce storefronts, physical store POS terminals, and automated warehouse fulfillment with real-time consistency. Powered by PostgreSQL ACID transactions, Kafka transactional outbox streaming, and OpenSearch.
            </p>
          </div>

          {/* 3 Channels Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-3.5 shadow-sm">
              <div className="w-7 h-7 rounded-[6px] bg-[#EFF6FF] text-[#2874F0] flex items-center justify-center mb-2.5">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="text-[13px] font-semibold text-[#212121] mb-1">
                Storefront
              </div>
              <div className="text-[11px] text-[#64748B] leading-relaxed">
                OpenSearch faceted search & real-time SSE checkout timeline.
              </div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-3.5 shadow-sm">
              <div className="w-7 h-7 rounded-[6px] bg-[#FFFBEB] text-[#D97706] flex items-center justify-center mb-2.5">
                <Store className="w-4 h-4" />
              </div>
              <div className="text-[13px] font-semibold text-[#212121] mb-1">
                Store POS
              </div>
              <div className="text-[11px] text-[#64748B] leading-relaxed">
                Cashier barcode register & instant row-lock stock decrement.
              </div>
            </div>

            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-3.5 shadow-sm">
              <div className="w-7 h-7 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-2.5">
                <Activity className="w-4 h-4" />
              </div>
              <div className="text-[13px] font-semibold text-[#212121] mb-1">
                Control Tower
              </div>
              <div className="text-[11px] text-[#64748B] leading-relaxed">
                Kafka outbox streaming, chaos testing & 10/10 invariant audits.
              </div>
            </div>
          </div>

          {/* Architecture Pipeline Flow Strip */}
          <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-3.5 sm:p-4 shadow-sm">
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#388E3C]" />
              <span>Event-Driven Architecture Pipeline</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">PostgreSQL</div>
                <div className="text-[10px] text-[#64748B]">ACID State</div>
              </div>
              <div className="p-2 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">Outbox Relay</div>
                <div className="text-[10px] text-[#64748B]">10s lease loop</div>
              </div>
              <div className="p-2 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">Kafka Stream</div>
                <div className="text-[10px] text-[#64748B]">order & inventory</div>
              </div>
              <div className="p-2 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">OpenSearch</div>
                <div className="text-[10px] text-[#64748B]">Sub-second hits</div>
              </div>
            </div>
          </div>

          {/* Live Data Summary Pills */}
          <div className="flex items-center gap-4 text-[12px] text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2874F0]" />
              <strong>36</strong> Seeded Products
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <strong>6</strong> Metro Stores
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#388E3C]" />
              <strong>10/10</strong> Invariant Checks
            </span>
          </div>
        </div>

        {/* Right Side: THE EXACT SAME LOGIN CARD AS BEFORE (VERBATIM) */}
        <div className="w-full max-w-[420px] bg-white border border-[#E0E0E0] rounded-[8px] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex flex-col shrink-0">
          {/* Environment Banner per Section 2C */}
          <div className="mb-4 p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E0E0E0] text-center">
            <p className="text-[12px] text-[#878787] italic leading-relaxed">
              Demo Environment — Role-based access simulation. No real authentication required.
            </p>
          </div>

          {/* 1. SmartMart Wordmark */}
          <h1 className="text-[20px] font-semibold text-[#2874F0] tracking-tight text-center">
            SmartMart
          </h1>

          {/* 2. Tagline */}
          <p className="text-[14px] font-normal text-[#878787] text-center mt-1 mb-6">
            One inventory. Every channel.
          </p>

          {/* 3. Role Buttons */}
          <div className="flex flex-col gap-3">
            {/* BUTTON 1 — Continue as Customer */}
            <button
              type="button"
              onClick={handleEnterCustomer}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[38px] px-5 py-2 rounded-[6px] bg-[#FF9F00] hover:bg-[#E58F00] text-white text-[14px] font-medium flex items-center justify-center relative cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
            >
              {navigatingRole === 'customer' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2.5 shrink-0" />
              ) : (
                <ShoppingBag className="w-4 h-4 mr-2.5 shrink-0" />
              )}
              <span>Continue as Customer</span>
            </button>

            {/* BUTTON 2 — Open Store Terminal (POS) */}
            <button
              type="button"
              onClick={handleTogglePosStoreSelector}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[38px] px-5 py-2 rounded-[6px] bg-[#F59E0B] hover:bg-[#D97706] text-white text-[14px] font-medium flex items-center justify-between cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
            >
              <div className="flex items-center">
                {navigatingRole === 'store' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2.5 shrink-0" />
                ) : (
                  <Store className="w-4 h-4 mr-2.5 shrink-0" />
                )}
                <span>Open Store Terminal (POS)</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform ${
                  showStorePicker ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Inline Store Selector Dropdown for POS */}
            {showStorePicker && (
              <div className="flex flex-col gap-2 p-3 bg-[#F8FAFC] border border-[#E0E0E0] rounded-[6px]">
                <label
                  htmlFor="pos-store-selector"
                  className="text-[12px] font-medium text-[#878787]"
                >
                  Select Store Location:
                </label>

                {stores.length === 0 ? (
                  <div className="h-[38px] bg-slate-200/70 rounded-[6px] animate-pulse" />
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      id="pos-store-selector"
                      value={selectedPosStoreId}
                      onChange={(e) => {
                        setSelectedPosStoreId(e.target.value);
                        handleLaunchPos(e.target.value);
                      }}
                      className="flex-1 h-[38px] px-3 bg-white border border-[#E0E0E0] rounded-[6px] text-[14px] text-[#212121] focus:outline-none focus:border-[#F59E0B] cursor-pointer"
                      autoFocus
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.storeCode} · {s.city}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleLaunchPos(selectedPosStoreId)}
                      disabled={Boolean(navigatingRole)}
                      className="h-[38px] px-4 rounded-[6px] bg-[#F59E0B] hover:bg-[#D97706] text-white text-[14px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60"
                    >
                      {navigatingRole === 'store' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Enter'
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BUTTON 3 — Enter Operations Console (Admin) */}
            <button
              type="button"
              onClick={handleEnterAdmin}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[38px] px-5 py-2 rounded-[6px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[14px] font-medium flex items-center justify-center relative cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
            >
              {navigatingRole === 'admin' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2.5 shrink-0" />
              ) : (
                <Activity className="w-4 h-4 mr-2.5 shrink-0" />
              )}
              <span>Enter Operations Console (Admin)</span>
            </button>
          </div>

          {/* 4. Divider Line */}
          <div className="border-t border-[#E0E0E0] my-4" />

          {/* 5. Secondary Link/Button — Continue as Guest */}
          <button
            type="button"
            onClick={handleEnterGuest}
            disabled={Boolean(navigatingRole)}
            className="w-full h-[38px] px-5 py-2 rounded-[6px] border border-[#E0E0E0] bg-transparent hover:bg-[#F8FAFC] text-[#212121] text-[14px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {navigatingRole === 'guest' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" />
            ) : null}
            <span>Continue as Guest</span>
          </button>

          {/* 6. Footer Note */}
          <p className="text-[12px] font-normal text-[#878787] text-center mt-4 leading-normal">
            Demo build — role selection only, no passwords required. All data is seeded.
          </p>

          {/* 7. Live System Status Strip */}
          <div className="mt-4 pt-3 border-t border-[#E0E0E0] flex items-center justify-center">
            {healthLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-slate-200/70 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-slate-200/70 rounded-full animate-pulse" />
                <div className="h-5 w-22 bg-slate-200/70 rounded-full animate-pulse" />
              </div>
            ) : healthError || !healthData ? (
              <span className="text-[11px] font-normal text-[#878787]">
                Status unavailable
              </span>
            ) : (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {HEALTH_SERVICES.map(({ key, label }) => {
                  const isUp = healthData[key] === 'up';
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F1F3F6] border border-[#E0E0E0] text-[11px] text-[#878787]"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isUp ? 'bg-[#388E3C]' : 'bg-[#D32F2F]'
                        }`}
                      />
                      <span className="font-medium text-[#212121]">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-Screen Footer Bar */}
      <footer className="w-full bg-white border-t border-[#E0E0E0] px-4 sm:px-8 py-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#878787]">
        <span>SmartMart Omnichannel Architecture · PostgreSQL · Apache Kafka · OpenSearch</span>
        <span className="mt-1 sm:mt-0">Demo Simulation Environment · Active Consistency Guarantee</span>
      </footer>
    </div>
  );
}
