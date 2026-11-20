import React from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  Store,
  User,
  ShoppingCart,
  Zap,
  Activity,
  Terminal,
  ShoppingBag,
  Circle,
  Database,
  Radio,
  Search
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import ToastContainer from './Toast.jsx';

export default function Layout() {
  const {
    stores,
    customers,
    selectedStore,
    setSelectedStore,
    selectedCustomer,
    setSelectedCustomer,
    cartCount,
    healthStatus,
    toasts,
    dismissToast,
  } = useApp();

  const location = useLocation();
  const isPosPage = location.pathname.startsWith('/pos');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Notification / System Health Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 lg:px-8 py-3 transition-colors">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">

          {/* Left: Brand & Main Navigation */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-xl lg:text-2xl text-white">
                    SMART<span className="text-indigo-400">MART</span>
                  </span>
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold">
                    Omnichannel
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium tracking-wide">
                  5-City Physical & Online Inventory
                </span>
              </div>
            </Link>

            {/* Nav Links: Customer & Demo Grouped */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </NavLink>

                <NavLink
                  to="/cart"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Cart</span>
                  {cartCount > 0 && (
                    <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-400 text-slate-950 min-w-[16px] text-center">
                      {cartCount}
                    </span>
                  )}
                </NavLink>
              </div>

              <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                <NavLink
                  to="/pos"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                        : 'text-amber-300/80 hover:text-amber-200 hover:bg-amber-950/40'
                    }`
                  }
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>POS Terminal</span>
                </NavLink>

                <NavLink
                  to="/race"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-rose-500 text-white shadow-sm font-black'
                        : 'text-rose-300/80 hover:text-rose-200 hover:bg-rose-950/40'
                    }`
                  }
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Race Arena</span>
                </NavLink>

                <NavLink
                  to="/xray"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                        : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-950/40'
                    }`
                  }
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Control Tower</span>
                </NavLink>

                <NavLink
                  to="/demo"
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-sky-500 text-slate-950 shadow-sm font-black'
                        : 'text-sky-300/80 hover:text-sky-200 hover:bg-sky-950/40'
                    }`
                  }
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Runbook</span>
                </NavLink>
              </div>
            </nav>
          </div>

          {/* Right: Selectors, Health & Controls */}
          <div className="flex items-center gap-3 lg:gap-4 flex-wrap">

            {/* Health pill */}
            <div className="hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span className={healthStatus?.pg === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                  PG
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span className={healthStatus?.kafka === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                  KAFKA
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span className={healthStatus?.opensearch === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                  SEARCH
                </span>
              </span>
            </div>

            {/* Store Selector */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Store className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-0.5">
                  Store
                </span>
                <select
                  value={selectedStore?.id || ''}
                  onChange={(e) => {
                    const found = stores.find((s) => s.id === e.target.value);
                    if (found) setSelectedStore(found);
                  }}
                  className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-2"
                  id="store-selector"
                  aria-label="Select Store"
                >
                  {stores.length === 0 && <option value="">Loading stores...</option>}
                  {stores.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100">
                      {s.storeCode} — {s.city} ({s.storeName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Customer Selector (Hidden on POS per contract: "No customer selector anywhere") */}
            {!isPosPage && (
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-sm">
                <User className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider leading-none mb-0.5">
                    Customer
                  </span>
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const found = customers.find((c) => c.id === e.target.value);
                      if (found) setSelectedCustomer(found);
                    }}
                    className="bg-transparent text-sm font-semibold text-slate-100 focus:outline-none cursor-pointer pr-2 max-w-[180px] truncate"
                    id="customer-selector"
                    aria-label="Select Customer"
                  >
                    {customers.length === 0 && <option value="">Loading customers...</option>}
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Cart Quick Button */}
            <Link
              to="/cart"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors relative"
              title="View Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 font-mono text-xs font-bold px-1.5 py-0.5 rounded-full bg-indigo-500 text-white min-w-[20px] text-center shadow-md">
                  {cartCount}
                </span>
              )}
            </Link>

          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
