import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import {
  ShoppingBag,
  Store,
  Activity,
  ArrowRight,
  Database,
  Radio,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  User,
  MapPin
} from 'lucide-react';

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
    enterAsGuest,
    healthStatus,
    loadingInitial,
  } = useApp();

  // Local selection states for customer card
  const [customerSearch, setCustomerSearch] = useState('');
  const [card1CustomerId, setCard1CustomerId] = useState(selectedCustomer?.id || '');
  const [card1StoreId, setCard1StoreId] = useState(selectedStore?.id || '');

  // Local selection state for POS card
  const [card2StoreId, setCard2StoreId] = useState(selectedStore?.id || '');

  // Filtered customer list for Card 1
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  // Card 1: Enter Storefront
  function handleEnterCustomer(e) {
    e.preventDefault();
    const cust = customers.find((c) => c.id === card1CustomerId) || customers[0];
    const store = stores.find((s) => s.id === card1StoreId) || stores[0];
    if (cust) setSelectedCustomer(cust);
    if (store) setSelectedStore(store);
    setRole('customer');
    navigate('/');
  }

  // Card 1: Guest entry
  function handleEnterGuest(e) {
    e.preventDefault();
    enterAsGuest();
    navigate('/');
  }

  // Card 2: Enter POS Terminal
  function handleEnterStore(e) {
    e.preventDefault();
    const store = stores.find((s) => s.id === card2StoreId) || stores[0];
    if (store) setSelectedStore(store);
    setRole('store');
    navigate('/pos');
  }

  // Card 3: Enter Admin Control Tower
  function handleEnterAdmin(e) {
    e.preventDefault();
    setRole('admin');
    navigate('/xray');
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#070B16] text-[#EEF2FF] selection:bg-indigo-500 selection:text-white">
      {/* LEFT PANEL (~45%) — Brand & Live Infrastructure Status */}
      <div className="relative w-full lg:w-[45%] flex flex-col justify-between p-8 lg:p-14 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-gradient-to-br from-[#0B1020] via-[#070B16] to-[#101730]">
        {/* Animated ambient mesh gradients */}
        <div className="absolute top-[-15%] left-[-15%] w-[450px] h-[450px] rounded-full bg-gradient-to-br from-indigo-600/25 via-violet-600/20 to-transparent blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tl from-cyan-500/15 via-saffron/10 to-transparent blur-3xl pointer-events-none" />

        {/* Top: Logotype & Tagline */}
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/30">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-2xl lg:text-3xl tracking-tight text-white font-sans">
                  SMART<span className="text-indigo-400">MART</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                  v1.2 Contract
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono tracking-wide">
                One inventory. Every channel.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Indian omnichannel retail meets distributed systems.
            </h1>
            <p className="text-sm lg:text-base text-slate-400 leading-relaxed max-w-lg font-sans">
              Physical retail stores across 5 Indian metro cities, integrated into a unified transactional inventory pipeline backed by Aiven PostgreSQL, Apache Kafka, and OpenSearch.
            </p>
          </div>
        </div>

        {/* Middle Feature Highlights */}
        <div className="relative z-10 my-8 flex flex-col gap-3 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-ink-800/50 border border-slate-800/60 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Atomic Stock Isolation — Single-statement conditional SQL prevents oversell under 50-way concurrency.</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-ink-800/50 border border-slate-800/60 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span>Transactional Outbox — Guaranteed Kafka publication via PostgreSQL lease recovery.</span>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-ink-800/50 border border-slate-800/60 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span>Cross-Service Reconciliation — Live sync between PostgreSQL truth and OpenSearch index.</span>
          </div>
        </div>

        {/* Bottom: Live Infrastructure Telemetry Strip */}
        <div className="relative z-10 flex flex-col gap-3 pt-6 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 tracking-wider">
              Live Cluster Status (GET /health)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Host: localhost:4000
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
            {/* PG */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                PG
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {healthStatus?.pg?.toUpperCase() || 'UP'}
              </span>
            </div>

            {/* Kafka */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                KAFKA
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {healthStatus?.kafka?.toUpperCase() || 'UP'}
              </span>
            </div>

            {/* OpenSearch */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                SEARCH
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {healthStatus?.opensearch?.toUpperCase() || 'UP'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL (~55%) — Role Portal Cards */}
      <div className="w-full lg:w-[55%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto">
        <div className="max-w-xl w-full mx-auto flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-mono font-bold text-saffron tracking-widest uppercase">
              Select Demo Role
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Choose your entry perspective
            </h2>
            <p className="text-xs lg:text-sm text-slate-400">
              Each role unlocks an environment-tailored experience with its own navigation and live proof instruments.
            </p>
          </div>

          {/* PORTAL CARDS */}
          <div className="flex flex-col gap-4">
            {/* CARD 1: CUSTOMER STOREFRONT */}
            <div className="p-5 sm:p-6 rounded-2xl bg-ink-800/70 border border-saffron/30 hover:border-saffron/60 transition-all duration-300 shadow-xl shadow-saffron/5 group flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-saffron/15 text-saffron border border-saffron/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShoppingBag className="w-5 h-5 text-saffron-bright" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Shop as Customer</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-saffron/20 text-saffron-soft border border-saffron/30 uppercase">
                        Retail Experience
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Explore OpenSearch catalog, test fuzzy search, and place idempotent checkouts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Customer Select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                    <User className="w-3 h-3 text-saffron" />
                    Customer Identity
                  </label>
                  <select
                    value={card1CustomerId}
                    onChange={(e) => setCard1CustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-saffron cursor-pointer"
                  >
                    {customers.slice(0, 20).map((c) => (
                      <option key={c.id} value={c.id} className="bg-ink-900 text-slate-200">
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Store Select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-saffron" />
                    Store Hub & City
                  </label>
                  <select
                    value={card1StoreId}
                    onChange={(e) => setCard1StoreId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-saffron cursor-pointer"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-ink-900 text-slate-200">
                        {s.storeCode} · {s.city}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleEnterCustomer}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-saffron to-amber-600 hover:from-saffron-bright hover:to-amber-500 text-ink-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-saffron/20 transition-all active:scale-98"
                >
                  <span>Enter Storefront</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleEnterGuest}
                  className="text-xs font-mono text-saffron hover:text-saffron-bright transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Continue as guest (c01 / BLR-01) →</span>
                </button>
              </div>
            </div>

            {/* CARD 2: PHYSICAL POS TERMINAL */}
            <div className="p-5 sm:p-6 rounded-2xl bg-ink-800/70 border border-amber-500/30 hover:border-amber-500/60 transition-all duration-300 shadow-xl shadow-amber-500/5 group flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Store className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Store Terminal · POS</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                        Physical Store Cashier
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ring up walk-in sales against the same live inventory with before/after sync.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="flex-1">
                  <select
                    value={card2StoreId}
                    onChange={(e) => setCard2StoreId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-ink-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} className="bg-ink-900 text-slate-200">
                        {s.storeCode} · {s.storeName} ({s.city})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleEnterStore}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 transition-all active:scale-98 shrink-0"
                >
                  <span>Open Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* CARD 3: OPERATIONS CONSOLE (ADMIN) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-ink-800/70 border border-cyan/30 hover:border-cyan/60 transition-all duration-300 shadow-xl shadow-cyan/5 group flex flex-col gap-4 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-cyan/15 text-cyan border border-cyan/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Activity className="w-5 h-5 text-cyan" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">Operations Console · Admin</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan/20 text-cyan border border-cyan/30 uppercase">
                        Control Room
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Race Arena · Chaos fault injection · 10/10 Invariants · Cross-service reconciliation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-mono text-slate-400">
                  Full operator clearance across all services.
                </span>
                <button
                  type="button"
                  onClick={handleEnterAdmin}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-cyan-deep hover:from-cyan hover:to-cyan-500 text-ink-950 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan/20 transition-all active:scale-98"
                >
                  <span>Enter Control Tower</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-4 text-center">
            <p className="text-xs font-mono text-slate-500">
              Demo build — choose a role to explore. All data is seeded.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
