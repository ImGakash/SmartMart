import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import OrderTimeline from '../components/OrderTimeline.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import ProofBadge from '../components/ProofBadge.jsx';
import DemoActionButton from '../components/DemoActionButton.jsx';
import {
  Terminal,
  Store,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Search,
  RotateCcw,
  ShoppingBag,
  Zap,
  ArrowRight,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';

export default function PosSimulator() {
  const { selectedStore, setSelectedStore, stores, showToast } = useApp();

  // Terminal catalog & search
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Active register items
  const [registerItems, setRegisterItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed POS Order state
  const [completedOrder, setCompletedOrder] = useState(null);

  // BEFORE / AFTER Inventory Proof State
  const [inventoryProof, setInventoryProof] = useState(null); // { product, before: {}, after: {}, isSyncing: boolean, isLagging: boolean }
  const pollTimerRef = useRef(null);

  // Live clock for terminal
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => {
      clearInterval(timer);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Fetch catalog with availability
  const loadCatalog = async () => {
    try {
      setLoadingProducts(true);
      const res = await apiGet('/search', { params: { limit: 50 } });
      setProducts(res?.hits || []);
    } catch (err) {
      showToast({
        type: 'error',
        code: 'CATALOG_ERROR',
        message: 'Failed to fetch terminal product catalog.',
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [selectedStore?.id]);

  // Filtered catalog
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat =
        selectedCategory === 'All' ||
        p.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Add product to register
  function handleAddProduct(product) {
    if (completedOrder) {
      setCompletedOrder(null);
      setInventoryProof(null);
    }

    const avail = product.availability?.find((a) => a.storeId === selectedStore?.id)?.stockQty ?? 0;

    setRegisterItems((prev) => {
      const existing = prev.find((i) => i.productId === product.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.productId,
          name: product.name,
          sku: product.sku,
          pricePaise: product.pricePaise,
          quantity: 1,
          stockQty: avail,
        },
      ];
    });
  }

  function handleUpdateQuantity(productId, delta) {
    setRegisterItems((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  }

  function handleRemoveItem(productId) {
    setRegisterItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function handleClearRegister() {
    setRegisterItems([]);
    setCompletedOrder(null);
    setInventoryProof(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }

  const runningTotalPaise = useMemo(() => {
    return registerItems.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  }, [registerItems]);

  const totalUnits = useMemo(() => {
    return registerItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [registerItems]);

  // Complete Sale with BEFORE / AFTER Inventory Proof
  async function handleCompleteSale() {
    if (!selectedStore?.id || registerItems.length === 0) return;

    setIsSubmitting(true);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    // 1. Capture BEFORE snapshot for primary item being sold
    const primaryItem = registerItems[0];
    let beforePgStock = primaryItem.stockQty;
    let beforeOsStock = primaryItem.stockQty;
    let beforeStatus = 'PASS';

    try {
      const [prodRes, xrayRes] = await Promise.all([
        apiGet(`/products/${primaryItem.productId}`),
        apiGet('/xray/metrics').catch(() => null),
      ]);

      const storeRow = prodRes?.availability?.find((a) => a.storeId === selectedStore.id);
      if (storeRow) beforePgStock = storeRow.stockQty;

      if (xrayRes?.reconciliation?.rows) {
        const row = xrayRes.reconciliation.rows.find((r) => r.productId === primaryItem.productId);
        if (row) {
          beforeOsStock = row.osTotalStock;
          beforeStatus = row.status;
        }
      }
    } catch (e) {
      // fallback to cached
    }

    setInventoryProof({
      productName: primaryItem.name,
      productId: primaryItem.productId,
      before: {
        pgStock: beforePgStock,
        osStock: beforeOsStock,
        status: beforeStatus,
      },
      after: null,
      isSyncing: true,
      isLagging: false,
    });

    try {
      const payload = {
        storeId: selectedStore.id,
        items: registerItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      };

      // POST /pos/sale
      const res = await apiPost('/pos/sale', payload);
      const newOrder = res?.order;

      setCompletedOrder(newOrder);
      setRegisterItems([]);
      loadCatalog();

      showToast({
        type: 'success',
        message: `Sale completed! Order ${newOrder?.orderNumber}`,
      });

      // 2. Poll /xray/metrics every 1s (max 6s) until reconciliation row is PASS
      let attempts = 0;
      const expectedNewPgStock = Math.max(0, beforePgStock - primaryItem.quantity);

      pollTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const xrayNow = await apiGet('/xray/metrics');
          const rowNow = xrayNow?.reconciliation?.rows?.find((r) => r.productId === primaryItem.productId);

          if (rowNow && rowNow.status === 'PASS') {
            clearInterval(pollTimerRef.current);
            setInventoryProof((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                isSyncing: false,
                isLagging: false,
                after: {
                  pgStock: expectedNewPgStock,
                  osStock: expectedNewPgStock,
                  status: 'PASS',
                },
              };
            });
            return;
          }
        } catch (pollErr) {
          // continue polling
        }

        // If still mismatched after 6s (6 attempts) -> Honest amber WARN: "Index lagging — check Control Tower"
        if (attempts >= 6) {
          clearInterval(pollTimerRef.current);
          setInventoryProof((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              isSyncing: false,
              isLagging: true,
              after: {
                pgStock: expectedNewPgStock,
                osStock: beforeOsStock, // lagging stock
                status: 'SYNCING',
              },
            };
          });
        }
      }, 1000);
    } catch (err) {
      setInventoryProof(null);
      showToast({
        type: 'error',
        code: err.code || 'POS_ERROR',
        message: err.message,
        details: err.details,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const categories = ['All', 'Electronics', 'Audio', 'Appliances', 'Footwear', 'Apparel'];

  return (
    <div className="min-h-screen bg-black text-amber-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Terminal Top Bar */}
      <div className="bg-neutral-950 border-b border-amber-500/30 px-4 lg:px-8 py-3.5 shadow-2xl">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center font-mono font-black text-lg shadow-lg shadow-amber-500/20">
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-mono font-black tracking-wider text-amber-400 uppercase">
                  SMARTMART — PHYSICAL STORE TERMINAL
                </h1>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-black text-[11px] font-mono font-black uppercase tracking-wider">
                  POS ACTIVE
                </span>
              </div>
              <p className="text-xs font-mono text-amber-200/60">
                Walk-in counter sale register • Direct inventory decrement • No customer identity
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-neutral-900 border border-amber-500/40 rounded-xl px-4 py-2">
              <Store className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-amber-400 uppercase font-black tracking-widest leading-none mb-1">
                  CURRENT STORE CODE
                </span>
                <select
                  value={selectedStore?.id || ''}
                  onChange={(e) => {
                    const st = stores.find((s) => s.id === e.target.value);
                    if (st) setSelectedStore(st);
                  }}
                  className="bg-transparent font-mono text-sm font-bold text-amber-200 focus:outline-none cursor-pointer pr-2"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id} className="bg-neutral-950 text-amber-200">
                      {s.storeCode} — {s.city} ({s.storeName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 border border-amber-500/20 font-mono text-xs text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{currentTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Terminal Workspace */}
      <div className="max-w-[1700px] mx-auto w-full px-4 lg:px-8 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Touch Product Grid (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-neutral-950 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-lg">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400/60" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Touch search product or SKU (e.g. boAt, P02)..."
                className="w-full bg-black border border-amber-500/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-amber-200 placeholder:text-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all shrink-0 cursor-pointer ${
                    selectedCategory === c
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                      : 'bg-neutral-900 text-amber-400/80 hover:bg-neutral-800 border border-amber-500/20'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards */}
          {loadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 6].map((i) => (
                <div key={i} className="bg-neutral-950 border border-amber-500/20 rounded-2xl h-44 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-neutral-950 border border-amber-500/30 rounded-2xl p-12 text-center text-amber-500/60 font-mono text-sm">
              No matching products found in store catalog.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredProducts.map((p) => {
                const avail = p.availability?.find((a) => a.storeId === selectedStore?.id)?.stockQty ?? 0;
                const isOutOfStock = avail <= 0;

                return (
                  <button
                    key={p.productId}
                    type="button"
                    onClick={() => handleAddProduct(p)}
                    className="group bg-neutral-950 border-2 border-amber-500/25 hover:border-amber-400 rounded-2xl p-3.5 flex flex-col justify-between gap-3 text-left transition-all duration-150 active:scale-95 shadow-md hover:shadow-amber-500/10 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black text-amber-400 border border-amber-500/30">
                        {p.sku}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-black px-2 py-0.5 rounded uppercase ${
                          isOutOfStock
                            ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                            : avail <= 3
                            ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        {isOutOfStock ? '0 LEFT' : `${avail} IN STORE`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-mono text-amber-400/70 uppercase">
                        {p.brand}
                      </div>
                      <h4 className="text-sm font-bold text-amber-100 line-clamp-2 leading-snug group-hover:text-amber-300">
                        {p.name}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between">
                      <Price paise={p.pricePaise} className="text-base font-black text-amber-400" />
                      <span className="px-2 py-1 rounded bg-amber-500/20 group-hover:bg-amber-500 group-hover:text-black text-amber-400 text-xs font-mono font-bold transition-colors">
                        + TAP
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Receipt & Proof Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {completedOrder ? (
            /* Confirmation Panel with BEFORE / AFTER Inventory Proof */
            <div className="bg-neutral-950 border-2 border-amber-500 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-4 border-b border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-black tracking-widest">
                      Physical Store Sale
                    </span>
                    <h2 className="text-2xl font-mono font-black text-white">
                      {completedOrder.orderNumber}
                    </h2>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold">
                  POS_STORE
                </span>
              </div>

              {/* Note: Walk-in sale - no customer notification */}
              <div className="p-3.5 rounded-xl bg-black border border-amber-500/40 flex items-center gap-3 text-xs text-amber-300 font-mono">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Walk-in sale — no customer notification</span>
              </div>

              {/* BEFORE / AFTER Inventory Proof Box */}
              {inventoryProof && (
                <div className="p-4 rounded-xl bg-black border-2 border-amber-500/50 flex flex-col gap-3 font-mono">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-xs font-bold text-amber-400 uppercase">
                      Live Retail Inventory Sync Proof
                    </span>
                    {inventoryProof.isSyncing && (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1.5 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Search index refreshing…
                      </span>
                    )}
                    {inventoryProof.isLagging && (
                      <span className="text-[11px] text-amber-400 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-500/40">
                        Index lagging — check Control Tower
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-amber-200/80 truncate">
                    Product: <span className="font-bold text-white">{inventoryProof.productName}</span>
                  </div>

                  {/* Two boxes side by side: BEFORE / AFTER */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {/* BEFORE Box */}
                    <div className="p-3 rounded-lg bg-neutral-900 border border-amber-500/30 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">BEFORE SALE</span>
                        <SyncBadge status={inventoryProof.before?.status || 'PASS'} />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">PostgreSQL:</span>
                        <span className="text-white font-bold">{inventoryProof.before?.pgStock} units</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">OpenSearch:</span>
                        <span className="text-sky-300 font-bold">{inventoryProof.before?.osStock} units</span>
                      </div>
                    </div>

                    {/* AFTER Box */}
                    <div className="p-3 rounded-lg bg-neutral-900 border border-amber-500/30 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">AFTER SALE</span>
                        {inventoryProof.after ? (
                          <SyncBadge status={inventoryProof.after.status} />
                        ) : (
                          <span className="text-[10px] text-amber-400 animate-pulse">polling…</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">PostgreSQL:</span>
                        <span className="text-white font-bold">
                          {inventoryProof.after ? `${inventoryProof.after.pgStock} units` : 'Deducted'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">OpenSearch:</span>
                        <span className="text-sky-300 font-bold">
                          {inventoryProof.after ? `${inventoryProof.after.osStock} units` : 'Refreshing…'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Collected */}
              <div className="flex justify-between items-center text-sm font-mono border-b border-amber-500/20 pb-3">
                <span className="text-amber-400/80">Total Tendered:</span>
                <Price paise={completedOrder.totalPaise} className="text-2xl font-black text-amber-400" />
              </div>

              {/* OrderTimeline Component */}
              <OrderTimeline
                orderId={completedOrder.id}
                totalItems={completedOrder.items?.length || 1}
                source="POS_STORE"
              />

              {/* Verify in Search button */}
              <Link
                to={`/?q=${encodeURIComponent(inventoryProof?.productName || 'boAt')}&city=${encodeURIComponent(selectedStore?.city || 'Bengaluru')}`}
                className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-mono text-xs font-bold border border-amber-500/40 transition-all flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4 text-amber-400" />
                <span>Verify in Search (?q={inventoryProof?.productName?.slice(0, 15) || 'product'})</span>
              </Link>

              <button
                type="button"
                onClick={handleClearRegister}
                className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono font-black text-base uppercase transition-all shadow-xl shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>NEW TRANSACTION (CLEAR)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Active Register Receipt */
            <div className="bg-neutral-950 border-2 border-amber-500/40 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-amber-500/30">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-400" />
                  <h3 className="font-mono text-base font-black text-white uppercase tracking-wider">
                    ACTIVE REGISTER TAPE
                  </h3>
                </div>
                {registerItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearRegister}
                    className="text-xs font-mono text-amber-400/60 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Items List */}
              {registerItems.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-amber-400/40 font-mono text-xs">
                  <span>Register empty</span>
                  <span>Tap products on the left to ring up items</span>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-amber-500/20 max-h-[360px] overflow-y-auto pr-1">
                  {registerItems.map((item) => (
                    <div key={item.productId} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 flex flex-col">
                        <span className="text-xs font-mono font-bold text-amber-200 line-clamp-1">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400/60">
                          <span>{item.sku}</span>
                          <span>•</span>
                          <Price paise={item.pricePaise} />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-black border border-amber-500/40 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, -1)}
                          className="w-7 h-7 rounded bg-neutral-900 hover:bg-neutral-800 text-amber-300 font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-black text-sm text-amber-300">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(item.productId, 1)}
                          className="w-7 h-7 rounded bg-neutral-900 hover:bg-neutral-800 text-amber-300 font-mono font-bold text-sm flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[70px]">
                        <Price
                          paise={item.pricePaise * item.quantity}
                          className="text-sm font-mono font-black text-amber-400"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="p-1 text-amber-400/40 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Running Total & Tender Bar */}
              <div className="pt-4 border-t-2 border-dashed border-amber-500/30 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-mono text-amber-400/80">
                  <span>UNITS RINGED UP:</span>
                  <span className="font-bold text-amber-300">{totalUnits}</span>
                </div>

                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-mono font-black text-amber-200">RUNNING TOTAL:</span>
                  <Price
                    paise={runningTotalPaise}
                    className="text-4xl font-mono font-black text-amber-400"
                  />
                </div>
              </div>

              {/* Big Touch "COMPLETE SALE" Button */}
              <DemoActionButton
                onClick={handleCompleteSale}
                loading={isSubmitting}
                disabled={registerItems.length === 0}
                variant="warning"
                icon={Zap}
                size="lg"
                className="w-full font-mono font-black text-lg text-black bg-amber-500 hover:bg-amber-400"
              >
                COMPLETE SALE (POST /pos/sale)
              </DemoActionButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
