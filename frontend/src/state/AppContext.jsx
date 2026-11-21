import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, setActiveCustomerId, checkHealth } from '../api/client.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [stores, setStores] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedStore, setSelectedStoreState] = useState(null);
  const [selectedCustomer, setSelectedCustomerState] = useState(null);
  
  // Role: 'customer' | 'guest' | 'store' | 'admin' | null
  const [role, setRoleState] = useState(() => {
    try {
      return localStorage.getItem('smartmart_role') || null;
    } catch {
      return null;
    }
  });

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

  // Set Role with persistence
  const setRole = useCallback((newRole) => {
    setRoleState(newRole);
    try {
      if (newRole) {
        localStorage.setItem('smartmart_role', newRole);
      } else {
        localStorage.removeItem('smartmart_role');
      }
    } catch (e) {
      console.warn('Failed to save role to localStorage', e);
    }
  }, []);

  // Switch / Clear Role
  const switchRole = useCallback(() => {
    setRoleState(null);
    try {
      localStorage.removeItem('smartmart_role');
    } catch (e) {
      console.warn('Failed to clear role', e);
    }
  }, []);

  // Update selected store & persist
  const setSelectedStore = useCallback((store) => {
    setSelectedStoreState(store);
    if (store?.id) {
      try {
        localStorage.setItem('smartmart_store_id', store.id);
      } catch (e) {}
    }
  }, []);

  // Update selected customer & sync with client.js header
  const setSelectedCustomer = useCallback((customer) => {
    setSelectedCustomerState(customer);
    if (customer?.id) {
      setActiveCustomerId(customer.id);
      try {
        localStorage.setItem('smartmart_customer_id', customer.id);
      } catch (e) {}
    } else {
      setActiveCustomerId(null);
    }
  }, []);

  // Guest entry helper: auto-selects c01 and BLR-01 with role 'guest'
  const enterAsGuest = useCallback(() => {
    const guestCustomer =
      customers.find((c) => c.id === '30000000-0000-4000-8000-000000000001') ||
      customers[0] ||
      { id: '30000000-0000-4000-8000-000000000001', name: 'Asha Rao (Guest)', email: 'c01@demo.smartmart.in' };

    const guestStore =
      stores.find((s) => s.id === '20000000-0000-4000-8000-000000000001') ||
      stores[0] ||
      { id: '20000000-0000-4000-8000-000000000001', storeCode: 'BLR-01', storeName: 'SmartMart Indiranagar', city: 'Bengaluru' };

    setSelectedCustomer(guestCustomer);
    setSelectedStore(guestStore);
    setRole('guest');
  }, [customers, stores, setSelectedCustomer, setSelectedStore, setRole]);

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
        let savedStoreId = null;
        try {
          savedStoreId = localStorage.getItem('smartmart_store_id');
        } catch {}
        const initialStore =
          storesData?.find((s) => s.id === savedStoreId) ||
          storesData?.[0] ||
          null;
        setSelectedStoreState(initialStore);

        // Restore or default customer
        let savedCustomerId = null;
        try {
          savedCustomerId = localStorage.getItem('smartmart_customer_id');
        } catch {}
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
    role,
    setRole,
    switchRole,
    enterAsGuest,
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
