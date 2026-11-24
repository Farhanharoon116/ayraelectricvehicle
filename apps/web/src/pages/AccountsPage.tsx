import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  Building2,
  Smartphone,
  Plus,
  ArrowRightLeft,
  FileText,
  Download,
  AlertCircle,
  X,
  Calendar,
  Scale,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate, getTodayPKT } from "@aev/shared";

interface AccountItem {
  id: string;
  name: string;
  type: "cash" | "bank" | "mobile_wallet" | "other";
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  openingBalance?: number;
  openingDate?: number;
  isActive: boolean;
  totalIn?: number;
  totalOut?: number;
  balance?: number;
}

interface StatementEntry {
  id: string;
  date: number;
  direction: "in" | "out";
  amount: number;
  type: string;
  category: string;
  referenceType?: string;
  referenceId?: string;
  notes: string;
  reversesId?: string;
  runningBalance: number;
}

interface StatementResponse {
  account: AccountItem;
  period: {
    from: string;
    to: string;
    initialPeriodBalance: number;
    totalIn: number;
    totalOut: number;
    closingBalance: number;
  };
  entries: StatementEntry[];
}

export function AccountsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const queryClient = useQueryClient();

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [statementAccount, setStatementAccount] = useState<AccountItem | null>(null);
  const [reconcileAccount, setReconcileAccount] = useState<AccountItem | null>(null);

  // Add Account form state
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"cash" | "bank" | "mobile_wallet" | "other">("bank");
  const [newBankName, setNewBankName] = useState("");
  const [newAccountTitle, setNewAccountTitle] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newOpeningBalance, setNewOpeningBalance] = useState<number>(0);
  const [newOpeningDate, setNewOpeningDate] = useState(getTodayPKT());
  const [addError, setAddError] = useState("");

  // Transfer form state
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferDate, setTransferDate] = useState(getTodayPKT());
  const [transferNotes, setTransferNotes] = useState("");
  const [transferError, setTransferError] = useState("");

  // Reconcile form state
  const [countedBalance, setCountedBalance] = useState<number>(0);
  const [countedDate, setCountedDate] = useState(getTodayPKT());
  const [reconcileReason, setReconcileReason] = useState("");
  const [reconcileError, setReconcileError] = useState("");

  // Statement date filter
  const today = getTodayPKT();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split("T")[0]!;
  const [statementFrom, setStatementFrom] = useState(thirtyDaysAgo);
  const [statementTo, setStatementTo] = useState(today);

  // Queries
  const { data, isLoading } = useQuery<{ accounts: AccountItem[] }>({
    queryKey: ["accounts"],
    queryFn: () => fetchApi("/api/accounts"),
  });

  const { data: statementData, isLoading: statementLoading } = useQuery<StatementResponse>({
    queryKey: ["account-statement", statementAccount?.id, statementFrom, statementTo],
    queryFn: () =>
      fetchApi(`/api/accounts/${statementAccount!.id}/statement?from=${statementFrom}&to=${statementTo}`),
    enabled: !!statementAccount && isOwner,
  });

  // Mutations
  const createAccountMutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi("/api/accounts", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setShowAddModal(false);
      resetAddForm();
    },
    onError: (err: Error) => setAddError(err.message || "Failed to create account"),
  });

  const transferMutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi("/api/accounts/transfer", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setShowTransferModal(false);
      resetTransferForm();
    },
    onError: (err: Error) => setTransferError(err.message || "Transfer failed"),
  });

  const reconcileMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      fetchApi(`/api/accounts/${id}/reconcile`, { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-statement"] });
      setReconcileAccount(null);
      resetReconcileForm();
    },
    onError: (err: Error) => setReconcileError(err.message || "Reconciliation failed"),
  });

  const resetAddForm = () => {
    setNewName("");
    setNewType("bank");
    setNewBankName("");
    setNewAccountTitle("");
    setNewAccountNumber("");
    setNewOpeningBalance(0);
    setNewOpeningDate(getTodayPKT());
    setAddError("");
  };

  const resetTransferForm = () => {
    setTransferFrom("");
    setTransferTo("");
    setTransferAmount(0);
    setTransferDate(getTodayPKT());
    setTransferNotes("");
    setTransferError("");
  };

  const resetReconcileForm = () => {
    setCountedBalance(0);
    setCountedDate(getTodayPKT());
    setReconcileReason("");
    setReconcileError("");
  };

  const accountsList = data?.accounts || [];
  const activeAccounts = accountsList.filter((a) => a.isActive);

  // Totals for owner
  const totalCash = accountsList
    .filter((a) => a.type === "cash" && a.isActive)
    .reduce((s, a) => s + (a.balance || 0), 0);
  const totalBank = accountsList
    .filter((a) => a.type === "bank" && a.isActive)
    .reduce((s, a) => s + (a.balance || 0), 0);
  const totalWallet = accountsList
    .filter((a) => a.type === "mobile_wallet" && a.isActive)
    .reduce((s, a) => s + (a.balance || 0), 0);
  const grandTotal = totalCash + totalBank + totalWallet;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "cash":
        return <Wallet className="w-5 h-5 text-emerald-600" />;
      case "bank":
        return <Building2 className="w-5 h-5 text-blue-600" />;
      case "mobile_wallet":
        return <Smartphone className="w-5 h-5 text-purple-600" />;
      default:
        return <Wallet className="w-5 h-5 text-slate-600" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "cash":
        return "bg-emerald-100 text-emerald-800";
      case "bank":
        return "bg-blue-100 text-blue-800";
      case "mobile_wallet":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-brand-600" />
            Financial Accounts & Cash Flow
          </h1>
          <p className="text-xs text-slate-500">
            Real-time multi-account balances, inter-account transfers, and append-only financial ledger
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetTransferForm();
                setShowTransferModal(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              <span>Transfer Funds</span>
            </button>
            <button
              onClick={() => {
                resetAddForm();
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          </div>
        )}
      </div>

      {/* Owner Liquidity Summary Cards */}
      {isOwner && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cash in Hand</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{formatPKR(totalCash)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Physical drawer cash</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Bank Accounts</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{formatPKR(totalBank)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Commercial bank balances</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold uppercase tracking-wider">Mobile Wallets</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{formatPKR(totalWallet)}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">JazzCash, Easypaisa, Nayapay</div>
          </div>

          <div className="bg-brand-50 p-4 rounded-2xl border border-brand-200 shadow-sm">
            <div className="flex items-center justify-between text-brand-700">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Liquidity</span>
              <div className="p-2 rounded-xl bg-brand-600 text-white font-black text-xs">PKR</div>
            </div>
            <div className="text-2xl font-black text-brand-900 mt-2">{formatPKR(grandTotal)}</div>
            <div className="text-[10px] text-brand-600 font-semibold mt-0.5">Combined available funds</div>
          </div>
        </div>
      )}

      {/* Accounts List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">All Showroom Accounts</h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : accountsList.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
            No accounts configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountsList.map((acc) => (
              <div
                key={acc.id}
                className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-3 ${
                  acc.isActive ? "border-slate-200" : "border-slate-200 opacity-60 bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-slate-50 rounded-xl">{getTypeIcon(acc.type)}</div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{acc.name}</div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${getTypeBadge(acc.type)}`}>
                          {acc.type.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {!acc.isActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                        INACTIVE
                      </span>
                    )}
                  </div>

                  {/* Account specifics */}
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    {acc.bankName && <div>Bank: <strong className="text-slate-700">{acc.bankName}</strong></div>}
                    {acc.accountTitle && <div>Title: <strong className="text-slate-700">{acc.accountTitle}</strong></div>}
                    {acc.accountNumber && (
                      <div className="font-mono text-[11px] text-slate-600">
                        A/C: {acc.accountNumber}
                      </div>
                    )}
                  </div>
                </div>

                {/* Owner Financial Metrics */}
                {isOwner && acc.balance !== undefined && (
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-semibold text-slate-500">Current Balance:</span>
                      <span className="text-lg font-black text-slate-900">{formatPKR(acc.balance)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded-xl">
                      <div>
                        <span className="text-slate-400 block">Total Inflow</span>
                        <span className="font-bold text-emerald-700">{formatPKR(acc.totalIn || 0)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Total Outflow</span>
                        <span className="font-bold text-rose-700">{formatPKR(acc.totalOut || 0)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {isOwner && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => setStatementAccount(acc)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Statement</span>
                    </button>
                    <button
                      onClick={() => {
                        resetReconcileForm();
                        setCountedBalance(acc.balance || 0);
                        setReconcileAccount(acc);
                      }}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Reconcile Account Balance"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      <span>Reconcile</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL: Add Account ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-600" />
                Add Showroom Account
              </h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setAddError("");
                createAccountMutation.mutate({
                  name: newName.trim(),
                  type: newType,
                  bankName: newBankName.trim() || undefined,
                  accountTitle: newAccountTitle.trim() || undefined,
                  accountNumber: newAccountNumber.trim() || undefined,
                  openingBalance: Math.round(newOpeningBalance),
                  openingDate: newOpeningDate,
                });
              }}
              className="p-4 space-y-3 text-xs"
            >
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {addError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Display Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Cash Counter 1, Meezan Main Current A/C"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Type *</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as typeof newType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="cash">Cash Drawer</option>
                  <option value="bank">Bank Account</option>
                  <option value="mobile_wallet">Mobile Wallet (Easypaisa/JazzCash)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {newType !== "cash" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Bank / Provider</label>
                      <input
                        type="text"
                        placeholder="e.g. Meezan Bank, JazzCash"
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Account Title</label>
                      <input
                        type="text"
                        placeholder="e.g. AEV Motors"
                        value={newAccountTitle}
                        onChange={(e) => setNewAccountTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Account / IBAN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 0101-0105623412 or 0300-1234567"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Balance (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opening Date</label>
                  <input
                    type="date"
                    value={newOpeningDate}
                    onChange={(e) => setNewOpeningDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {createAccountMutation.isPending ? "Creating..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Transfer Funds ───────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-brand-600" />
                Inter-Account Funds Transfer
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTransferError("");
                if (!transferFrom || !transferTo) {
                  setTransferError("Please select both source and destination accounts");
                  return;
                }
                if (transferFrom === transferTo) {
                  setTransferError("Source and destination accounts must be different");
                  return;
                }
                if (transferAmount <= 0) {
                  setTransferError("Amount must be greater than zero");
                  return;
                }
                transferMutation.mutate({
                  fromAccountId: transferFrom,
                  toAccountId: transferTo,
                  amount: Math.round(transferAmount),
                  date: transferDate,
                  notes: transferNotes.trim() || undefined,
                });
              }}
              className="p-4 space-y-3 text-xs"
            >
              {transferError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {transferError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">From Account (Source Outflow) *</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="">-- Select Source Account --</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) - Balance: {formatPKR(a.balance || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">To Account (Destination Inflow) *</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="">-- Select Destination Account --</option>
                  {activeAccounts
                    .filter((a) => a.id !== transferFrom)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type}) - Balance: {formatPKR(a.balance || 0)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (PKR) *</label>
                  <input
                    type="number"
                    min={1}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transfer Date *</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Deposited cash drawer to Meezan Bank branch"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {transferMutation.isPending ? "Executing..." : "Confirm Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Reconcile Account ────────────────────────────────────── */}
      {reconcileAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Scale className="w-4 h-4 text-brand-600" />
                Reconcile Account: {reconcileAccount.name}
              </h3>
              <button onClick={() => setReconcileAccount(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setReconcileError("");
                if (reconcileReason.trim().length < 5) {
                  setReconcileError("Please provide an adjustment reason of at least 5 characters");
                  return;
                }
                reconcileMutation.mutate({
                  id: reconcileAccount.id,
                  payload: {
                    countedBalance: Math.round(countedBalance),
                    countedDate,
                    reason: reconcileReason.trim(),
                  },
                });
              }}
              className="p-4 space-y-3 text-xs"
            >
              {reconcileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {reconcileError}
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">Current System Balance:</span>
                <span className="font-black text-slate-900 text-sm">{formatPKR(reconcileAccount.balance || 0)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Actual Counted Balance *</label>
                  <input
                    type="number"
                    value={countedBalance}
                    onChange={(e) => setCountedBalance(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Counted Date *</label>
                  <input
                    type="date"
                    value={countedDate}
                    onChange={(e) => setCountedDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {countedBalance !== (reconcileAccount.balance || 0) && (
                <div className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
                  countedBalance > (reconcileAccount.balance || 0)
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  <span className="font-semibold">Reconciliation Adjustment Diff:</span>
                  <span className="font-black">
                    {countedBalance > (reconcileAccount.balance || 0) ? "+" : "-"}
                    {formatPKR(Math.abs(countedBalance - (reconcileAccount.balance || 0)))}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Adjustment *</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Physical cash count discrepancy resolved with drawer audit"
                  value={reconcileReason}
                  onChange={(e) => setReconcileReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReconcileAccount(null)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconcileMutation.isPending}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {reconcileMutation.isPending ? "Reconciling..." : "Save Reconciliation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL / DRAWER: Statement View ──────────────────────────────── */}
      {statementAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] border border-slate-200 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  Statement: {statementAccount.name} ({statementAccount.type})
                </h3>
                <p className="text-[11px] text-slate-400">Append-only chronological transaction ledger</p>
              </div>
              <button onClick={() => setStatementAccount(null)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Filter Bar & Export */}
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700">Period:</span>
                <input
                  type="date"
                  value={statementFrom}
                  onChange={(e) => setStatementFrom(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={statementTo}
                  onChange={(e) => setStatementTo(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <a
                href={`/api/accounts/${statementAccount.id}/statement?format=csv&from=${statementFrom}&to=${statementTo}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Statement CSV</span>
              </a>
            </div>

            {/* Summary Chips */}
            {statementData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-100/60 border-b border-slate-200 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Opening Balance</span>
                  <div className="font-bold text-slate-800">{formatPKR(statementData.period.initialPeriodBalance)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Inflow (+)</span>
                  <div className="font-bold text-emerald-700">+{formatPKR(statementData.period.totalIn)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Outflow (-)</span>
                  <div className="font-bold text-rose-700">-{formatPKR(statementData.period.totalOut)}</div>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Closing Balance</span>
                  <div className="font-black text-slate-900">{formatPKR(statementData.period.closingBalance)}</div>
                </div>
              </div>
            )}

            {/* Statement Table */}
            <div className="flex-1 overflow-y-auto">
              {statementLoading ? (
                <div className="p-12 text-center text-slate-400">Loading ledger statement...</div>
              ) : statementData?.entries.length === 0 ? (
                <div className="p-12 text-center text-slate-400">No transactions recorded in this period.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type & Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3 text-right">Inflow (PKR)</th>
                      <th className="py-2.5 px-3 text-right">Outflow (PKR)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementData?.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{formatPKTDate(entry.date)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-slate-800 capitalize">{entry.category}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{entry.type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs">{entry.notes || "—"}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {entry.direction === "in" ? formatPKR(entry.amount) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-700">
                          {entry.direction === "out" ? formatPKR(entry.amount) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {formatPKR(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
