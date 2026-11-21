import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';

export default function RoleGate({ children }) {
  const { role, showToast } = useApp();
  const location = useLocation();
  const path = location.pathname;

  // 1. If not authenticated / no role selected -> redirect to /login
  if (!role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Store Terminal guard: can ONLY access /pos
  if (role === 'store') {
    if (path !== '/pos') {
      return <Navigate to="/pos" replace />;
    }
  }

  // 3. Customer / Guest guard: cannot access /pos, /xray, /race, /demo
  if (role === 'customer' || role === 'guest') {
    const adminOrPosRoutes = ['/pos', '/xray', '/race', '/demo', '/admin/proof'];
    const isRestricted = adminOrPosRoutes.some((r) => path === r || path.startsWith(`${r}/`));

    if (isRestricted) {
      // Show toast on redirection
      setTimeout(() => {
        showToast({
          type: 'info',
          message: 'Switch to Admin to open the Operations Console.',
        });
      }, 0);
      return <Navigate to="/" replace />;
    }
  }

  // 4. Admin role has access to all routes for presenting
  return children;
}
