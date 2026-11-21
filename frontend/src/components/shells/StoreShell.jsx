import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Receipt, Clock, Store, PlusCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../state/AppContext.jsx';
import RoleSwitcher from '../RoleSwitcher.jsx';
import ToastContainer from '../Toast.jsx';

export default function StoreShell() {
  const { selectedStore, setSelectedStore, stores, toasts, dismissToast } = useApp();
  const [currentDateTime, setCurrentDateTime] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setCurrentDateTime(`${dateStr} · ${timeStr}`);
    }

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  function handleTriggerNewBill() {
    window.dispatchEvent(new CustomEvent('pos:new-bill'));
  }

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#1F2937] flex flex-col font-sans relative z-10 selection:bg-blue-600 selection:text-white">
      {/* Light Professional Billing Header (Vyapar / Busy / myBillBook style) */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] px-4 lg:px-6 py-2.5 shadow-2xs transition-colors no-print">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Store App Identity & Store Selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[6px] bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-[#111827] tracking-tight">
                    SmartMart <span className="text-[#1D4ED8]">Billing POS</span>
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-[#1D4ED8] border border-blue-100 uppercase">
                    Counter Cashier
                  </span>
                </div>
              </div>
            </div>

            {/* Active Branch / Store Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2.5 py-1 text-xs text-[#1F2937]">
              <Store className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
              <span className="text-[11px] text-[#6B7280] font-medium hidden sm:inline">Store:</span>
              <select
                value={selectedStore?.id || ''}
                onChange={(e) => {
                  const found = stores.find((s) => s.id === e.target.value);
                  if (found) setSelectedStore(found);
                }}
                className="bg-transparent font-semibold text-xs text-[#1F2937] focus:outline-none cursor-pointer pr-1"
                aria-label="Select Store"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white text-[#1F2937]">
                    {s.storeCode} — {s.storeName} ({s.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Live Clock, "New Bill" Button, Switch Role */}
          <div className="flex items-center gap-3">
            {/* Live Indian Standard Time & Date */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-[#6B7280] bg-[#F8FAFC] px-2.5 py-1 rounded-[6px] border border-[#E2E8F0]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDateTime}</span>
            </div>

            {/* Quick Action: New Bill */}
            <button
              type="button"
              onClick={handleTriggerNewBill}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#1F2937] font-medium text-xs transition-colors cursor-pointer shadow-2xs"
              title="Start a fresh bill"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>New Bill</span>
            </button>

            {/* Switch Role Button */}
            <RoleSwitcher className="!bg-white hover:!bg-slate-50 !text-[#1F2937] !border-[#E2E8F0] !shadow-2xs text-xs" />
          </div>
        </div>
      </header>

      {/* Main Billing Content Area */}
      <main className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto px-4 py-4 md:py-5">
        <Outlet />
      </main>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
