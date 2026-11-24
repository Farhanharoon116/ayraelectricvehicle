import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, AlertCircle } from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, getTodayPKT } from "@aev/shared";

interface AccountOption {
  id: string;
  name: string;
  type: "cash" | "bank" | "mobile_wallet" | "other";
  isActive: boolean;
}

interface RecordPaymentModalProps {
  saleId: string;
  remainingBalance: number;
  isInstallment: boolean;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

export function RecordPaymentModal({
  saleId,
  remainingBalance,
  isInstallment: _isInstallment,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState<number>(remainingBalance);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "other">("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayPKT());
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const { data: accountsData } = useQuery<{ accounts: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: () => fetchApi("/api/accounts"),
  });

  const activeAccounts = accountsData?.accounts?.filter((a) => a.isActive) || [];

  // Default to first active account
  useEffect(() => {
    if (!accountId && activeAccounts.length > 0) {
      const firstAcc = activeAccounts[0]!;
      setAccountId(firstAcc.id);
      setPaymentMethod(
        firstAcc.type === "cash"
          ? "cash"
          : firstAcc.type === "bank"
          ? "bank_transfer"
          : "other"
      );
    }
  }, [activeAccounts, accountId]);

  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
    const acc = activeAccounts.find((a) => a.id === newAccId);
    if (acc) {
      setPaymentMethod(
        acc.type === "cash"
          ? "cash"
          : acc.type === "bank"
          ? "bank_transfer"
          : "other"
      );
    }
  };

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi<{ paymentId: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onSuccess(res.paymentId);
    },
    onError: (err: Error) => setFormError(err.message || "Failed to record payment"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!accountId) {
      setFormError("Please select an account to receive this payment");
      return;
    }
    if (amount <= 0) {
      setFormError("Amount must be greater than zero");
      return;
    }
    if (amount > remainingBalance) {
      setFormError(`Amount cannot exceed remaining balance of ${formatPKR(remainingBalance)}`);
      return;
    }
    mutation.mutate({
      saleId,
      accountId,
      amount,
      paymentDate,
      paymentMethod,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-slate-900 text-sm">Record Payment</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500">Remaining Balance:</span>
            <span className="font-black text-amber-700 ml-2 text-sm">{formatPKR(remainingBalance)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Account Received In *
            </label>
            <div className="relative">
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {activeAccounts.length === 0 ? (
                  <option value="">No active accounts found</option>
                ) : (
                  activeAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type.replace("_", " ")})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (PKR) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
              max={remainingBalance}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-700 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank_transfer" | "other")}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Mobile Wallet / Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Cheque # / Trx ID
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. JazzCash TID #891238"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Month 2 installment installment"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || activeAccounts.length === 0}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              {mutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
