import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AppProvider } from './state/AppContext.jsx';
import Layout from './components/Layout.jsx';

import Storefront from './pages/Storefront.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import CartCheckout from './pages/CartCheckout.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import PosSimulator from './pages/PosSimulator.jsx';
import RaceArena from './pages/RaceArena.jsx';
import XRayDashboard from './pages/XRayDashboard.jsx';
import DemoRunbook from './pages/DemoRunbook.jsx';

// Redirect helper for /order/:id -> /orders/:id
function OrderRedirect() {
  const { id } = useParams();
  return <Navigate to={`/orders/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Storefront />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="cart" element={<CartCheckout />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="order/:id" element={<OrderRedirect />} />
            <Route path="pos" element={<PosSimulator />} />
            <Route path="race" element={<RaceArena />} />
            <Route path="xray" element={<XRayDashboard />} />
            <Route path="admin/proof" element={<Navigate to="/xray" replace />} />
            <Route path="demo" element={<DemoRunbook />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
