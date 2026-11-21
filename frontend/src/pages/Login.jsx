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
  Zap,
  ShieldCheck,
  Layers,
  ArrowRight,
  Database,
  Sparkles
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

  // BUTTON 2 — Launch POS Terminal with chosen store
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

  // BUTTON 4 — Continue as Guest
  function handleEnterGuest() {
    if (navigatingRole) return;
    setNavigatingRole('guest');
    enterAsGuest();
    navigate('/');
  }

  return (
    <div className="min-h-screen w-full bg-[#F1F3F6] text-[#212121] font-sans flex flex-col selection:bg-[#2874F0] selection:text-white">
      {/* Top Application Header */}
      <header className="w-full h-16 bg-white border-b border-[#E0E0E0] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-[#2874F0] flex items-center justify-center text-white font-bold text-lg shadow-sm">
            SM
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-semibold tracking-tight text-[#2874F0]">
                SmartMart
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#F1F3F6] text-[#4F46E5] border border-[#E0E0E0]">
                Enterprise Omnichannel v2.0
              </span>
            </div>
            <span className="text-[11px] text-[#878787] hidden sm:inline">
              One authoritative inventory · Every physical & digital channel
            </span>
          </div>
        </div>

        {/* Live Cluster Health Status Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          {healthLoading ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#E0E0E0] text-[12px] text-[#878787]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Checking cloud clusters...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-white border border-[#E0E0E0] shadow-sm">
              <span className="text-[11px] font-medium text-[#878787] mr-1 hidden md:inline">
                Live Infra:
              </span>
              {HEALTH_SERVICES.map(({ key, label }) => {
                const isUp = healthData && healthData[key] === 'up';
                return (
                  <div key={key} className="flex items-center gap-1" title={`${label}: ${isUp ? 'Operational' : 'Degraded'}`}>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isUp ? 'bg-[#388E3C] ring-2 ring-emerald-100' : 'bg-[#D32F2F]'
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-[#212121] hidden sm:inline">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Full-Screen Split Workspace */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 sm:p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN: SmartMart Platform Showcase & Architecture (Col 7) */}
        <div className="lg:col-span-7 flex flex-col gap-6 lg:pr-4">
          {/* Hero Banner Card */}
          <div className="bg-white border border-[#E0E0E0] rounded-[10px] p-6 sm:p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-[12px] font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>HIGH-CONCURRENCY OMNICHANNEL PLATFORM</span>
            </div>

            <h1 className="text-[26px] sm:text-[32px] font-bold text-[#212121] leading-tight tracking-tight mb-3">
              One Unified Inventory. <br className="hidden sm:inline" />
              Every Channel Synchronized.
            </h1>

            <p className="text-[14px] sm:text-[15px] text-[#64748B] leading-relaxed mb-6">
              SmartMart unifies customer digital storefronts, in-store POS cash registers, and multi-metro warehouse fulfillment through strict ACID PostgreSQL concurrency, transactional outbox Kafka streaming, and OpenSearch sub-second product catalog queries.
            </p>

            {/* Platform Stats Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-[#F1F5F9]">
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#2874F0]">36</div>
                <div className="text-[11px] font-medium text-[#64748B]">Catalog SKUs</div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#F59E0B]">6</div>
                <div className="text-[11px] font-medium text-[#64748B]">Metro Stores</div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#388E3C]">10 / 10</div>
                <div className="text-[11px] font-medium text-[#64748B]">Invariants Audited</div>
              </div>
              <div className="p-3 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#4F46E5]">&lt; 2ms</div>
                <div className="text-[11px] font-medium text-[#64748B]">Lock Latency</div>
              </div>
            </div>
          </div>

          {/* Three Channel Architecture Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Customer Storefront */}
            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-4 flex flex-col justify-between hover:border-[#2874F0] transition-colors shadow-sm">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-[#EFF6FF] text-[#2874F0] flex items-center justify-center mb-3">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <h2 className="text-[14px] font-semibold text-[#212121] mb-1">
                  Online Storefront
                </h2>
                <p className="text-[12px] text-[#64748B] leading-relaxed">
                  OpenSearch multi-city faceted filtering, transactional reservations, and real-time SSE checkout timeline.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] font-medium text-[#2874F0] flex items-center gap-1">
                <span>Customer Channel</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* 2. In-Store POS */}
            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-4 flex flex-col justify-between hover:border-[#F59E0B] transition-colors shadow-sm">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-[#FFFBEB] text-[#D97706] flex items-center justify-center mb-3">
                  <Store className="w-4 h-4" />
                </div>
                <h2 className="text-[14px] font-semibold text-[#212121] mb-1">
                  In-Store POS Register
                </h2>
                <p className="text-[12px] text-[#64748B] leading-relaxed">
                  Barcode scanning register, cash tender flow, and instant store inventory decrement with zero negative stock.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] font-medium text-[#D97706] flex items-center gap-1">
                <span>Retail Channel</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            {/* 3. Control Tower & Operations */}
            <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-4 flex flex-col justify-between hover:border-[#4F46E5] transition-colors shadow-sm">
              <div>
                <div className="w-8 h-8 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center mb-3">
                  <Activity className="w-4 h-4" />
                </div>
                <h2 className="text-[14px] font-semibold text-[#212121] mb-1">
                  Control Tower & X-Ray
                </h2>
                <p className="text-[12px] text-[#64748B] leading-relaxed">
                  Kafka event visualizer, outbox lease monitor, flash-sale concurrency arena, and continuous invariant audits.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-[11px] font-medium text-[#4F46E5] flex items-center gap-1">
                <span>Operations Channel</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Architecture Pipeline Schematic Strip */}
          <div className="bg-white border border-[#E0E0E0] rounded-[8px] p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">
                Event-Driven Architecture Flow
              </span>
              <span className="text-[11px] font-medium text-[#388E3C] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Authoritative ACID Guarantee
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">1. PostgreSQL</div>
                <div className="text-[10px] text-[#64748B]">Atomic checkout & Outbox</div>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">2. Outbox Relay</div>
                <div className="text-[10px] text-[#64748B]">10s lease / 1s poll loop</div>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">3. Apache Kafka</div>
                <div className="text-[10px] text-[#64748B]">order-events & inventory</div>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#212121]">4. OpenSearch / Consumers</div>
                <div className="text-[10px] text-[#64748B]">Idempotent sync & SSE bus</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Role Portal / Simulation Entry (Col 5) */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-white border border-[#E0E0E0] rounded-[10px] p-6 sm:p-7 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex flex-col">
            {/* Demo Environment Disclosure Banner (Mandatory Contract requirement) */}
            <div className="mb-5 p-3 rounded-[6px] bg-[#F8FAFC] border border-[#E0E0E0] text-center">
              <p className="text-[12px] text-[#878787] italic leading-relaxed">
                Demo Environment — Role-based access simulation. No real authentication required.
              </p>
            </div>

            {/* Portal Heading */}
            <div className="mb-5">
              <h2 className="text-[20px] font-semibold text-[#212121] tracking-tight">
                Select Simulation Persona
              </h2>
              <p className="text-[13px] text-[#64748B] mt-0.5">
                Choose a role below to explore real-time omnichannel coordination:
              </p>
            </div>

            {/* Role Options Container */}
            <div className="flex flex-col gap-3.5">
              {/* PERSONA 1 — Customer Storefront */}
              <div className="border border-[#E0E0E0] rounded-[8px] p-4 bg-white hover:border-[#2874F0] hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[#EFF6FF] text-[#2874F0] flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#212121] group-hover:text-[#2874F0] transition-colors">
                        Customer Storefront
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Seeded as Asha Rao (Bengaluru)
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F1F3F6] text-[#64748B]">
                    Online
                  </span>
                </div>

                <p className="text-[12px] text-[#64748B] mb-3 leading-relaxed">
                  Browse products with live city inventory, add items to cart, and observe 5-stage SSE checkout events.
                </p>

                <button
                  type="button"
                  onClick={handleEnterCustomer}
                  disabled={Boolean(navigatingRole)}
                  className="w-full h-[38px] px-4 rounded-[6px] bg-[#2874F0] hover:bg-[#1E5DC8] text-white text-[13px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
                >
                  {navigatingRole === 'customer' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  <span>Enter Storefront</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>

              {/* PERSONA 2 — Store POS Register */}
              <div className="border border-[#E0E0E0] rounded-[8px] p-4 bg-white hover:border-[#F59E0B] hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[#FFFBEB] text-[#D97706] flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#212121] group-hover:text-[#D97706] transition-colors">
                        Physical Store POS
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        In-Store Cashier Terminal
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FFFBEB] text-[#D97706]">
                    Retail
                  </span>
                </div>

                <p className="text-[12px] text-[#64748B] mb-3 leading-relaxed">
                  Scan barcodes, process quick cash payments, and decrement physical stock with row-level locks.
                </p>

                {/* Inline Store Selector */}
                <div className="mb-3">
                  <label htmlFor="pos-store-selector" className="text-[11px] font-medium text-[#64748B] block mb-1">
                    Operating Store Hub:
                  </label>
                  {stores.length === 0 ? (
                    <div className="h-[36px] bg-slate-100 rounded-[6px] animate-pulse" />
                  ) : (
                    <select
                      id="pos-store-selector"
                      value={selectedPosStoreId}
                      onChange={(e) => setSelectedPosStoreId(e.target.value)}
                      className="w-full h-[36px] px-3 bg-[#F8FAFC] border border-[#E0E0E0] rounded-[6px] text-[13px] text-[#212121] focus:outline-none focus:border-[#F59E0B] cursor-pointer"
                    >
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.storeCode} · {s.storeName} ({s.city})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleLaunchPos(selectedPosStoreId)}
                  disabled={Boolean(navigatingRole)}
                  className="w-full h-[38px] px-4 rounded-[6px] bg-[#F59E0B] hover:bg-[#D97706] text-white text-[13px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
                >
                  {navigatingRole === 'store' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  <span>Launch POS Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>

              {/* PERSONA 3 — Operations Console (Admin) */}
              <div className="border border-[#E0E0E0] rounded-[8px] p-4 bg-white hover:border-[#4F46E5] hover:shadow-sm transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#212121] group-hover:text-[#4F46E5] transition-colors">
                        Control Tower & Ops
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Platform Administrator
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5]">
                    Admin
                  </span>
                </div>

                <p className="text-[12px] text-[#64748B] mb-3 leading-relaxed">
                  View live outbox events, run flash-sale race tests, trigger chaos faults, and audit 10/10 invariants.
                </p>

                <button
                  type="button"
                  onClick={handleEnterAdmin}
                  disabled={Boolean(navigatingRole)}
                  className="w-full h-[38px] px-4 rounded-[6px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[13px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-none"
                >
                  {navigatingRole === 'admin' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  <span>Enter Operations Console</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[#E0E0E0] my-4" />

            {/* Secondary Option: Guest Explorer */}
            <button
              type="button"
              onClick={handleEnterGuest}
              disabled={Boolean(navigatingRole)}
              className="w-full h-[38px] px-4 rounded-[6px] border border-[#E0E0E0] bg-transparent hover:bg-[#F8FAFC] text-[#212121] text-[13px] font-medium flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {navigatingRole === 'guest' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              <span>Continue as Guest (Read-Only)</span>
            </button>

            {/* Footer Note */}
            <p className="text-[11px] font-normal text-[#878787] text-center mt-3 leading-normal">
              Pre-seeded with 36 products, 6 metro hub stores, and 60 test accounts.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
