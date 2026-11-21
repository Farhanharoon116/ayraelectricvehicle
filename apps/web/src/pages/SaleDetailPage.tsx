import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  FileText,
  User,
  Bike,
  CreditCard,
  AlertCircle,
  X,
  Receipt,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, formatPKTDate } from "@aev/shared";
import { useAuth } from "../context/AuthContext";
import { RecordPaymentModal } from "../components/RecordPaymentModal";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface SaleDetail {
  id: string;
  invoiceNumber: string;
  saleType: "full_payment" | "installment";
  saleDate: number;
  basePrice: number;
  discount: number;
  totalAmount: number;
  isVoided: boolean;
  voidReason?: string;
  notes?: string;
  customerNameSnap: string;
  customerCnicSnap: string;
  customerPhoneSnap: string;
  customerAddressSnap: string;
  unitBrandSnap: string;
  unitModelSnap: string;
  unitVariantSnap?: string;
  unitColorSnap: string;
  unitChassisSnap: string;
  unitMotorSnap: string;
  unitBatterySnap: string;
  guarantorName?: string;
  guarantorCnic?: string;
  guarantorPhone?: string;
  guarantorAddress?: string;
}

interface PaymentItem {
  id: string;
  receiptNumber: string;
  paymentDate: number;
  amount: number;
  paymentMethod: string;
  reference?: string;
}

interface InstallmentPlanDetail {
  id: string;
  durationMonths: number;
  downPaymentAmount: number;
  markupType: string;
  markupValue: number;
  markupAmount: number;
  monthlyInstallmentAmount: number;
  totalPayable: number;
  startDate: string;
}

interface ScheduleItem {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: "pending" | "paid" | "overdue" | "partial";
  fineAmount?: number;
  paidDate?: string;
}

interface SaleDetailResponse {
  sale: SaleDetail;
  payments: PaymentItem[];
  totalPaid: number;
  remainingBalance: number;
  installmentPlan: InstallmentPlanDetail | null;
  schedules: ScheduleItem[];
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function ScheduleStatusBadge({ status }: { status: ScheduleItem["status"] }) {
  const styles: Record<ScheduleItem["status"], string> = {
    pending: "bg-slate-100 text-slate-700",
    paid: "bg-emerald-100 text-emerald-800",
    overdue: "bg-rose-100 text-rose-800",
    partial: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${styles[status]}`}>
      {status}
    </span>
  );
}

function MethodLabel({ method }: { method: string }) {
  const labels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    other: "Cheque / Other",
  };
  return <>{labels[method] ?? method}</>;
}

// ─── Void Modal ───────────────────────────────────────────────────────────────

function VoidModal({ saleId, onClose, onSuccess }: { saleId: string; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchApi(`/api/sales/${saleId}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason: reason.trim() }),
      }),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (err: Error) => setError(err.message || "Failed to void sale"),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h2 className="font-bold text-slate-900 text-sm">Void Sale</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">{error}</div>
          )}
          <p className="text-xs text-slate-600">
            This action will mark the sale as voided and return the unit to in-stock. This cannot be undone.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Voiding *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Minimum 5 characters..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50">Cancel</button>
            <button
              onClick={() => { setError(""); if (reason.trim().length < 5) { setError("Reason must be at least 5 characters"); return; } mutation.mutate(); }}
              disabled={mutation.isPending}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold"
            >
              {mutation.isPending ? "Voiding..." : "Void Sale"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { data, isLoading, error } = useQuery<SaleDetailResponse>({
    queryKey: ["sale", id],
    queryFn: () => fetchApi(`/api/sales/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <h2 className="text-lg font-bold text-slate-800">Sale Not Found</h2>
        <p className="text-xs">The requested sale could not be located.</p>
        <button onClick={() => navigate("/sales")} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold">Back to Sales</button>
      </div>
    );
  }

  const { sale, payments, totalPaid, remainingBalance, installmentPlan, schedules } = data;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate("/sales")} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-semibold mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sales
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 font-mono">{sale.invoiceNumber}</h1>
            {sale.isVoided ? (
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800">VOIDED</span>
            ) : (
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800">Active</span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
              {sale.saleType === "installment" ? "Installment" : "Full Payment"}
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatPKTDate(sale.saleDate)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/invoices/${sale.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" /> Print Invoice
          </Link>
          {sale.saleType === "installment" && (
            <Link
              to={`/agreements/${sale.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
            >
              <FileText className="w-3.5 h-3.5" /> Print Agreement
            </Link>
          )}
          {!sale.isVoided && remainingBalance > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" /> Record Payment
            </button>
          )}
          {isOwner && !sale.isVoided && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Void Sale
            </button>
          )}
        </div>
      </div>

      {sale.isVoided && sale.voidReason && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><span className="font-bold">Void Reason:</span> {sale.voidReason}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <User className="w-3.5 h-3.5" /> Customer Details
          </div>
          <div className="font-bold text-slate-900">{sale.customerNameSnap}</div>
          <div className="text-xs font-mono text-slate-700">CNIC: {sale.customerCnicSnap}</div>
          <div className="text-xs text-slate-600">📞 {sale.customerPhoneSnap}</div>
          <div className="text-xs text-slate-500">📍 {sale.customerAddressSnap}</div>
        </div>

        {/* Unit Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            <Bike className="w-3.5 h-3.5" /> Vehicle Specifications
          </div>
          <div className="font-bold text-slate-900">{sale.unitBrandSnap} - {sale.unitModelSnap}</div>
          <div className="text-xs text-slate-600">Variant: {sale.unitVariantSnap || "Standard"} • Color: <strong>{sale.unitColorSnap}</strong></div>
          <div className="text-xs font-mono text-slate-700 space-y-0.5">
            <div>Chassis: <strong className="select-all">{sale.unitChassisSnap}</strong></div>
            <div>Motor: <strong className="select-all">{sale.unitMotorSnap}</strong></div>
            <div>Battery: <span className="select-all">{sale.unitBatterySnap}</span></div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 mb-3">
          Financial Summary
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-semibold uppercase text-[10px]">Base Price</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{formatPKR(sale.basePrice)}</div>
          </div>
          {sale.discount > 0 && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Discount</div>
              <div className="font-bold text-rose-600 text-sm mt-0.5">-{formatPKR(sale.discount)}</div>
            </div>
          )}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-slate-500 font-semibold uppercase text-[10px]">Total Amount</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{formatPKR(sale.totalAmount)}</div>
          </div>
          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <div className="text-emerald-700 font-semibold uppercase text-[10px]">Total Paid</div>
            <div className="font-black text-emerald-700 text-sm mt-0.5">{formatPKR(totalPaid)}</div>
          </div>
          <div className={`p-3 rounded-xl border ${remainingBalance > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
            <div className={`font-semibold uppercase text-[10px] ${remainingBalance > 0 ? "text-amber-700" : "text-slate-500"}`}>Remaining</div>
            <div className={`font-black text-sm mt-0.5 ${remainingBalance > 0 ? "text-amber-700" : "text-slate-400"}`}>{formatPKR(remainingBalance)}</div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
          <Receipt className="w-3.5 h-3.5" /> Payment History
        </div>
        {payments.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No payments recorded yet</div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs">
                  <div className="font-bold text-slate-900">{formatPKR(p.amount)}</div>
                  <div className="text-slate-500">{formatPKTDate(p.paymentDate)} · <MethodLabel method={p.paymentMethod} /></div>
                  {p.reference && <div className="text-[10px] font-mono text-slate-400">{p.reference}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">{p.receiptNumber}</span>
                  <Link
                    to={`/receipts/${p.id}`}
                    className="text-brand-600 hover:text-brand-700 p-1 hover:bg-brand-50 rounded"
                    title="View Receipt"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Installment Plan */}
      {installmentPlan && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" /> Installment Plan
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-brand-50 p-3 rounded-xl border border-brand-200">
              <div className="text-brand-700 font-semibold uppercase text-[10px]">Duration</div>
              <div className="font-black text-brand-900 text-sm">{installmentPlan.durationMonths} months</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Monthly Installment</div>
              <div className="font-black text-slate-900 text-sm">{formatPKR(installmentPlan.monthlyInstallmentAmount)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Markup</div>
              <div className="font-bold text-amber-700 text-sm">{formatPKR(installmentPlan.markupAmount)}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">Total Payable</div>
              <div className="font-black text-slate-900 text-sm">{formatPKR(installmentPlan.totalPayable)}</div>
            </div>
          </div>

          {/* Schedule */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Due Date</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Fine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => (
                  <tr key={s.id} className="bg-white hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-semibold text-slate-700">{s.installmentNumber}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{s.dueDate}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{formatPKR(s.amount)}</td>
                    <td className="py-2 px-3 text-center"><ScheduleStatusBadge status={s.status} /></td>
                    <td className="py-2 px-3 text-right text-rose-600 font-semibold">
                      {s.fineAmount && s.fineAmount > 0 ? formatPKR(s.fineAmount) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Guarantor */}
          {sale.guarantorName && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-amber-800 uppercase text-[10px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Guarantor
              </div>
              <div className="font-bold text-slate-900">{sale.guarantorName}</div>
              <div className="font-mono text-slate-700">CNIC: {sale.guarantorCnic}</div>
              <div className="text-slate-600">📞 {sale.guarantorPhone}</div>
              <div className="text-slate-500">📍 {sale.guarantorAddress}</div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showVoidModal && id && (
        <VoidModal
          saleId={id}
          onClose={() => setShowVoidModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sale", id] })}
        />
      )}

      {showPaymentModal && id && (
        <RecordPaymentModal
          saleId={id}
          remainingBalance={remainingBalance}
          isInstallment={sale.saleType === "installment"}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={(paymentId) => {
            setShowPaymentModal(false);
            navigate(`/receipts/${paymentId}`);
          }}
        />
      )}
    </div>
  );
}
