import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Filter,
  Calendar,
  AlertCircle,
  X,
  Upload,
  CheckCircle2,
  Ban,
  Tag,
  Image as ImageIcon,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate, getTodayPKT } from "@aev/shared";

interface AccountOption {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface ExpenseCategory {
  id: string;
  name: string;
  isSystem: boolean;
}

interface ExpenseItem {
  id: string;
  accountId: string;
  accountName?: string;
  category: string;
  amount: number;
  date: number;
  notes?: string;
  receiptR2Key?: string;
  status: "active" | "voided";
  voidReason?: string;
  voidedAt?: number;
  createdByName?: string;
  createdAt: number;
}

export function ExpensesPage() {
  const queryClient = useQueryClient();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [voidingExpense, setVoidingExpense] = useState<ExpenseItem | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");

  // Add Expense form state
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState(getTodayPKT());
  const [notes, setNotes] = useState("");
  const [receiptKey, setReceiptKey] = useState<string>("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [addError, setAddError] = useState("");

  // Add Category form state
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

  // Filters
  const today = getTodayPKT();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split("T")[0]!;
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "voided">("all");

  // Queries
  const { data: accountsData } = useQuery<{ accounts: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: () => fetchApi("/api/accounts"),
  });

  const { data: categoriesData } = useQuery<{ categories: ExpenseCategory[] }>({
    queryKey: ["expense-categories"],
    queryFn: () => fetchApi("/api/expenses/categories"),
  });

  const { data: expensesData, isLoading } = useQuery<{ expenses: ExpenseItem[] }>({
    queryKey: ["expenses", fromDate, toDate, filterCategory, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (filterCategory !== "all") params.set("category", filterCategory);
      if (filterStatus !== "all") params.set("status", filterStatus);
      return fetchApi(`/api/expenses?${params.toString()}`);
    },
  });

  const activeAccounts = accountsData?.accounts?.filter((a) => a.isActive) || [];
  const categories = categoriesData?.categories || [];
  const expenses = expensesData?.expenses || [];

  // Mutations
  const createExpenseMutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi("/api/expenses", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setShowAddModal(false);
      resetAddForm();
    },
    onError: (err: any) => setAddError(err.message || "Failed to record expense"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi("/api/expenses/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
      setCategory(res.category?.name || newCategoryName.trim());
      setShowAddCategoryModal(false);
      setNewCategoryName("");
      setCategoryError("");
    },
    onError: (err: any) => setCategoryError(err.message || "Failed to add category"),
  });

  const voidExpenseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      fetchApi(`/api/expenses/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason: reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setVoidingExpense(null);
      setVoidReason("");
      setVoidError("");
    },
    onError: (err: any) => setVoidError(err.message || "Failed to void expense"),
  });

  const resetAddForm = () => {
    setAccountId(activeAccounts[0]?.id || "");
    setCategory(categories[0]?.name || "rent");
    setAmount(0);
    setExpenseDate(getTodayPKT());
    setNotes("");
    setReceiptKey("");
    setAddError("");
  };

  const handleOpenAdd = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    setAddError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/expenses/receipt-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      setReceiptKey(data.key);
    } catch (err: any) {
      setAddError(err.message || "Failed to upload receipt image");
    } finally {
      setReceiptUploading(false);
    }
  };

  // Stats
  const totalActive = expenses
    .filter((e) => e.status === "active")
    .reduce((s, e) => s + e.amount, 0);
  const totalVoided = expenses
    .filter((e) => e.status === "voided")
    .reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-brand-600" />
            Expenses & Outflows
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Record showroom operating expenses, utility bills, salaries, rent, and upload receipt photos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCategoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>New Category</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1">
            Total Active Expenses
          </div>
          <div className="text-2xl font-black text-rose-600">{formatPKR(totalActive)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {expenses.filter((e) => e.status === "active").length} entries recorded
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1">
            Voided Amount
          </div>
          <div className="text-2xl font-black text-slate-400">{formatPKR(totalVoided)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {expenses.filter((e) => e.status === "voided").length} entries reversed
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1">
            Date Window
          </div>
          <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{fromDate} to {toDate}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Append-only ledger entries</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-slate-500 font-semibold">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">From:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">To:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Category:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs capitalize"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="voided">Voided Only</option>
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="font-semibold text-slate-700 text-sm">No expenses recorded</div>
            <p className="text-xs text-slate-400">Record rent, utility bills, or staff tea expenses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Account Paid From</th>
                  <th className="p-3">Notes & Receipt</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  const isVoided = exp.status === "voided";
                  return (
                    <tr key={exp.id} className={isVoided ? "bg-slate-50/60 opacity-60" : "hover:bg-slate-50/50"}>
                      <td className="p-3 font-medium text-slate-900 whitespace-nowrap">
                        {formatPKTDate(exp.date)}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {exp.accountName || "Account"}
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="truncate text-slate-600">{exp.notes || "—"}</div>
                        {exp.receiptR2Key && (
                          <div className="mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] text-brand-600 font-medium">
                              <ImageIcon className="w-3 h-3" />
                              Receipt attached
                            </span>
                          </div>
                        )}
                        {isVoided && exp.voidReason && (
                          <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                            Void reason: {exp.voidReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isVoided ? "line-through text-slate-400" : "text-rose-600"
                          }`}
                        >
                          {formatPKR(exp.amount)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isVoided ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">
                            <Ban className="w-2.5 h-2.5" />
                            Voided
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {!isVoided && (
                          <button
                            onClick={() => {
                              setVoidingExpense(exp);
                              setVoidReason("");
                              setVoidError("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Void</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-600" />
                Record New Expense
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAddError("");
                if (!accountId) {
                  setAddError("Please select an account");
                  return;
                }
                if (amount <= 0) {
                  setAddError("Amount must be greater than zero");
                  return;
                }
                createExpenseMutation.mutate({
                  accountId,
                  category: category || "miscellaneous",
                  amount: Math.round(amount),
                  date: expenseDate,
                  notes: notes.trim() || undefined,
                  receiptR2Key: receiptKey || undefined,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Paid From *</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs"
                >
                  <option value="">Select Account...</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs capitalize"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder="0"
                  min={1}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-rose-600 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Office electricity bill for June"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Photo (Optional)</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{receiptUploading ? "Uploading..." : receiptKey ? "Replace Photo" : "Upload Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      disabled={receiptUploading}
                      className="hidden"
                    />
                  </label>
                  {receiptKey && (
                    <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Photo attached
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending || receiptUploading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {createExpenseMutation.isPending ? "Recording..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand-600" />
                Add Expense Category
              </h2>
              <button onClick={() => setShowAddCategoryModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {categoryError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{categoryError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCategoryError("");
                if (!newCategoryName.trim()) {
                  setCategoryError("Please enter a category name");
                  return;
                }
                createCategoryMutation.mutate(newCategoryName.trim());
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Legal Fees, Generator Fuel"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCategoryMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {createCategoryMutation.isPending ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Expense Modal */}
      {voidingExpense && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-rose-600 text-sm flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Void Expense
              </h2>
              <button onClick={() => setVoidingExpense(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Voiding this expense will mark it as voided and append a reversing adjustment to the ledger for account{" "}
              <strong>{voidingExpense.accountName || "Account"}</strong> (+{formatPKR(voidingExpense.amount)}).
            </p>

            {voidError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{voidError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setVoidError("");
                if (!voidReason.trim() || voidReason.trim().length < 5) {
                  setVoidError("A void reason of at least 5 characters is required");
                  return;
                }
                voidExpenseMutation.mutate({
                  id: voidingExpense.id,
                  reason: voidReason.trim(),
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Voiding *</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Mistakenly entered duplicate bill payment"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidingExpense(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidExpenseMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {voidExpenseMutation.isPending ? "Voiding..." : "Confirm Void"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
