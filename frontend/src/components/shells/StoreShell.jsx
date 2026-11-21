import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Terminal, Clock, Store } from 'lucide-react';
import { useApp } from '../../state/AppContext.jsx';
import RoleSwitcher from '../RoleSwitcher.jsx';
import ToastContainer from '../Toast.jsx';

export default function StoreShell() {
  const { selectedStore, toasts, dismissToast } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#050811] text-[#FBBF24] flex flex-col font-mono selection:bg-amber-500 selection:text-black">
      {/* High-contrast Terminal Header */}
      <header className="sticky top-0 z-40 bg-[#070B16] border-b-2 border-amber-500/40 px-4 lg:px-8 py-3 transition-colors shadow-lg shadow-black/80">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Terminal Identity */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center font-black shadow-md shadow-amber-500/30">
              <Terminal className="w-5 h-5 stroke-[2.5]" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-white tracking-wider">
                  SMARTMART <span className="text-amber-400">POS TERMINAL</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  Cashier Mode
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Store className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 font-bold">
                  {selectedStore?.storeCode || 'BLR-01'} · {selectedStore?.storeName || 'Store'} ({selectedStore?.city || 'Bengaluru'})
                </span>
              </div>
            </div>

            {/* Menu: Terminal only */}
            <nav className="ml-4 pl-4 border-l border-slate-800 hidden sm:flex items-center">
              <NavLink
                to="/pos"
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm shadow-amber-500/30"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Register</span>
              </NavLink>
            </nav>
          </div>

          {/* Right: Live Clock & Switch Role */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black/60 border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-amber-300 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-bold tracking-widest">{currentTime}</span>
            </div>

            <RoleSwitcher className="border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-white bg-black/70" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative z-10 bg-[#050811]">
        <Outlet />
      </main>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
