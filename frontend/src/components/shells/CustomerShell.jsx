import React from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { ShoppingBag, Search, ShoppingCart, Store, User } from 'lucide-react';
import { useApp } from '../../state/AppContext.jsx';
import RoleSwitcher from '../RoleSwitcher.jsx';
import ToastContainer from '../Toast.jsx';

export default function CustomerShell() {
  const {
    stores,
    selectedStore,
    setSelectedStore,
    selectedCustomer,
    cartCount,
    role,
    toasts,
    dismissToast,
  } = useApp();

  const isGuest = role === 'guest';

  return (
    <div className="min-h-screen bg-[#070B16] text-[#EEF2FF] flex flex-col font-sans customer-mesh">
      {/* Fixed Header */}
      <header className="sticky top-0 z-40 bg-[#0B1020]/90 border-b border-slate-800/80 backdrop-blur-md px-4 lg:px-8 py-3 transition-colors">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand & Customer Nav */}
          <div className="flex items-center gap-6 lg:gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold tracking-tight text-xl text-white">
                    SMART<span className="text-saffron-bright">MART</span>
                  </span>
                  <span className="bg-saffron/15 text-saffron-bright border border-saffron/30 text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold">
                    {isGuest ? 'Guest' : 'Storefront'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Omnichannel Retail Chain
                </span>
              </div>
            </Link>

            {/* Menu Buttons */}
            <nav className="flex items-center gap-1.5 bg-ink-950/70 p-1 rounded-xl border border-slate-800">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-saffron text-ink-950 font-black shadow-md shadow-saffron/20'
                      : 'text-slate-300 hover:text-white hover:bg-ink-800'
                  }`
                }
              >
                <Search className="w-3.5 h-3.5" />
                <span>Shop</span>
              </NavLink>

              <NavLink
                to="/cart"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                    isActive
                      ? 'bg-saffron text-ink-950 font-black shadow-md shadow-saffron/20'
                      : 'text-slate-300 hover:text-white hover:bg-ink-800'
                  }`
                }
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Cart</span>
                {cartCount > 0 && (
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-500 text-white min-w-[16px] text-center shadow-sm">
                    {cartCount}
                  </span>
                )}
              </NavLink>
            </nav>
          </div>

          {/* Right: Customer & Store Selectors + Role Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Customer Chip */}
            <div className="flex items-center gap-2 bg-ink-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-sm text-xs font-mono">
              <User className="w-3.5 h-3.5 text-saffron shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-0.5">
                  Customer
                </span>
                <span className="text-xs font-bold text-slate-200 truncate max-w-[150px]">
                  {isGuest ? 'Guest (c01)' : selectedCustomer?.name || 'Customer'}
                </span>
              </div>
            </div>

            {/* Store / City Selector */}
            <div className="flex items-center gap-2 bg-ink-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-sm">
              <Store className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-0.5">
                  Fulfillment Store
                </span>
                <select
                  value={selectedStore?.id || ''}
                  onChange={(e) => {
                    const found = stores.find((s) => s.id === e.target.value);
                    if (found) setSelectedStore(found);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
                  aria-label="Select Store"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id} className="bg-ink-900 text-slate-200">
                      {s.storeCode} · {s.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Icon Quick Link */}
            <Link
              to="/cart"
              className="p-2 rounded-lg bg-ink-800 hover:bg-ink-700 text-slate-200 transition-colors relative border border-slate-800"
              title="Cart"
            >
              <ShoppingCart className="w-4 h-4 text-saffron" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-saffron text-ink-950 min-w-[18px] text-center shadow-md">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Switch Role */}
            <RoleSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10">
        <Outlet />
      </main>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
