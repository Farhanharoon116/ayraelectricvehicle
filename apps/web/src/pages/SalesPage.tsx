import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  Printer,
  Calendar,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate } from "@aev/shared";

interface SaleListItem {
  id: string;
  invoiceNumber: string;
  saleType: "full_payment" | "installment";
  saleDate: number;
  basePrice: number;
  discount: number;
  totalAmount: number;
  totalPaid: number;
  remainingBalance: number;
  isVoided: boolean;
  voidReason?: string;
  customerName: string;
  customerPhone: string;
  unitBrand: string;
  unitModel: string;
  unitColor: string;
  unitChassis: string;
}

export function SalesPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<{ sales: SaleListItem[] }>({
    queryKey: ["sales"],
    queryFn: () => fetchApi("/api/sales"),
  });

  const allSales = data?.sales || [];
  const filteredSales = allSales.filter((s) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      s.invoiceNumber.toLowerCase().includes(lower) ||
      s.customerName.toLowerCase().includes(lower) ||
      s.unitChassis.toLowerCase().includes(lower) ||
      s.unitModel.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-brand-600" />
            Sales & Invoices
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            View completed sales, payment status, and print official A4 invoices.
          </p>
        </div>

        <Link
          to="/sales/new"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Scooty Sale</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number (INV-2026-...), customer name, chassis..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Sales Grid */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">No sales recorded</h3>
          <p className="text-xs text-slate-400">Record a new scooty sale to generate your first invoice.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSales.map((sale) => (
            <div
              key={sale.id}
              className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow space-y-3 ${
                sale.isVoided ? "border-rose-200 bg-rose-50/20" : "border-slate-200"
              }`}
            >
              {/* Top Bar: Invoice # & Date */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                    {sale.invoiceNumber}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatPKTDate(sale.saleDate)}</span>
                  </div>
                </div>

                <div className="text-right">
                  {sale.isVoided ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                      VOIDED
                    </span>
                  ) : sale.remainingBalance === 0 ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      PAID IN FULL
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      BALANCE DUE
                    </span>
                  )}
                </div>
              </div>

              {/* Customer & Vehicle Snapshot */}
              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Buyer</span>
                  <div className="font-bold text-slate-900">{sale.customerName}</div>
                  <div className="text-[11px] text-slate-500">{sale.customerPhone}</div>
                </div>

                <div className="pt-1">
                  <span className="text-slate-400 text-[10px] uppercase font-semibold">Scooty</span>
                  <div className="font-semibold text-slate-800">
                    {sale.unitBrand} {sale.unitModel} ({sale.unitColor})
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">Chassis: {sale.unitChassis}</div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Total Amount:</span>
                  <span className="font-bold text-slate-900">{formatPKR(sale.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amount Paid:</span>
                  <span className="font-semibold text-emerald-700">{formatPKR(sale.totalPaid)}</span>
                </div>
                {sale.remainingBalance > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold border-t border-slate-200/60 pt-1">
                    <span>Balance:</span>
                    <span>{formatPKR(sale.remainingBalance)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-1 flex gap-2">
                <Link
                  to={`/invoices/${sale.id}`}
                  className="w-full py-2 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View & Print A4 Invoice</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
