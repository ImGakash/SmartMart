import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Zap,
  BookOpen,
  Database,
  Radio,
  Search,
  ShieldAlert,
  ShoppingBag,
  Terminal,
  Server,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../state/AppContext.jsx';
import { apiGet } from '../../api/client.js';
import RoleSwitcher from '../RoleSwitcher.jsx';
import ToastContainer from '../Toast.jsx';

export default function AdminShell() {
  const { healthStatus, toasts, dismissToast } = useApp();
  const location = useLocation();

  // Active Chaos fault state
  const [hasActiveFault, setHasActiveFault] = useState(false);

  // Poll chaos status every 5s
  useEffect(() => {
    let isMounted = true;
    async function checkChaos() {
      try {
        const chaos = await apiGet('/admin/chaos');
        if (isMounted && chaos) {
          const isAnyOn = Object.values(chaos).some(Boolean);
          setHasActiveFault(isAnyOn);
        }
      } catch (e) {}
    }
    checkChaos();
    const timer = setInterval(checkChaos, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#070B16] text-[#EEF2FF] flex flex-col font-sans admin-grid-pattern">
      {/* Top Status Bar */}
      <header className="sticky top-0 z-40 bg-[#0B1020]/95 border-b border-slate-800 backdrop-blur-md px-4 lg:px-8 py-2.5 transition-colors">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <Link to="/xray" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan via-cyan-deep to-indigo-600 flex items-center justify-center shadow-md shadow-cyan/20 group-hover:scale-105 transition-transform">
                <Activity className="w-4 h-4 text-ink-950 font-black" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-white">
                  SMART<span className="text-cyan">MART</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan/15 text-cyan border border-cyan/30 uppercase tracking-wider">
                  OPERATIONS CONSOLE
                </span>
              </div>
            </Link>
          </div>

          {/* Center / Right: System Telemetry & Chaos Alert & Role Switcher */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Active Fault Warning Badge */}
            {hasActiveFault && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold animate-pulse shadow-lg shadow-rose-950/50">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>CHAOS FAULT ACTIVE</span>
              </div>
            )}

            {/* Health pill */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 rounded-lg bg-ink-950/80 border border-slate-800 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Database className="w-3 h-3 text-indigo-400" />
                <span className={healthStatus?.pg === 'up' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  PG: {healthStatus?.pg?.toUpperCase() || 'UP'}
                </span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Radio className="w-3 h-3 text-amber-400" />
                <span className={healthStatus?.kafka === 'up' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  KAFKA: {healthStatus?.kafka?.toUpperCase() || 'UP'}
                </span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Search className="w-3 h-3 text-cyan" />
                <span className={healthStatus?.opensearch === 'up' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  SEARCH: {healthStatus?.opensearch?.toUpperCase() || 'UP'}
                </span>
              </span>
            </div>

            {/* Switch Role */}
            <RoleSwitcher className="border-cyan/30 text-cyan hover:border-cyan" />
          </div>
        </div>
      </header>

      {/* Main Layout: Left Sidebar + Content Area */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto flex flex-col md:flex-row gap-6 p-4 lg:p-8">
        {/* Left Sidebar Menu */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6">
          <div className="p-4 rounded-2xl bg-ink-800/80 border border-slate-800/80 backdrop-blur-md flex flex-col gap-2 shadow-xl">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              Mission Control
            </span>

            <nav className="flex flex-col gap-1.5 font-mono text-xs">
              <NavLink
                to="/xray"
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl transition-all flex items-center justify-between font-bold ${
                    isActive
                      ? 'bg-cyan/15 text-cyan border border-cyan/40 shadow-glow-cyan'
                      : 'text-slate-300 hover:text-white hover:bg-ink-700/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-cyan" />
                  <span>Control Tower</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </NavLink>

              <NavLink
                to="/race"
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl transition-all flex items-center justify-between font-bold ${
                    isActive
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-950/40'
                      : 'text-slate-300 hover:text-white hover:bg-ink-700/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-rose-400" />
                  <span>Race Arena</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </NavLink>

              <NavLink
                to="/demo"
                className={({ isActive }) =>
                  `px-3 py-2.5 rounded-xl transition-all flex items-center justify-between font-bold ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-lg shadow-sky-950/40'
                      : 'text-slate-300 hover:text-white hover:bg-ink-700/60'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-sky-400" />
                  <span>Runbook</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 opacity-60" />
              </NavLink>
            </nav>

            {/* Quick Demo Access (for presenter) */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-3">
                Presenter Shortcuts
              </span>
              <Link
                to="/"
                className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-ink-700/40 text-xs font-mono flex items-center gap-2"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-saffron" />
                <span>Storefront View</span>
              </Link>
              <Link
                to="/pos"
                className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-ink-700/40 text-xs font-mono flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>POS View</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
