import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Download,
  AlertCircle,
  Building2,
  Wallet,
  Users,
  Truck,
  Scale,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchApi } from "../lib/api";
import { formatPKR, getTodayPKT } from "@aev/shared";

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

interface TrendItem {
  period: string;
  inflow: number;
  outflow: number;
  net: number;
  runningCash: number;
}

interface CategoryItem {
  category: string;
  amount: number;
  percentage: number;
}

interface AccountBreakdownItem {
  id: string;
  name: string;
  type: string;
  bankName?: string;
  isActive: boolean;
  periodInflow: number;
  periodOutflow: number;
  periodNet: number;
  currentBalance: number;
}

interface CashFlowResponse {
  summary: {
    from: string;
    to: string;
    period: "day" | "week" | "month";
    openingCash: number;
    totalInflow: number;
    totalOutflow: number;
    netCashFlow: number;
    closingCash: number;
  };
  trend: TrendItem[];
  byCategory: {
    inflows: CategoryItem[];
    outflows: CategoryItem[];
  };
  byAccount: AccountBreakdownItem[];
  outstanding: {
    receivables: {
      totalInstallmentDue: number;
      overdueAmount: number;
      overdueCount: number;
      activeAccountsCount: number;
    };
    payables: {
      totalSupplierPayables: number;
      suppliersOwedCount: number;
      suppliers: Array<{ id: string; name: string; balancePayable: number }>;
    };
    netOutstanding: number;
  };
}

export function CashFlowPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const today = getTodayPKT();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split("T")[0]!;

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  const { data: accountsData } = useQuery<{ accounts: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: () => fetchApi("/api/accounts"),
    enabled: isOwner,
  });

  const { data: cashFlowData, isLoading, error } = useQuery<CashFlowResponse>({
    queryKey: ["cash-flow", fromDate, toDate, period, selectedAccountId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (period) params.set("period", period);
      if (selectedAccountId !== "all") params.set("accountId", selectedAccountId);
      return fetchApi(`/api/cash-flow?${params.toString()}`);
    },
    enabled: isOwner,
  });

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (period) params.set("period", period);
    if (selectedAccountId !== "all") params.set("accountId", selectedAccountId);
    params.set("format", "csv");
    window.open(`/api/cash-flow?${params.toString()}`, "_blank");
  };

  if (!isOwner) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
          <div>
            <div className="font-bold text-base">Restricted Access</div>
            <div className="text-xs text-rose-600 mt-0.5">
              Cash flow and balance analysis is restricted to showroom owners.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const summary = cashFlowData?.summary;
  const trend = cashFlowData?.trend || [];
  const byCategory = cashFlowData?.byCategory;
  const byAccount = cashFlowData?.byAccount || [];
  const outstanding = cashFlowData?.outstanding;
  const accounts = accountsData?.accounts || [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-600" />
            Cash Flow & Liquidity
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Real-time analysis of money inflows, outflows, account balances, and outstanding working capital.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={isLoading || !cashFlowData}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Account:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="all">All Accounts (Consolidated)</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Granularity switch */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                period === p
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>Failed to load cash flow data: {(error as Error).message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Opening Cash */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1 flex items-center justify-between">
            <span>Opening Cash</span>
            <Wallet className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-700">
            {formatPKR(summary?.openingCash ?? 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">As of {summary?.from || fromDate}</div>
        </div>

        {/* Inflow */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-emerald-700 tracking-wider mb-1 flex items-center justify-between">
            <span>Total Inflow</span>
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600">
            +{formatPKR(summary?.totalInflow ?? 0)}
          </div>
          <div className="text-[10px] text-emerald-600/70 mt-0.5">Collections & Inflows</div>
        </div>

        {/* Outflow */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-rose-700 tracking-wider mb-1 flex items-center justify-between">
            <span>Total Outflow</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-600">
            -{formatPKR(summary?.totalOutflow ?? 0)}
          </div>
          <div className="text-[10px] text-rose-600/70 mt-0.5">Expenses & Suppliers</div>
        </div>

        {/* Net Cash Flow */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1 flex items-center justify-between">
            <span>Net Cash Flow</span>
            <Scale className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div
            className={`text-lg sm:text-xl font-black ${
              (summary?.netCashFlow ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {(summary?.netCashFlow ?? 0) >= 0 ? "+" : ""}
            {formatPKR(summary?.netCashFlow ?? 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Period Net Position</div>
        </div>

        {/* Closing Cash */}
        <div className="p-4 bg-brand-50/50 border border-brand-200 rounded-2xl shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold uppercase text-brand-800 tracking-wider mb-1 flex items-center justify-between">
            <span>Closing Cash</span>
            <Building2 className="w-3.5 h-3.5 text-brand-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-brand-900">
            {formatPKR(summary?.closingCash ?? 0)}
          </div>
          <div className="text-[10px] text-brand-700 mt-0.5">As of {summary?.to || toDate}</div>
        </div>
      </div>

      {/* Outstanding Working Capital Card (Receivables vs Payables) */}
      {outstanding && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-brand-600" />
                Working Capital: Outstanding Receivables vs Payables
              </h2>
              <p className="text-xs text-slate-500">
                Future liquidity perspective: money still to collect from installment customers vs money owed to scooty suppliers.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-500 uppercase font-semibold">Net Outstanding Capital</span>
              <div
                className={`text-base font-black ${
                  outstanding.netOutstanding >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {outstanding.netOutstanding >= 0 ? "+" : ""}
                {formatPKR(outstanding.netOutstanding)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Installments to Collect */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-700" />
                  Installment Receivables
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {outstanding.receivables.activeAccountsCount} active accounts
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-800">
                {formatPKR(outstanding.receivables.totalInstallmentDue)}
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-700/80 pt-1 border-t border-emerald-200/50">
                <span>Overdue Schedules:</span>
                <span className="font-bold text-rose-700">
                  {formatPKR(outstanding.receivables.overdueAmount)} ({outstanding.receivables.overdueCount} installments)
                </span>
              </div>
            </div>

            {/* Supplier Payables */}
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-amber-700" />
                  Supplier Payables Owed
                </span>
                <span className="text-[11px] font-semibold text-amber-700">
                  {outstanding.payables.suppliersOwedCount} suppliers owed
                </span>
              </div>
              <div className="text-2xl font-black text-amber-900">
                {formatPKR(outstanding.payables.totalSupplierPayables)}
              </div>
              <div className="text-xs text-amber-800/80 pt-1 border-t border-amber-200/50 truncate">
                {outstanding.payables.suppliers.length > 0
                  ? outstanding.payables.suppliers.map((s) => `${s.name}: ${formatPKR(s.balancePayable)}`).join(" | ")
                  : "All supplier accounts fully settled"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdowns: Inflows vs Outflows */}
      {byCategory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inflows by Category */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Inflows by Category
              </h3>
              <span className="text-xs font-black text-emerald-600">
                +{formatPKR(summary?.totalInflow ?? 0)}
              </span>
            </div>

            {byCategory.inflows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No inflows recorded in period</div>
            ) : (
              <div className="space-y-2.5">
                {byCategory.inflows.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 capitalize">{item.category}</span>
                      <span className="font-bold text-slate-900">
                        {formatPKR(item.amount)}{" "}
                        <span className="text-slate-400 text-[10px] font-normal">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outflows by Category */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-600" />
                Outflows by Category
              </h3>
              <span className="text-xs font-black text-rose-600">
                -{formatPKR(summary?.totalOutflow ?? 0)}
              </span>
            </div>

            {byCategory.outflows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No outflows recorded in period</div>
            ) : (
              <div className="space-y-2.5">
                {byCategory.outflows.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 capitalize">{item.category}</span>
                      <span className="font-bold text-slate-900">
                        {formatPKR(item.amount)}{" "}
                        <span className="text-slate-400 text-[10px] font-normal">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-600" />
            Account Balances & Period Movements
          </h3>
          <span className="text-[11px] text-slate-400">{byAccount.length} Accounts Active</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3">Account Name</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-right">Period Inflow</th>
                <th className="p-3 text-right">Period Outflow</th>
                <th className="p-3 text-right">Period Net</th>
                <th className="p-3 text-right">Current Available Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {byAccount.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-900">
                    {acc.name}
                    {acc.bankName && <span className="text-slate-400 font-normal ml-1">({acc.bankName})</span>}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                      {acc.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium text-emerald-600">
                    +{formatPKR(acc.periodInflow)}
                  </td>
                  <td className="p-3 text-right font-medium text-rose-600">
                    -{formatPKR(acc.periodOutflow)}
                  </td>
                  <td
                    className={`p-3 text-right font-bold ${
                      acc.periodNet >= 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {acc.periodNet >= 0 ? "+" : ""}
                    {formatPKR(acc.periodNet)}
                  </td>
                  <td className="p-3 text-right font-black text-slate-900">
                    {formatPKR(acc.currentBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Periodic Trend Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-600" />
            Cash Flow Trend by {period.toUpperCase()}
          </h3>
          <span className="text-[11px] text-slate-400">{trend.length} Periods</span>
        </div>

        {trend.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No transaction activity found for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Period</th>
                  <th className="p-3 text-right">Inflow</th>
                  <th className="p-3 text-right">Outflow</th>
                  <th className="p-3 text-right">Net Flow</th>
                  <th className="p-3 text-right">Cumulative Cash Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trend.map((t, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-slate-800">{t.period}</td>
                    <td className="p-3 text-right font-medium text-emerald-600">
                      +{formatPKR(t.inflow)}
                    </td>
                    <td className="p-3 text-right font-medium text-rose-600">
                      -{formatPKR(t.outflow)}
                    </td>
                    <td
                      className={`p-3 text-right font-bold ${
                        t.net >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {t.net >= 0 ? "+" : ""}
                      {formatPKR(t.net)}
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">
                      {formatPKR(t.runningCash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
