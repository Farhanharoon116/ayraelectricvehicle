import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CreditCard, AlertCircle } from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, getTodayPKT } from "@aev/shared";

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
  const [amount, setAmount] = useState<number>(remainingBalance);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "other">("cash");
  const [reference, setReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayPKT());
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi<{ paymentId: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sale", saleId] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      onSuccess(res.paymentId);
    },
    onError: (err: Error) => setFormError(err.message || "Failed to record payment"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank_transfer" | "other")}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="cash">Cash in Hand</option>
              <option value="bank_transfer">Bank Transfer / Online</option>
              <option value="other">Cheque / Other</option>
            </select>
          </div>

          {paymentMethod !== "cash" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank Reference / Cheque No.
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transaction ID or Cheque number"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-all"
            >
              {mutation.isPending ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
