import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, setActiveCustomerId, checkHealth } from '../api/client.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedStore, setSelectedStoreState] = useState(null);
  const [selectedCustomer, setSelectedCustomerState] = useState(null);
  const [cart, setCart] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [healthStatus, setHealthStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Toast manager
  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const newToast = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? (toast.type === 'error' || toast.code ? 6000 : 4000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update selected store & persist
  const setSelectedStore = useCallback((store) => {
    setSelectedStoreState(store);
    if (store?.id) {
      localStorage.setItem('smartmart_store_id', store.id);
    }
  }, []);

  // Update selected customer & sync with client.js header
  const setSelectedCustomer = useCallback((customer) => {
    setSelectedCustomerState(customer);
    if (customer?.id) {
      setActiveCustomerId(customer.id);
      localStorage.setItem('smartmart_customer_id', customer.id);
    } else {
      setActiveCustomerId(null);
    }
  }, []);

  // Fetch active cart
  const refreshCart = useCallback(async () => {
    if (!selectedCustomer?.id || !selectedStore?.id) {
      setCart(null);
      setCartCount(0);
      return null;
    }
    try {
      const data = await apiGet('/cart', {
        params: { storeId: selectedStore.id },
      });
      setCart(data);
      const totalQty = data?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      setCartCount(totalQty);
      return data;
    } catch (err) {
      // Don't show toast on routine background empty cart fetch
      console.warn('Failed to refresh cart:', err.message);
      return null;
    }
  }, [selectedCustomer?.id, selectedStore?.id]);

  // Initial load: stores, customers, health
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const [storesData, customersData] = await Promise.all([
          apiGet('/stores'),
          apiGet('/customers'),
        ]);

        if (!isMounted) return;

        setStores(storesData || []);
        setCustomers(customersData || []);

        // Restore or default store
        const savedStoreId = localStorage.getItem('smartmart_store_id');
        const initialStore =
          storesData?.find((s) => s.id === savedStoreId) ||
          storesData?.[0] ||
          null;
        setSelectedStoreState(initialStore);

        // Restore or default customer
        const savedCustomerId = localStorage.getItem('smartmart_customer_id');
        const initialCustomer =
          customersData?.find((c) => c.id === savedCustomerId) ||
          customersData?.[0] ||
          null;
        setSelectedCustomerState(initialCustomer);
        if (initialCustomer?.id) {
          setActiveCustomerId(initialCustomer.id);
        }

        // Check health
        try {
          const health = await checkHealth();
          if (isMounted) setHealthStatus(health);
        } catch (hErr) {
          if (isMounted) setHealthStatus({ pg: 'down', kafka: 'down', opensearch: 'down' });
        }

        // Periodic health polling (every 15s)
        const healthTimer = setInterval(async () => {
          if (!isMounted) return;
          try {
            const h = await checkHealth();
            if (isMounted) setHealthStatus(h);
          } catch (e) {
            if (isMounted) setHealthStatus({ pg: 'down', kafka: 'down', opensearch: 'down' });
          }
        }, 15000);

        return () => clearInterval(healthTimer);
      } catch (err) {
        if (isMounted) {
          showToast({
            type: 'error',
            code: err.code || 'INIT_ERROR',
            message: `Initialization error: ${err.message}`,
            details: err.details,
          });
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  // Re-fetch cart when store or customer changes
  useEffect(() => {
    if (selectedCustomer?.id && selectedStore?.id) {
      refreshCart();
    }
  }, [selectedCustomer?.id, selectedStore?.id, refreshCart]);

  const value = {
    stores,
    customers,
    selectedStore,
    setSelectedStore,
    selectedCustomer,
    setSelectedCustomer,
    cart,
    cartCount,
    refreshCart,
    healthStatus,
    toasts,
    showToast,
    dismissToast,
    loadingInitial,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
