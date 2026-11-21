import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  Truck,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate, getTodayPKT } from "@aev/shared";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface SalesReportData {
  items: Array<{
    id: string;
    invoiceNumber: string;
    saleType: string;
    saleDate: number;
    customerName: string;
    customerPhone: string;
    unitBrand: string;
    unitModel: string;
    unitChassis: string;
    basePrice: number;
    discount: number;
    totalAmount: number;
    totalPaid: number;
    remainingBalance: number;
    isVoided: boolean;
    unitCost?: number;
    profit?: number;
    profitMargin?: number;
  }>;
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalCollected: number;
    totalReceivable: number;
    totalProfit?: number;
  };
}

interface StockValuationData {
  items: Array<{
    id: string;
    brandName: string;
    modelName: string;
    variant?: string;
    color: string;
    chassisNumber: string;
    motorNumber: string;
    supplierName: string;
    receivedDate: number;
    purchaseCost: number;
    defaultSellingPrice: number;
    potentialProfit: number;
    margin: number;
  }>;
  summary: {
    totalUnits: number;
    totalValuationAtCost: number;
    totalValuationAtRetail: number;
    totalProjectedProfit: number;
    overallMarginPercent: number;
  };
}

interface ProfitPerSaleData {
  items: Array<{
    invoiceNumber: string;
    saleDate: number;
    saleType: string;
    customerName: string;
    unit: string;
    chassisNumber: string;
    basePrice: number;
    discount: number;
    markupAmount: number;
    totalRevenue: number;
    purchaseCost: number;
    netProfit: number;
    marginPercent: number;
  }>;
  summary: {
    totalSales: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    overallMarginPercent: number;
  };
}

interface CustomerOption {
  id: string;
  name: string;
  cnic: string;
  phone: string;
}

interface SupplierOption {
  id: string;
  name: string;
  phone: string;
}

interface CustomerLedgerData {
  customer: {
    id: string;
    name: string;
    phone: string;
    cnic: string;
    address: string;
  };
  entries: Array<{
    id: string;
    date: number;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  summary: {
    totalBilled: number;
    totalPaid: number;
    currentBalance: number;
  };
}

interface SupplierLedgerData {
  supplier: {
    id: string;
    name: string;
    phone: string;
  };
  entries: Array<{
    id: string;
    date: number;
    type: string;
    reference: string;
    notes: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  summary: {
    totalPurchases: number;
    totalPaid: number;
    currentPayable: number;
  };
}

export function ReportsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [activeTab, setActiveTab] = useState<"sales" | "valuation" | "profit" | "customer" | "supplier">("sales");

  // Date filters for sales and profit reports (default last 30 days)
  const today = getTodayPKT();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split("T")[0]!;
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  // Customer / Supplier selection
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");

  // Queries
  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReportData>({
    queryKey: ["report-sales", fromDate, toDate],
    queryFn: () => fetchApi(`/api/reports/sales?from=${fromDate}&to=${toDate}`),
    enabled: activeTab === "sales",
  });

  const { data: valuationData, isLoading: valuationLoading } = useQuery<StockValuationData>({
    queryKey: ["report-valuation"],
    queryFn: () => fetchApi("/api/reports/stock-valuation"),
    enabled: activeTab === "valuation" && isOwner,
  });

  const { data: profitData, isLoading: profitLoading } = useQuery<ProfitPerSaleData>({
    queryKey: ["report-profit", fromDate, toDate],
    queryFn: () => fetchApi(`/api/reports/profit-per-sale?from=${fromDate}&to=${toDate}`),
    enabled: activeTab === "profit" && isOwner,
  });

  const { data: customersList } = useQuery<{ customers: CustomerOption[] }>({
    queryKey: ["customers-picker-reports"],
    queryFn: () => fetchApi("/api/customers"),
    enabled: activeTab === "customer",
  });

  const { data: suppliersList } = useQuery<{ suppliers: SupplierOption[] }>({
    queryKey: ["suppliers-picker-reports"],
    queryFn: () => fetchApi("/api/suppliers"),
    enabled: activeTab === "supplier",
  });

  const { data: customerLedgerData, isLoading: customerLedgerLoading } = useQuery<CustomerLedgerData>({
    queryKey: ["report-customer-ledger", selectedCustomerId],
    queryFn: () => fetchApi(`/api/reports/customer-ledger/${selectedCustomerId}`),
    enabled: activeTab === "customer" && !!selectedCustomerId,
  });

  const { data: supplierLedgerData, isLoading: supplierLedgerLoading } = useQuery<SupplierLedgerData>({
    queryKey: ["report-supplier-ledger", selectedSupplierId],
    queryFn: () => fetchApi(`/api/reports/supplier-ledger/${selectedSupplierId}`),
    enabled: activeTab === "supplier" && !!selectedSupplierId,
  });

  // CSV download trigger
  const triggerCsvDownload = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            Showroom Reports & Ledgers
          </h1>
          <p className="text-xs text-slate-500">
            Exportable business intelligence, ledger statements, and financial performance
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex overflow-x-auto gap-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold scrollbar-none">
        <button
          onClick={() => setActiveTab("sales")}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "sales" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4 text-brand-600" />
          <span>Sales Report</span>
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab("valuation")}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "valuation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Stock Valuation</span>
          </button>
        )}

        {isOwner && (
          <button
            onClick={() => setActiveTab("profit")}
            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === "profit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <DollarSign className="w-4 h-4 text-purple-600" />
            <span>Profit Per Sale</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("customer")}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "customer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>Customer Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab("supplier")}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "supplier" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Truck className="w-4 h-4 text-amber-600" />
          <span>Supplier Ledger</span>
        </button>
      </div>

      {/* ─── TAB 1: Sales Report ─────────────────────────────────────────── */}
      {activeTab === "sales" && (
        <div className="space-y-4">
          {/* Controls Bar: Date filter + CSV button */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date Range:
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <button
              onClick={() => triggerCsvDownload(`/api/reports/sales?format=csv&from=${fromDate}&to=${toDate}`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Stat Cards */}
          {salesData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Scooties Sold</div>
                <div className="text-xl font-black text-slate-900 mt-1">{salesData.summary.totalSales}</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</div>
                <div className="text-xl font-black text-slate-900 mt-1">{formatPKR(salesData.summary.totalRevenue)}</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Collected</div>
                <div className="text-xl font-black text-emerald-700 mt-1">{formatPKR(salesData.summary.totalCollected)}</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Receivable Balance</div>
                <div className="text-xl font-black text-amber-700 mt-1">{formatPKR(salesData.summary.totalReceivable)}</div>
              </div>
              {isOwner && salesData.summary.totalProfit !== undefined && (
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 col-span-2 sm:col-span-4">
                  <div className="text-[10px] text-emerald-800 uppercase font-bold">Gross Profit (Owner Only)</div>
                  <div className="text-2xl font-black text-emerald-900 mt-1">{formatPKR(salesData.summary.totalProfit)}</div>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {salesLoading ? (
              <div className="p-12 text-center text-slate-400">Loading sales data...</div>
            ) : salesData?.items.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No sales found in this date range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Scooty</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-right">Paid</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      {isOwner && <th className="py-2.5 px-3 text-right">Cost</th>}
                      {isOwner && <th className="py-2.5 px-3 text-right">Profit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salesData?.items.map((item) => (
                      <tr key={item.id} className={`hover:bg-slate-50 ${item.isVoided ? "opacity-50 line-through bg-rose-50/20" : ""}`}>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{item.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatPKTDate(item.saleDate)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unitBrand} {item.unitModel}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{formatPKR(item.totalAmount)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">{formatPKR(item.totalPaid)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-amber-700">{formatPKR(item.remainingBalance)}</td>
                        {isOwner && <td className="py-2.5 px-3 text-right text-slate-500">{formatPKR(item.unitCost || 0)}</td>}
                        {isOwner && (
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {formatPKR(item.profit || 0)} ({item.profitMargin}%)
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: Stock Valuation (Owner Only) ────────────────────────── */}
      {activeTab === "valuation" && isOwner && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Physical Stock Valuation</h3>
              <p className="text-xs text-slate-500">Valuation based on actual purchase costs vs retail prices</p>
            </div>
            <button
              onClick={() => triggerCsvDownload("/api/reports/stock-valuation?format=csv")}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {valuationData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Scooties In Stock</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{valuationData.summary.totalUnits} Units</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Valuation at Cost</div>
                <div className="text-xl font-black text-slate-900 mt-1">{formatPKR(valuationData.summary.totalValuationAtCost)}</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Valuation at Retail</div>
                <div className="text-xl font-black text-blue-700 mt-1">{formatPKR(valuationData.summary.totalValuationAtRetail)}</div>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <div className="text-[10px] text-emerald-800 uppercase font-bold">Projected Margin</div>
                <div className="text-xl font-black text-emerald-900 mt-1">
                  {formatPKR(valuationData.summary.totalProjectedProfit)} ({valuationData.summary.overallMarginPercent}%)
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {valuationLoading ? (
              <div className="p-12 text-center text-slate-400">Loading valuation...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Brand & Model</th>
                      <th className="py-2.5 px-3">Color</th>
                      <th className="py-2.5 px-3 font-mono">Chassis #</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Retail Price</th>
                      <th className="py-2.5 px-3 text-right">Projected Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {valuationData?.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{item.brandName} {item.modelName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.color}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">{item.chassisNumber}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.supplierName}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">{formatPKR(item.purchaseCost)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-700">{formatPKR(item.defaultSellingPrice)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {formatPKR(item.potentialProfit)} ({item.margin}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Profit Per Sale (Owner Only) ────────────────────────── */}
      {activeTab === "profit" && isOwner && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date Range:
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <button
              onClick={() => triggerCsvDownload(`/api/reports/profit-per-sale?format=csv&from=${fromDate}&to=${toDate}`)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {profitData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</div>
                <div className="text-xl font-black text-slate-900 mt-1">{formatPKR(profitData.summary.totalRevenue)}</div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Cost of Goods</div>
                <div className="text-xl font-black text-slate-900 mt-1">{formatPKR(profitData.summary.totalCost)}</div>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <div className="text-[10px] text-emerald-800 uppercase font-bold">Net Profit</div>
                <div className="text-xl font-black text-emerald-900 mt-1">{formatPKR(profitData.summary.totalProfit)}</div>
              </div>
              <div className="bg-purple-50 p-3.5 rounded-xl border border-purple-200">
                <div className="text-[10px] text-purple-800 uppercase font-bold">Average Margin</div>
                <div className="text-xl font-black text-purple-900 mt-1">{profitData.summary.overallMarginPercent}%</div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {profitLoading ? (
              <div className="p-12 text-center text-slate-400">Loading profit breakdown...</div>
            ) : profitData?.items.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No sales recorded in this period.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Scooty</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Net Profit</th>
                      <th className="py-2.5 px-3 text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profitData?.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{item.invoiceNumber}</td>
                        <td className="py-2.5 px-3 text-slate-500">{formatPKTDate(item.saleDate)}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.customerName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unit}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">{formatPKR(item.totalRevenue)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{formatPKR(item.purchaseCost)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatPKR(item.netProfit)}</td>
                        <td className="py-2.5 px-3 text-right font-black text-purple-700">{item.marginPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: Customer Ledger ───────────────────────────────────────── */}
      {activeTab === "customer" && (
        <div className="space-y-4">
          {/* Picker */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">-- Select Customer for Statement --</option>
                {customersList?.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.cnic}) - {c.phone}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomerId && (
              <button
                onClick={() => triggerCsvDownload(`/api/reports/customer-ledger/${selectedCustomerId}?format=csv`)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Statement CSV</span>
              </button>
            )}
          </div>

          {!selectedCustomerId ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Please select a customer above to view their full ledger statement.
            </div>
          ) : customerLedgerLoading ? (
            <div className="p-12 text-center text-slate-400">Loading customer ledger...</div>
          ) : customerLedgerData && (
            <div className="space-y-4">
              {/* Customer Profile + Balances Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 border-r border-slate-100 pr-4">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Account Holder</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">{customerLedgerData.customer.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{customerLedgerData.customer.cnic}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{customerLedgerData.customer.phone}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Debited (Purchases)</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{formatPKR(customerLedgerData.summary.totalBilled)}</div>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <div className="text-[10px] text-emerald-800 uppercase font-semibold">Total Credited (Paid)</div>
                  <div className="text-lg font-black text-emerald-900 mt-1">{formatPKR(customerLedgerData.summary.totalPaid)}</div>
                </div>

                <div className={`p-3 rounded-xl border ${customerLedgerData.summary.currentBalance > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Outstanding Balance</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{formatPKR(customerLedgerData.summary.currentBalance)}</div>
                </div>
              </div>

              {/* Entries Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Transaction Ledger History
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Reference</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Debit (PKR)</th>
                        <th className="py-2 px-3 text-right">Credit (PKR)</th>
                        <th className="py-2 px-3 text-right">Balance (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerLedgerData.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatPKTDate(entry.date)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              entry.type === "SALE" ? "bg-blue-100 text-blue-800" : entry.type === "PAYMENT" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{entry.reference}</td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-xs">{entry.description}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {entry.debit > 0 ? formatPKR(entry.debit) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {entry.credit > 0 ? formatPKR(entry.credit) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {formatPKR(entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: Supplier Ledger ───────────────────────────────────────── */}
      {activeTab === "supplier" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">-- Select Supplier for Statement --</option>
                {suppliersList?.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone})
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplierId && (
              <button
                onClick={() => triggerCsvDownload(`/api/reports/supplier-ledger/${selectedSupplierId}?format=csv`)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Supplier CSV</span>
              </button>
            )}
          </div>

          {!selectedSupplierId ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
              Please select a supplier above to inspect transactions and balance payable.
            </div>
          ) : supplierLedgerLoading ? (
            <div className="p-12 text-center text-slate-400">Loading supplier ledger...</div>
          ) : supplierLedgerData && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1 border-r border-slate-100 pr-4">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Supplier</div>
                  <div className="text-base font-black text-slate-900 mt-0.5">{supplierLedgerData.supplier.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{supplierLedgerData.supplier.phone}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Scooty Purchases</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{formatPKR(supplierLedgerData.summary.totalPurchases)}</div>
                </div>

                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <div className="text-[10px] text-emerald-800 uppercase font-semibold">Total Paid to Supplier</div>
                  <div className="text-lg font-black text-emerald-900 mt-1">{formatPKR(supplierLedgerData.summary.totalPaid)}</div>
                </div>

                <div className={`p-3 rounded-xl border ${supplierLedgerData.summary.currentPayable > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Current Payable Balance</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{formatPKR(supplierLedgerData.summary.currentPayable)}</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Supplier Transaction Log
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Reference</th>
                        <th className="py-2 px-3">Notes</th>
                        <th className="py-2 px-3 text-right">Paid/Debit (PKR)</th>
                        <th className="py-2 px-3 text-right">Purchased/Credit (PKR)</th>
                        <th className="py-2 px-3 text-right">Payable Balance (PKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierLedgerData.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatPKTDate(entry.date)}</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              entry.type === "purchase" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {entry.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{entry.reference}</td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs">{entry.notes || "—"}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {entry.debit > 0 ? formatPKR(entry.debit) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {entry.credit > 0 ? formatPKR(entry.credit) : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            {formatPKR(entry.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
