import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { apiGet, apiPost } from '../api/client.js';
import Price from '../components/Price.jsx';
import StockBadge from '../components/StockBadge.jsx';
import SyncBadge from '../components/SyncBadge.jsx';
import JsonViewer from '../components/JsonViewer.jsx';
import ProductImage from '../components/ProductImage.jsx';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  ChevronDown,
  ChevronUp,
  Store,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const CATEGORIES = ['All', 'Audio', 'Electronics', 'Appliances', 'Footwear', 'Apparel'];

export default function PosSimulator() {
  const { selectedStore, setSelectedStore, stores, showToast } = useApp();

  // Catalog state
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Register items state: [ { productId, name, sku, pricePaise, quantity, stockQty } ]
  const [registerItems, setRegisterItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockError, setStockError] = useState(null);

  // Completed Sale & Printable Receipt state
  const [completedOrder, setCompletedOrder] = useState(null);

  // Subtle inventory proof state
  const [inventoryProof, setInventoryProof] = useState(null);
  const [proofOpen, setProofOpen] = useState(false);
  const pollTimerRef = useRef(null);

  // Load product catalog for the selected store
  const loadCatalog = async () => {
    try {
      setLoadingProducts(true);
      const res = await apiGet('/search', { params: { limit: 50 } });
      setProducts(res?.hits || []);
    } catch (err) {
      showToast({
        type: 'error',
        code: 'CATALOG_ERROR',
        message: 'Failed to fetch catalog items for POS register.',
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [selectedStore?.id]);

  // Listen for top bar "New Bill" custom event
  useEffect(() => {
    function handleNewBillEvent() {
      handleNewBill();
    }
    window.addEventListener('pos:new-bill', handleNewBillEvent);
    return () => {
      window.removeEventListener('pos:new-bill', handleNewBillEvent);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q);
      const matchCat =
        selectedCategory === 'All' ||
        p.category?.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [products, searchTerm, selectedCategory]);

  // Get current store's stock for a given product
  function getProductStoreStock(product) {
    if (!product.availability) return 0;
    const itemAvail = product.availability.find((a) => a.storeId === selectedStore?.id);
    return itemAvail?.stockQty ?? 0;
  }

  // Add item to bill
  function handleAddItem(product) {
    if (completedOrder) {
      setCompletedOrder(null);
      setInventoryProof(null);
    }
    setStockError(null);

    const storeStock = getProductStoreStock(product);

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
          stockQty: storeStock,
        },
      ];
    });
  }

  // Stepper quantity update
  function handleUpdateQuantity(productId, delta) {
    setRegisterItems((prev) =>
      prev
        .map((i) => {
          if (i.productId === productId) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean)
    );
  }

  // Remove single line item
  function handleRemoveItem(productId) {
    setRegisterItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  // Reset register for a new bill
  function handleNewBill() {
    setRegisterItems([]);
    setCompletedOrder(null);
    setInventoryProof(null);
    setStockError(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    showToast({
      type: 'info',
      message: 'Fresh bill initiated.',
    });
  }

  // Calculate bill totals
  const subtotalPaise = useMemo(() => {
    return registerItems.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0);
  }, [registerItems]);

  const totalPaise = subtotalPaise; // Contract uses subtotal directly
  const totalItemCount = useMemo(() => {
    return registerItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [registerItems]);

  // Complete Sale & Generate Bill
  async function handleGenerateBill() {
    if (!selectedStore?.id || registerItems.length === 0) return;

    setIsSubmitting(true);
    setStockError(null);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    // Capture BEFORE snapshot for first sold item
    const primaryItem = registerItems[0];
    let beforePgStock = primaryItem.stockQty;
    let beforeOsStock = primaryItem.stockQty;
    let beforeStatus = 'PASS';

    try {
      const [prodRes, xrayRes] = await Promise.all([
        apiGet(`/products/${primaryItem.productId}`).catch(() => null),
        apiGet('/xray/metrics').catch(() => null),
      ]);

      const storeAvail = prodRes?.availability?.find((a) => a.storeId === selectedStore.id);
      if (storeAvail) beforePgStock = storeAvail.stockQty;

      const reconRow = xrayRes?.reconciliation?.rows?.find((r) => r.productId === primaryItem.productId);
      if (reconRow) {
        beforeOsStock = reconRow.osTotalStock;
        beforeStatus = reconRow.status;
      }
    } catch (e) {
      console.warn('Could not capture before snapshot', e.message);
    }

    const payload = {
      storeId: selectedStore.id,
      items: registerItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    try {
      const res = await apiPost('/pos/sale', payload);
      const order = res.order;

      setCompletedOrder(order);

      // Set subtle inventory proof state
      setInventoryProof({
        productName: primaryItem.name,
        productId: primaryItem.productId,
        before: {
          pgStock: beforePgStock,
          osStock: beforeOsStock,
          status: beforeStatus,
        },
        after: {
          pgStock: Math.max(0, beforePgStock - primaryItem.quantity),
          osStock: beforeOsStock,
          status: 'SYNCING',
        },
        isSyncing: true,
        isLagging: false,
      });

      // Poll reconciliation for max 6s
      let elapsed = 0;
      const MAX_POLL = 6;
      pollTimerRef.current = setInterval(async () => {
        elapsed += 1;
        try {
          const [prodCheck, xrayCheck] = await Promise.all([
            apiGet(`/products/${primaryItem.productId}`).catch(() => null),
            apiGet('/xray/metrics').catch(() => null),
          ]);

          const storeAvail = prodCheck?.availability?.find((a) => a.storeId === selectedStore.id);
          const currentPg = storeAvail ? storeAvail.stockQty : Math.max(0, beforePgStock - primaryItem.quantity);

          const reconRow = xrayCheck?.reconciliation?.rows?.find((r) => r.productId === primaryItem.productId);
          const currentOs = reconRow ? reconRow.osTotalStock : beforeOsStock;
          const currentStatus = reconRow ? reconRow.status : 'SYNCING';

          setInventoryProof((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              after: {
                pgStock: currentPg,
                osStock: currentOs,
                status: currentStatus,
              },
            };
          });

          if (currentStatus === 'PASS' || elapsed >= MAX_POLL) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setInventoryProof((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                isSyncing: false,
                isLagging: currentStatus !== 'PASS',
              };
            });
            loadCatalog();
          }
        } catch (pollErr) {
          if (elapsed >= MAX_POLL) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      }, 1000);

      showToast({
        type: 'success',
        message: `Bill Generated: #${order.orderNumber} (Store Sale)`,
      });
    } catch (err) {
      if (err.status === 409 || err.code === 'INSUFFICIENT_STOCK') {
        const detailMsg = `Insufficient stock: only ${err.details?.available ?? 0} available, you requested ${err.details?.requested ?? 1}. Zero oversell occurred.`;
        setStockError(detailMsg);
        showToast({
          type: 'error',
          code: 'INSUFFICIENT_STOCK',
          message: detailMsg,
          details: err.details,
        });
      } else {
        const msg = err.message || 'Counter sale failed';
        setStockError(msg);
        showToast({
          type: 'error',
          code: err.code || 'SALE_FAILED',
          message: msg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  const currentDateDisplay = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Stock conflict inline error */}
      {stockError && (
        <div className="bg-red-50 border border-red-200 rounded-[6px] p-3 flex items-start gap-2.5 text-xs text-red-800 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-red-950">Sale Could Not Be Completed</span>
            <span>{stockError}</span>
          </div>
        </div>
      )}

      {/* Main Two-Zone Billing Application Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start no-print">
        {/* LEFT ZONE (~40% / 5 cols): "Add Items" Panel */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-4 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1F2937]">Add Items to Bill</h2>
              <span className="text-xs text-[#6B7280]">
                {loadingProducts ? 'Loading...' : `${filteredProducts.length} items available`}
              </span>
            </div>

            {/* Item Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search item by name / SKU / brand..."
                className="w-full h-[38px] pl-9 pr-3 text-xs md:text-sm bg-[#F8FAFC] focus:bg-white text-[#1F2937] placeholder-[#6B7280] rounded-[6px] border border-[#E2E8F0] focus:border-[#1D4ED8] focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-[4px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#1D4ED8] text-white font-semibold'
                      : 'bg-slate-100 text-[#1F2937] hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable Item Catalog List */}
            <div className="divide-y divide-[#E2E8F0] max-h-[500px] overflow-y-auto border border-[#E2E8F0] rounded-[6px]">
              {loadingProducts ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  Loading catalog inventory...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  No matching items found.
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const stock = getProductStoreStock(p);
                  const inStock = stock > 0;

                  return (
                    <div
                      key={p.productId}
                      onClick={() => inStock && handleAddItem(p)}
                      className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                        inStock ? 'hover:bg-blue-50/50' : 'opacity-60 bg-slate-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <ProductImage
                          src={p.imageUrl}
                          alt={p.name}
                          category={p.category}
                          containerClassName="w-10 h-10 rounded-[6px] border border-slate-100 p-0.5 shrink-0 bg-white"
                          loading="lazy"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#6B7280] font-semibold">
                              {p.sku}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-[#6B7280]">
                              {p.category}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium text-[#1F2937] truncate mt-0.5">
                            {p.name}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            {inStock ? (
                              <span className="text-[11px] font-medium text-[#16A34A]">
                                In Stock: <strong>{stock}</strong>
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-[#DC2626]">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <Price paise={p.pricePaise} className="text-sm font-bold text-[#1F2937]" />
                        <button
                          type="button"
                          disabled={!inStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddItem(p);
                          }}
                          className="h-[30px] px-2.5 rounded-[4px] bg-[#1D4ED8] hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT ZONE (~60% / 7 cols): "Current Bill" Panel */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-4 shadow-2xs flex flex-col gap-3">
            {/* Bill Header Info (Vyapar style) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">
                  Tax Invoice / Cash Memo
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-base font-bold text-[#111827]">
                    Bill No: {completedOrder ? `#${completedOrder.orderNumber}` : 'DRAFT'}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-green-50 text-[#16A34A] border border-green-200 uppercase">
                    {completedOrder ? 'COMPLETED' : 'IN PROGRESS'}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-[#6B7280]">
                <div>Date: <strong className="text-[#1F2937]">{currentDateDisplay}</strong></div>
                <div>Customer: <strong className="text-[#1F2937]">Walk-in Customer (Cash/UPI)</strong></div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-[#E2E8F0] rounded-[6px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 w-8">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 text-center w-28">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {registerItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-xs text-[#6B7280]">
                        No items added to current bill. Select items from the catalog on the left.
                      </td>
                    </tr>
                  ) : (
                    registerItems.map((item, idx) => {
                      const lineTotal = item.pricePaise * item.quantity;
                      return (
                        <tr key={item.productId} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 text-[#6B7280] font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <ProductImage
                                src={item.imageUrl}
                                alt={item.name}
                                category={item.category}
                                containerClassName="w-7 h-7 rounded border border-slate-100 shrink-0 hidden sm:flex"
                                loading="lazy"
                              />
                              <div>
                                <span className="font-medium text-[#1F2937] block leading-snug">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-mono text-[#6B7280]">{item.sku}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-center border border-[#E2E8F0] rounded-[4px] bg-white overflow-hidden max-w-[80px] mx-auto">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, -1)}
                                className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 py-0.5 font-mono text-xs font-semibold text-[#1F2937] min-w-[20px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, 1)}
                                className="px-1.5 py-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            <Price paise={item.pricePaise} />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1F2937]">
                            <Price paise={lineTotal} />
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.productId)}
                              className="text-[#DC2626] hover:bg-red-50 p-1 rounded transition-colors cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals & Billing Action Block */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 flex flex-col gap-2">
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>Total Items / Quantity:</span>
                <span className="font-mono font-semibold text-[#1F2937]">{totalItemCount} units</span>
              </div>
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>Subtotal (Inclusive of all retail taxes):</span>
                <Price paise={subtotalPaise} className="font-mono text-[#1F2937]" />
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-[#E2E8F0]">
                <span className="font-bold text-sm text-[#111827]">BILL TOTAL:</span>
                <Price paise={totalPaise} className="text-lg font-bold font-mono text-[#111827]" />
              </div>

              {/* Action Buttons: Generate Bill / Print Receipt */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleGenerateBill}
                  disabled={isSubmitting || registerItems.length === 0}
                  className="h-[40px] px-4 rounded-[6px] bg-[#16A34A] hover:bg-[#15803D] text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording Sale...' : 'Generate Bill'}</span>
                </button>

                {completedOrder ? (
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className="h-[40px] px-4 rounded-[6px] bg-[#1D4ED8] hover:bg-blue-700 text-white font-semibold text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Bill (Receipt)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNewBill}
                    className="h-[40px] px-4 rounded-[6px] bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#1F2937] font-semibold text-xs md:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Clear Register</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtle Post-Sale Status Line */}
            {completedOrder && (
              <div className="p-2.5 rounded-[6px] bg-green-50 border border-green-200 text-xs text-[#16A34A] flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                  <span>
                    Sale completed (#{completedOrder.orderNumber}) · Stock updated in PostgreSQL
                  </span>
                </span>
                <span className="text-[11px] font-mono text-green-800">
                  {inventoryProof?.isSyncing ? (
                    <span className="text-amber-700 animate-pulse">Syncing index...</span>
                  ) : (
                    <span>Index synced ✓</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Collapsible Inventory Sync Proof Details (Default Collapsed) */}
          {inventoryProof && (
            <div className="border border-[#E2E8F0] rounded-[6px] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setProofOpen(!proofOpen)}
                className="w-full px-4 py-2 flex items-center justify-between text-xs font-semibold text-[#6B7280] hover:text-[#1F2937] bg-slate-50/80 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Inventory Sync Details (Demo Proof)</span>
                  <span className="font-mono text-[10px] text-[#6B7280] bg-slate-200 px-1.5 py-0.2 rounded">
                    POST /pos/sale Delta
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  {proofOpen ? 'Hide' : 'Show'}
                  {proofOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {proofOpen && (
                <div className="p-4 border-t border-[#E2E8F0] flex flex-col gap-3 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="p-2 bg-slate-50 rounded border border-[#E2E8F0]">
                      <span className="text-slate-400 block text-[10px]">BEFORE PG STOCK</span>
                      <span className="font-bold text-[#1F2937]">{inventoryProof.before.pgStock}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-[#E2E8F0]">
                      <span className="text-slate-400 block text-[10px]">AFTER PG STOCK</span>
                      <span className="font-bold text-[#16A34A]">{inventoryProof.after.pgStock}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-[#E2E8F0]">
                      <span className="text-slate-400 block text-[10px]">BEFORE OS STOCK</span>
                      <span className="font-bold text-[#1F2937]">{inventoryProof.before.osStock}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-[#E2E8F0]">
                      <span className="text-slate-400 block text-[10px]">SYNC STATUS</span>
                      <div>
                        <SyncBadge status={inventoryProof.after.status} />
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    Single-statement conditional decrement committed directly in PostgreSQL. Asynchronous Kafka consumer propagates stock update to OpenSearch.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRINTABLE THERMAL RECEIPT (Rendered on Screen when completed + Dedicated for window.print()) */}
      {completedOrder && (
        <div className="flex flex-col items-center justify-center mt-2">
          <div
            id="printable-pos-receipt"
            className="w-full max-w-[340px] bg-white border-2 border-slate-300 rounded-[6px] p-5 shadow-lg text-black font-mono text-xs leading-relaxed"
          >
            {/* Store Receipt Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-400">
              <h2 className="font-black text-sm tracking-wider uppercase text-black">
                SMARTMART RETAIL
              </h2>
              <div className="text-[11px] text-slate-700 leading-tight mt-0.5">
                {selectedStore?.storeName || 'Indiranagar Store'}
              </div>
              <div className="text-[10px] text-slate-600">
                {selectedStore?.address || '100 Feet Rd, Indiranagar'}
              </div>
              <div className="text-[10px] text-slate-600">
                {selectedStore?.city || 'Bengaluru'}, Karnataka
              </div>
              <div className="text-[10px] font-bold mt-1 text-black">
                *** RETAIL CASH INVOICE ***
              </div>
            </div>

            {/* Bill Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Bill No:</span>
                <span className="font-bold">#{completedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{currentDateDisplay}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>TRM-{selectedStore?.storeCode || 'BLR01'}-01</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>Walk-in Counter</span>
              </div>
            </div>

            {/* Itemized Lines */}
            <div className="py-2.5 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-bold text-[10px] text-slate-800 pb-1">
                <span>ITEM</span>
                <span>QTY × RATE</span>
                <span>AMOUNT</span>
              </div>
              <div className="divide-y divide-dotted divide-slate-200">
                {(completedOrder.items || registerItems).map((i, idx) => {
                  const qty = i.quantity;
                  const rate = i.unitPricePaise || i.pricePaise;
                  const amount = i.subtotalPaise || (rate * qty);
                  return (
                    <div key={idx} className="py-1">
                      <div className="font-medium truncate text-black">{i.name}</div>
                      <div className="flex justify-between text-[10px] text-slate-700">
                        <span>{qty} × ₹{(rate / 100).toFixed(2)}</span>
                        <span className="font-bold text-black">₹{(amount / 100).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Block */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between text-xs">
                <span>Subtotal:</span>
                <span>₹{(completedOrder.totalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>GST (Included):</span>
                <span>18% Breakdown</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-black pt-1 border-t border-slate-300">
                <span>TOTAL PAID:</span>
                <span>₹{(completedOrder.totalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-slate-600 text-right">
                Payment Mode: CASH / POS STORE
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-slate-600 space-y-0.5">
              <div className="font-bold text-black">THANK YOU! VISIT AGAIN.</div>
              <div>100% Genuine Merchandise Guaranteed</div>
              <div className="text-[9px] text-slate-500">GSTIN: 29AABCU9603R1ZM</div>
            </div>
          </div>

          {/* Quick Print and New Bill action row below receipt */}
          <div className="flex items-center gap-3 mt-3 no-print">
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="h-[36px] px-4 rounded-[6px] bg-[#1D4ED8] hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Thermal Receipt</span>
            </button>
            <button
              type="button"
              onClick={handleNewBill}
              className="h-[36px] px-4 rounded-[6px] bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#1F2937] font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Start Next Bill</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
