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

  // Derive page title from current route
  const pageTitle =
    location.pathname === '/xray'
      ? 'Control Tower & Reconciliation'
      : location.pathname === '/race'
      ? 'Concurrency Test · Flash Sale'
      : location.pathname === '/demo'
      ? 'Demo Runbook & Invariants'
      : 'Operations Console';

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
    <div className="min-h-screen bg-[#F6F7F9] text-[#111827] flex flex-col md:flex-row font-sans relative z-10 selection:bg-indigo-500 selection:text-white">
      {/* Dark Slate Left Sidebar (#111827) */}
      <aside className="w-full md:w-60 bg-[#111827] text-[#E5E7EB] shrink-0 flex flex-col justify-between border-r border-slate-800">
        <div className="flex flex-col gap-6 p-4">
          {/* Brand Wordmark */}
          <Link to="/xray" className="flex items-center gap-2.5 px-2 py-1 select-none">
            <div className="w-7 h-7 rounded-lg bg-[#4F46E5] text-white flex items-center justify-center shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-white">
                SmartMart <span className="text-indigo-400">Ops</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Control Room</span>
            </div>
          </Link>

          {/* Primary Operations Nav */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1">
              Operations Console
            </span>
            <nav className="flex flex-col gap-1 text-xs">
              <NavLink
                to="/xray"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 font-medium ${
                    isActive
                      ? 'bg-[#4F46E5] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Activity className="w-4 h-4" />
                <span>Control Tower</span>
              </NavLink>

              <NavLink
                to="/race"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 font-medium ${
                    isActive
                      ? 'bg-[#4F46E5] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <Zap className="w-4 h-4" />
                <span>Race Arena</span>
              </NavLink>

              <NavLink
                to="/demo"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 font-medium ${
                    isActive
                      ? 'bg-[#4F46E5] text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                <BookOpen className="w-4 h-4" />
                <span>Runbook</span>
              </NavLink>
            </nav>
          </div>

          {/* Presenter Quick Links to Other Perspectives */}
          <div className="flex flex-col gap-1 pt-2 border-t border-slate-800/80">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 py-1">
              Live Preview
            </span>
            <nav className="flex flex-col gap-1 text-xs">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2 transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                <span>Storefront</span>
              </Link>
              <Link
                to="/pos"
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 flex items-center gap-2 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Store POS</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 flex flex-col gap-2">
          <div className="text-[11px] text-slate-500 font-mono">
            Aiven PG · Kafka · OS
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-6 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#111827]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Active Fault Alert Badge */}
            {hasActiveFault && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF2F2] border border-red-200 text-[#B91C1C] text-xs font-semibold animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Chaos Fault Active</span>
              </div>
            )}

            {/* Health Badges as Soft Pills */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  healthStatus?.pg === 'up'
                    ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-red-200'
                }`}
              >
                <Database className="w-3 h-3" />
                <span>PG: {healthStatus?.pg?.toUpperCase() || 'UP'}</span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  healthStatus?.kafka === 'up'
                    ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-red-200'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>KAFKA: {healthStatus?.kafka?.toUpperCase() || 'UP'}</span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  healthStatus?.opensearch === 'up'
                    ? 'bg-[#ECFDF5] text-[#047857] border-emerald-200'
                    : 'bg-[#FEF2F2] text-[#B91C1C] border-red-200'
                }`}
              >
                <Search className="w-3 h-3" />
                <span>SEARCH: {healthStatus?.opensearch?.toUpperCase() || 'UP'}</span>
              </span>
            </div>

            {/* Switch Role Button */}
            <RoleSwitcher className="!bg-white hover:!bg-slate-50 !text-[#111827] !border-[#E5E7EB] text-xs shadow-2xs" />
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
          <Outlet />
        </main>
      </div>

      {/* Toast Layer */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
