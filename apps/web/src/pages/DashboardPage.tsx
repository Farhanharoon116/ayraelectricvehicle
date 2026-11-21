import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bike,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  Calendar,
  Phone,
  MessageCircle,
  PackagePlus,
  ArrowRight,
  TrendingUp,
  Clock,
  ChevronRight,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate } from "@aev/shared";

interface DashboardData {
  stock: {
    total: number;
    byModel: Array<{ brand: string; model: string; count: number }>;
  };
  salesMonth: {
    count: number;
    totalAmount: number;
  };
  collectedToday: {
    count: number;
    totalAmount: number;
  };
  overdue: {
    count: number;
    totalAmount: number;
    items: Array<{
      scheduleId: string;
      installmentNumber: number;
      dueDate: number;
      amount: number;
      fineAmount: number;
      fineWaived: boolean;
      status: string;
      saleId: string;
      invoiceNumber: string;
      customerName: string;
      customerPhone: string;
      unitBrand: string;
      unitModel: string;
    }>;
  };
  dueToday: {
    count: number;
    items: Array<{
      scheduleId: string;
      installmentNumber: number;
      dueDate: number;
      amount: number;
      status: string;
      saleId: string;
      invoiceNumber: string;
      customerName: string;
      customerPhone: string;
      unitBrand: string;
      unitModel: string;
    }>;
  };
  dueThisWeek: {
    count: number;
    items: Array<{
      scheduleId: string;
      installmentNumber: number;
      dueDate: number;
      amount: number;
      status: string;
      saleId: string;
      invoiceNumber: string;
      customerName: string;
      customerPhone: string;
      unitBrand: string;
      unitModel: string;
    }>;
  };
}

export function DashboardPage() {
  const [scheduleTab, setScheduleTab] = useState<"overdue" | "today" | "week">("overdue");

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetchApi("/api/dashboard"),
    refetchInterval: 30000, // refresh every 30s
  });

  const formatWhatsAppLink = (phone: string, customerName: string, amount: number, invoiceNum: string) => {
    // Clean to 923XXXXXXXXX
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      clean = "92" + clean.slice(1);
    } else if (!clean.startsWith("92")) {
      clean = "92" + clean;
    }
    const message = encodeURIComponent(
      `Assalam-o-Alaikum ${customerName}, this is a gentle reminder from AEV Motors regarding your scooty installment of ${formatPKR(
        amount
      )} for invoice ${invoiceNum}. Kindly arrange payment at your earliest convenience.`
    );
    return `https://wa.me/${clean}?text=${message}`;
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const stock = data?.stock || { total: 0, byModel: [] };
  const salesMonth = data?.salesMonth || { count: 0, totalAmount: 0 };
  const collectedToday = data?.collectedToday || { count: 0, totalAmount: 0 };
  const overdue = data?.overdue || { count: 0, totalAmount: 0, items: [] };
  const dueToday = data?.dueToday || { count: 0, items: [] };
  const dueThisWeek = data?.dueThisWeek || { count: 0, items: [] };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Showroom Dashboard</h1>
          <p className="text-xs text-slate-500">Live operational overview of AEV Motors Pakistan</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/stock-in"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <PackagePlus className="w-4 h-4 text-slate-500" />
            <span>Stock In</span>
          </Link>
          <Link
            to="/sales/new"
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>New Sale</span>
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Units In Stock */}
        <Link
          to="/inventory"
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Stock</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Bike className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{stock.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ready for sale scooties</div>
          </div>
        </Link>

        {/* Sales This Month */}
        <Link
          to="/sales"
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sales This Month</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{formatPKR(salesMonth.totalAmount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{salesMonth.count} scooties sold</div>
          </div>
        </Link>

        {/* Cash Collected Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Collected Today</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{formatPKR(collectedToday.totalAmount)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{collectedToday.count} payments received</div>
          </div>
        </div>

        {/* Overdue Installments */}
        <div
          onClick={() => setScheduleTab("overdue")}
          className={`cursor-pointer p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            overdue.count > 0
              ? "bg-rose-50/40 border-rose-200 hover:border-rose-400"
              : "bg-white border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Overdue Fines</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-700">{formatPKR(overdue.totalAmount)}</div>
            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">{overdue.count} installments overdue</div>
          </div>
        </div>
      </div>

      {/* Main Operational Section: Installment Follow-ups & Stock breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Installment Schedules Follow-up */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Section Header with Tabs */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setScheduleTab("overdue")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  scheduleTab === "overdue"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Overdue</span>
                {overdue.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-rose-700 font-black">
                    {overdue.count}
                  </span>
                )}
              </button>

              <button
                onClick={() => setScheduleTab("today")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  scheduleTab === "today"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Due Today</span>
                {dueToday.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-brand-700 font-black">
                    {dueToday.count}
                  </span>
                )}
              </button>

              <button
                onClick={() => setScheduleTab("week")}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  scheduleTab === "week"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Due in 7 Days</span>
                {dueThisWeek.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-brand-700 font-black">
                    {dueThisWeek.count}
                  </span>
                )}
              </button>
            </div>

            <Link to="/sales" className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1">
              <span>View All Sales</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Tab Content List */}
          <div className="flex-1 divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
            {scheduleTab === "overdue" && (
              overdue.items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    ✓
                  </div>
                  <div className="text-sm font-bold text-slate-700">All installments are up to date!</div>
                  <div className="text-xs">No overdue payments pending at this time.</div>
                </div>
              ) : (
                overdue.items.map((item) => (
                  <div key={item.scheduleId} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.customerName}</span>
                        <span className="text-[10px] font-mono bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                          OVERDUE
                        </span>
                        <span className="text-[10px] text-slate-400">Inst #{item.installmentNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>Inv: <strong className="font-mono text-slate-700">{item.invoiceNumber}</strong></span>
                        <span>•</span>
                        <span>{item.unitBrand} {item.unitModel}</span>
                        <span>•</span>
                        <span className="text-rose-600 font-semibold">Due: {formatPKTDate(item.dueDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-black text-slate-900">{formatPKR(item.amount)}</div>
                        {item.fineAmount > 0 && !item.fineWaived && (
                          <div className="text-[10px] text-rose-600 font-bold">+{formatPKR(item.fineAmount)} fine</div>
                        )}
                      </div>

                      {/* Action buttons: Call, WhatsApp, View */}
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${item.customerPhone}`}
                          title={`Call ${item.customerName}`}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={formatWhatsAppLink(item.customerPhone, item.customerName, item.amount, item.invoiceNumber)}
                          target="_blank"
                          rel="noreferrer"
                          title="WhatsApp Reminder"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          to={`/sales/${item.saleId}`}
                          title="View Sale Details"
                          className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Pay
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}

            {scheduleTab === "today" && (
              dueToday.items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-slate-700">No installments due today</div>
                  <div className="text-xs">Upcoming installments will appear here when due.</div>
                </div>
              ) : (
                dueToday.items.map((item) => (
                  <div key={item.scheduleId} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.customerName}</span>
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                          DUE TODAY
                        </span>
                        <span className="text-[10px] text-slate-400">Inst #{item.installmentNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>Inv: <strong className="font-mono text-slate-700">{item.invoiceNumber}</strong></span>
                        <span>•</span>
                        <span>{item.unitBrand} {item.unitModel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs font-black text-slate-900">{formatPKR(item.amount)}</div>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${item.customerPhone}`}
                          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={formatWhatsAppLink(item.customerPhone, item.customerName, item.amount, item.invoiceNumber)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                        <Link
                          to={`/sales/${item.saleId}`}
                          className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold transition-colors"
                        >
                          Pay
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}

            {scheduleTab === "week" && (
              dueThisWeek.items.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-semibold text-slate-700">No installments due in the next 7 days</div>
                  <div className="text-xs">All clear for this week.</div>
                </div>
              ) : (
                dueThisWeek.items.map((item) => (
                  <div key={item.scheduleId} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.customerName}</span>
                        <span className="text-[10px] text-slate-400">Inst #{item.installmentNumber}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                        <span>Inv: <strong className="font-mono text-slate-700">{item.invoiceNumber}</strong></span>
                        <span>•</span>
                        <span>Due: {formatPKTDate(item.dueDate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs font-black text-slate-900">{formatPKR(item.amount)}</div>
                      <Link
                        to={`/sales/${item.saleId}`}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Right 1 Col: In-Stock Scooty Inventory by Model */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Inventory by Model</h2>
              <p className="text-[11px] text-slate-400">Physical units available in showroom</p>
            </div>
            <Link to="/inventory" className="text-xs text-brand-600 hover:text-brand-700 font-bold">
              All Units
            </Link>
          </div>

          <div className="flex-1 space-y-2.5 max-h-[400px] overflow-y-auto">
            {stock.byModel.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No scooties currently in stock.</div>
            ) : (
              stock.byModel.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900">{item.brand} {item.model}</div>
                    <div className="text-[10px] text-slate-400">{item.brand} E-Scooter</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-brand-700">{item.count}</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">units</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Total Stock</span>
            <span className="font-black text-slate-900 text-sm">{stock.total} Units</span>
          </div>

          <Link
            to="/stock-in"
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <PackagePlus className="w-4 h-4 text-slate-600" />
            <span>Receive New Shipment</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
          </Link>
        </div>
      </div>
    </div>
  );
}
