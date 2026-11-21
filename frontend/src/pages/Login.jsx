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
  MapPin,
  User,
  Users
} from 'lucide-react';

const C01_ID = '30000000-0000-4000-8000-000000000001';
const C02_ID = '30000000-0000-4000-8000-000000000002';
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
    selectedCustomer,
    setSelectedCustomer,
    setRole,
    healthStatus: appHealthStatus,
  } = useApp();

  const [navigatingRole, setNavigatingRole] = useState(null);
  
  // Customer selection state for Card 1
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    selectedCustomer?.id || C01_ID
  );

  // Guest demo identity selector state
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState(C01_ID);

  // POS Store selector state
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [selectedPosStoreId, setSelectedPosStoreId] = useState('');

  // Live health state
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

  // Update default customer ID if not set
  useEffect(() => {
    if (customers && customers.length > 0 && !selectedCustomerId) {
      const defaultCustomer =
        customers.find((c) => c.id === C01_ID) || customers[0];
      setSelectedCustomerId(defaultCustomer.id);
    }
  }, [customers, selectedCustomerId]);

  // BUTTON 1 — Continue as Customer
  function handleEnterCustomer(targetCustomerId) {
    if (navigatingRole) return;
    setNavigatingRole('customer');

    const customerId = targetCustomerId || selectedCustomerId || C01_ID;
    const customer =
      customers.find((c) => c.id === customerId) ||
      customers[0] ||
      { id: C01_ID, name: 'Asha Rao', email: 'c01@demo.smartmart.in', city: 'Bengaluru' };

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

  // BUTTON 4 — Toggle Guest Demo Identity Selector
  function handleToggleGuestPicker() {
    setShowGuestPicker((prev) => !prev);
  }

  // Login as Guest with specific identity (c01 or c02)
  function handleEnterGuestWithCustomer(targetGuestId) {
    if (navigatingRole) return;
    setNavigatingRole('guest');

    const guestId = targetGuestId || selectedGuestId || C01_ID;
    const guestCustomer =
      customers.find((c) => c.id === guestId) ||
      (guestId === C02_ID
        ? { id: C02_ID, name: 'Vikram Malhotra (Guest)', email: 'c02@demo.smartmart.in', city: 'Bengaluru' }
        : { id: C01_ID, name: 'Asha Rao (Guest)', email: 'c01@demo.smartmart.in', city: 'Bengaluru' });

    const guestStore =
      stores.find((s) => s.id === SEEDED_STORE_ID) ||
      stores[0] ||
      { id: SEEDED_STORE_ID, storeCode: 'BLR-01', storeName: 'SmartMart Indiranagar', city: 'Bengaluru' };

    setSelectedCustomer(guestCustomer);
    setSelectedStore(guestStore);
    setRole('guest');
    navigate('/');
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-white text-[#212121] font-sans relative z-10 selection:bg-indigo-600 selection:text-white">
      {/* Top Header Bar with Top-Left SmartMart Logo exactly like other pages */}
      <header className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Top-Left: Exact SmartMart Brand Wordmark & Icon from other pages */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-200">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight text-slate-900">
                Smart<span className="text-indigo-600">Mart</span>
              </span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Omnichannel
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right: Retail stores badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span className="font-medium text-slate-800">Retail Stores Across All Metro Cities</span>
        </div>
      </header>

      {/* Main Center Stage: White Screen with Centered Context & Card */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center">
        {/* Centered Heading */}
        <div className="flex flex-col items-center text-center max-w-xl mb-8">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 shadow-2xs text-indigo-700 text-[12px] font-semibold mb-3">
            <MapPin className="w-3.5 h-3.5 text-indigo-600" />
            <span>Retail Stores Across All Metro Cities</span>
          </div>
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">
            SmartMart Omnichannel Network
          </h1>
          <p className="text-[14px] text-slate-500 mt-2 max-w-lg leading-relaxed">
            Unified real-time inventory synchronization across physical retail stores and online channels in major metro hubs.
          </p>
        </div>

        {/* Centered Login Card */}
        <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-[10px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.06)] flex flex-col">
          {/* 1. SmartMart Wordmark */}
          <h2 className="text-[20px] font-semibold text-[#2874F0] tracking-tight text-center">
            SmartMart
          </h2>

          {/* 2. Tagline */}
          <p className="text-[14px] font-normal text-slate-500 text-center mt-1 mb-6">
            One inventory. Every channel.
          </p>

          {/* 3. Role Selection Sections */}
          <div className="flex flex-col gap-4">
            {/* SECTION 1 — Customer Role with Dropdown (GET /customers) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[12px] text-slate-600 px-0.5">
                <label
                  htmlFor="customer-account-selector"
                  className="font-medium text-slate-700 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Customer Account:</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {customers.length > 0 ? `${customers.length} seeded` : 'c01–c60'}
                </span>
              </div>

              {customers.length === 0 ? (
                <div className="h-[38px] bg-slate-100 rounded-[6px] animate-pulse" />
              ) : (
                <select
                  id="customer-account-selector"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full h-[38px] px-3 bg-white border border-slate-200 rounded-[6px] text-[13px] text-slate-800 focus:outline-none focus:border-[#FF9F00] cursor-pointer"
                >
                  {customers.map((c, idx) => {
                    const code = `c${String(idx + 1).padStart(2, '0')}`;
                    return (
                      <option key={c.id} value={c.id}>
                        {code} · {c.name} ({c.email})
                      </option>
                    );
                  })}
                </select>
              )}

              <button
                type="button"
                onClick={() => handleEnterCustomer(selectedCustomerId)}
                disabled={Boolean(navigatingRole)}
                className="w-full h-[40px] px-5 py-2 rounded-[6px] bg-[#FF9F00] hover:bg-[#E58F00] text-white text-[14px] font-medium flex items-center justify-center relative cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
              >
                {navigatingRole === 'customer' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2.5 shrink-0" />
                ) : (
                  <ShoppingBag className="w-4 h-4 mr-2.5 shrink-0" />
                )}
                <span>Continue as Customer</span>
              </button>
            </div>

            {/* SECTION 2 — Open Store Terminal (POS) */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTogglePosStoreSelector}
                disabled={Boolean(navigatingRole)}
                className="w-full h-[40px] px-5 py-2 rounded-[6px] bg-[#F59E0B] hover:bg-[#D97706] text-white text-[14px] font-medium flex items-center justify-between cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
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
                <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                  <label
                    htmlFor="pos-store-selector"
                    className="text-[12px] font-medium text-slate-600"
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
                        className="flex-1 h-[38px] px-3 bg-white border border-slate-200 rounded-[6px] text-[14px] text-slate-800 focus:outline-none focus:border-[#F59E0B] cursor-pointer"
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
            </div>

            {/* SECTION 3 — Enter Operations Console (Admin) */}
            <button
              type="button"
              onClick={handleEnterAdmin}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[40px] px-5 py-2 rounded-[6px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[14px] font-medium flex items-center justify-center relative cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {navigatingRole === 'admin' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2.5 shrink-0" />
              ) : (
                <Activity className="w-4 h-4 mr-2.5 shrink-0" />
              )}
              <span>Enter Operations Console (Admin)</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-4" />

          {/* SECTION 4 — Continue as Guest / Select Demo Identity */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleToggleGuestPicker}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[36px] px-4 rounded-[6px] border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-between cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="flex items-center">
                {navigatingRole === 'guest' ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Users className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                )}
                <span>Continue as Guest</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showGuestPicker ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Simplified Demo Identity Selector for Guest (only c01 and c02) */}
            {showGuestPicker && (
              <div className="flex flex-col gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="guest-identity-selector"
                    className="text-[12px] font-semibold text-slate-800"
                  >
                    Select Demo Identity
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Race Demo
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 leading-tight">
                  Select an independent identity for this browser to test concurrent carts:
                </p>

                {/* Simplified dropdown: ONLY c01 and c02 */}
                <div className="flex items-center gap-2">
                  <select
                    id="guest-identity-selector"
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                    className="flex-1 h-[36px] px-2.5 bg-white border border-slate-200 rounded-[6px] text-[12px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value={C01_ID}>c01 · Asha Rao (c01@demo.smartmart.in)</option>
                    <option value={C02_ID}>c02 · Vikram Malhotra (c02@demo.smartmart.in)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleEnterGuestWithCustomer(selectedGuestId)}
                    disabled={Boolean(navigatingRole)}
                    className="h-[36px] px-3.5 rounded-[6px] bg-slate-800 hover:bg-slate-900 text-white text-[12px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60"
                  >
                    {navigatingRole === 'guest' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Enter'
                    )}
                  </button>
                </div>

                {/* Quick 1-click identity cards for two browsers */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleEnterGuestWithCustomer(C01_ID)}
                    disabled={Boolean(navigatingRole)}
                    className={`p-2 rounded-[6px] text-left border cursor-pointer transition-all ${
                      selectedGuestId === C01_ID
                        ? 'bg-white border-indigo-400 ring-1 ring-indigo-300 text-indigo-900'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>c01 · Browser 1</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">Asha Rao</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEnterGuestWithCustomer(C02_ID)}
                    disabled={Boolean(navigatingRole)}
                    className={`p-2 rounded-[6px] text-left border cursor-pointer transition-all ${
                      selectedGuestId === C02_ID
                        ? 'bg-white border-indigo-400 ring-1 ring-indigo-300 text-indigo-900'
                        : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>c02 · Browser 2</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">Vikram Malhotra</div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live System Status Strip */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-center">
            {healthLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-slate-200/70 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-slate-200/70 rounded-full animate-pulse" />
                <div className="h-5 w-22 bg-slate-200/70 rounded-full animate-pulse" />
              </div>
            ) : healthError || !healthData ? (
              <span className="text-[11px] font-normal text-slate-400">
                Status unavailable
              </span>
            ) : (
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {HEALTH_SERVICES.map(({ key, label }) => {
                  const isUp = healthData[key] === 'up';
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-500"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isUp ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                      />
                      <span className="font-medium text-slate-700">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Metro Retail Stores Strip below the card */}
        <div className="w-full max-w-2xl flex flex-col items-center mt-8">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Metro Retail Hubs
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              Bengaluru (Indiranagar · Koramangala)
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              Mumbai (Bandra)
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              Delhi (Connaught Place)
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              Hyderabad (Hitec City)
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-medium">
              Chennai (T Nagar)
            </span>
          </div>
          <p className="text-[12px] text-slate-400 mt-3 text-center">
            Real-time stock synchronization across all physical stores and online channels
          </p>
        </div>
      </main>

      {/* Clean White Screen Footer */}
      <footer className="w-full bg-white border-t border-slate-200/80 px-4 sm:px-8 py-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
        <span>SmartMart Omnichannel Architecture · PostgreSQL · Apache Kafka · OpenSearch</span>
        <span className="mt-1 sm:mt-0">Live Multi-Metro Retail Store Network</span>
      </footer>
    </div>
  );
}
