import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import Price from '../components/Price.jsx';
import { Search, Store, ShoppingBag } from 'lucide-react';

export default function Storefront() {
  const { selectedStore, selectedCustomer, stores, customers } = useApp();

  return (
    <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-8 flex flex-col gap-8">
      {/* Hero Welcome / Verification Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              GATE 1 VERIFICATION
            </span>
            <span className="text-slate-400 text-sm">Step 1 Scaffold & Core State</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
            SmartMart Omnichannel Engine
          </h1>
          <p className="text-slate-400 text-base max-w-2xl leading-relaxed">
            Dark, high-contrast, dramatic live demo tool for multi-store retail sync.
            Designed for 5-meter projector visibility with monospace contract fields.
          </p>
        </div>

        {/* Selected Store & Customer Live Stat Cards */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[200px]">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              Active Store
            </div>
            <div className="font-mono text-xl font-bold text-indigo-400">
              {selectedStore?.storeCode || '—'}
            </div>
            <div className="text-sm font-medium text-slate-300">
              {selectedStore?.city || 'Loading store...'}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[220px]">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
              Active Customer
            </div>
            <div className="font-mono text-base font-bold text-emerald-400 truncate max-w-[200px]">
              {selectedCustomer?.name || 'Loading customer...'}
            </div>
            <div className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
              {selectedCustomer?.email || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Verification Checklist Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-2">
          <div className="text-xs font-mono text-indigo-400 uppercase font-bold">Stores Loaded</div>
          <div className="text-3xl font-extrabold font-mono text-white">{stores.length}</div>
          <div className="text-xs text-slate-400">
            5 Indian cities (Bengaluru BLR-01/02, Mumbai, Delhi, Hyderabad, Chennai)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-2">
          <div className="text-xs font-mono text-emerald-400 uppercase font-bold">Customers Seeded</div>
          <div className="text-3xl font-extrabold font-mono text-white">{customers.length}</div>
          <div className="text-xs text-slate-400">
            60 seeded test buyers (c01@demo - c60@demo)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col gap-2">
          <div className="text-xs font-mono text-amber-400 uppercase font-bold">Demo Price Check</div>
          <div className="text-3xl font-extrabold text-white">
            <Price paise={129900} />
          </div>
          <div className="text-xs text-slate-400">
            129900 paise → ₹1,299.00 via Intl.NumberFormat
          </div>
        </div>
      </div>
    </div>
  );
}
