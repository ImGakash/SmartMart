import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { ArrowLeftRight, LogOut } from 'lucide-react';

export default function RoleSwitcher({ className = '' }) {
  const { role, switchRole } = useApp();
  const navigate = useNavigate();

  function handleSwitch() {
    switchRole();
    navigate('/login');
  }

  return (
    <button
      type="button"
      onClick={handleSwitch}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border border-slate-700/60 bg-ink-800/80 hover:bg-ink-700 text-slate-300 hover:text-white cursor-pointer hover:border-slate-500 shadow-sm ${className}`}
      title="Switch to another role / portal"
    >
      <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
      <span>Switch Role</span>
    </button>
  );
}
