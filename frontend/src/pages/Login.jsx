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
  MapPin
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

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-[#F1F3F6] px-4 py-8 sm:px-6 lg:px-8 text-[#212121] font-sans relative z-10 selection:bg-[#2874F0] selection:text-white">
      {/* Top Header Section: Retail Store Across All Metro Cities */}
      <div className="flex flex-col items-center text-center max-w-xl my-auto pt-2 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E0E0E0] shadow-xs text-[#2874F0] text-[12px] font-semibold mb-3">
          <MapPin className="w-3.5 h-3.5 text-[#2874F0]" />
          <span>Retail Stores Across All Metro Cities</span>
        </div>
        <h1 className="text-[24px] sm:text-[28px] font-bold text-[#212121] tracking-tight">
          SmartMart Omnichannel Network
        </h1>
        <p className="text-[13px] sm:text-[14px] text-[#64748B] mt-1.5 max-w-md leading-relaxed">
          Unified real-time inventory synchronization across physical retail stores and online channels in major metro hubs.
        </p>
      </div>

      {/* Center Section: Centered Login Card */}
      <div className="w-full max-w-[420px] bg-white border border-[#E0E0E0] rounded-[8px] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.08)] flex flex-col my-auto">
        {/* 1. SmartMart Wordmark */}
        <h2 className="text-[20px] font-semibold text-[#2874F0] tracking-tight text-center">
          SmartMart
        </h2>

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

        {/* Live System Status Strip */}
        <div className="mt-6 pt-4 border-t border-[#E0E0E0] flex items-center justify-center">
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

      {/* Bottom Section: Metro Cities Store Network Badges */}
      <div className="w-full max-w-2xl flex flex-col items-center mt-6 mb-2">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Metro Retail Hubs
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#388E3C] ring-2 ring-emerald-100" />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
          <span className="px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-xs font-medium text-[#212121]">
            Bengaluru (Indiranagar · Koramangala)
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-xs font-medium text-[#212121]">
            Mumbai (Bandra)
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-xs font-medium text-[#212121]">
            Delhi (Connaught Place)
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-xs font-medium text-[#212121]">
            Hyderabad (Hitec City)
          </span>
          <span className="px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-xs font-medium text-[#212121]">
            Chennai (T Nagar)
          </span>
        </div>
        <p className="text-[11px] text-[#878787] mt-3 text-center">
          Real-time stock synchronization across all physical stores and online channels
        </p>
      </div>
    </div>
  );
}
