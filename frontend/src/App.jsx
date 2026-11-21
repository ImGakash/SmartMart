import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext.jsx';

import Login from './pages/Login.jsx';
import RoleGate from './components/RoleGate.jsx';
import CustomerShell from './components/shells/CustomerShell.jsx';
import StoreShell from './components/shells/StoreShell.jsx';
import AdminShell from './components/shells/AdminShell.jsx';

import Storefront from './pages/Storefront.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import CartCheckout from './pages/CartCheckout.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import PosSimulator from './pages/PosSimulator.jsx';
import RaceArena from './pages/RaceArena.jsx';
import XRayDashboard from './pages/XRayDashboard.jsx';
import DemoRunbook from './pages/DemoRunbook.jsx';

// Redirect helper for legacy /order/:id -> /orders/:id
function OrderRedirect() {
  const { id } = useParams();
  return <Navigate to={`/orders/${id}`} replace />;
}

// Shell Router: mounts the appropriate role shell based on active role and path
function ShellRouter() {
  const { role } = useApp();
  const location = useLocation();
  const path = location.pathname;

  // Store Terminal Shell
  if (role === 'store') {
    return <StoreShell />;
  }

  // Admin Shell: primary shell for /xray, /race, /demo
  if (role === 'admin') {
    if (path.startsWith('/pos')) {
      return <StoreShell />;
    }
    if (path === '/' || path.startsWith('/product') || path === '/cart' || path.startsWith('/orders')) {
      return <CustomerShell />;
    }
    return <AdminShell />;
  }

  // Default: Customer / Guest Shell
  return <CustomerShell />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Unauthenticated Role Selector / Entry Gate */}
          <Route path="/login" element={<Login />} />

          {/* Legacy redirects */}
          <Route path="/order/:id" element={<OrderRedirect />} />
          <Route path="/admin/proof" element={<Navigate to="/xray" replace />} />

          {/* Role-guarded Shell Routes */}
          <Route
            element={
              <RoleGate>
                <ShellRouter />
              </RoleGate>
            }
          >
            <Route index element={<Storefront />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="cart" element={<CartCheckout />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="pos" element={<PosSimulator />} />
            <Route path="xray" element={<XRayDashboard />} />
            <Route path="race" element={<RaceArena />} />
            <Route path="demo" element={<DemoRunbook />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
