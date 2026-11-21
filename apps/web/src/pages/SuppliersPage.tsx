import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Plus,
  Phone,
  FileText,
  DollarSign,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatPKR, formatPKTDate, getTodayPKT } from "@aev/shared";

interface SupplierItem {
  id: string;
  name: string;
  phone: string;
  address?: string;
  cnic?: string;
  totalPurchases: number;
  totalPayments: number;
  balancePayable: number;
}

interface SupplierTransaction {
  id: string;
  type: "purchase" | "payment";
  amount: number;
  reference?: string;
  notes?: string;
  transactionDate: number;
}

export function SuppliersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = user?.role === "owner";

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [selectedSupplierForLedger, setSelectedSupplierForLedger] = useState<SupplierItem | null>(null);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<SupplierItem | null>(null);

  // Add Supplier Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cnic, setCnic] = useState("");
  const [supplierError, setSupplierError] = useState("");

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayPKT());
  const [paymentError, setPaymentError] = useState("");

  const { data, isLoading } = useQuery<{ suppliers: SupplierItem[] }>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/api/suppliers"),
  });

  const { data: ledgerData } = useQuery<{
    supplier: SupplierItem;
    transactions: SupplierTransaction[];
  }>({
    queryKey: ["supplier-ledger", selectedSupplierForLedger?.id],
    queryFn: () => fetchApi(`/api/suppliers/${selectedSupplierForLedger!.id}/ledger`),
    enabled: !!selectedSupplierForLedger,
  });

  const addSupplierMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setShowAddSupplierModal(false);
      setName("");
      setPhone("");
      setAddress("");
      setCnic("");
      setSupplierError("");
    },
    onError: (err: any) => setSupplierError(err.message || "Failed to add supplier"),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi(`/api/suppliers/${selectedSupplierForPayment!.id}/payments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-ledger"] });
      setSelectedSupplierForPayment(null);
      setPaymentAmount(0);
      setPaymentReference("");
      setPaymentNotes("");
      setPaymentError("");
    },
    onError: (err: any) => setPaymentError(err.message || "Failed to record payment"),
  });

  const suppliers = data?.suppliers || [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-brand-600" />
            Suppliers & Ledgers
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Keep track of EV importers/manufacturers, scooty batches received, and payment settlements.
          </p>
        </div>

        <button
          onClick={() => setShowAddSupplierModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Supplier Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <Truck className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">No suppliers found</h3>
          <p className="text-xs text-slate-400">Add an electric scooty supplier or importer to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {suppliers.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
            >
              <div className="border-b border-slate-100 pb-2.5">
                <h3 className="text-base font-bold text-slate-900">{s.name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{s.phone}</span>
                </div>
                {s.address && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.address}</p>}
              </div>

              {/* Financial Snapshot */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Total Purchases:</span>
                  <span className="font-semibold text-slate-800">{formatPKR(s.totalPurchases)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Paid:</span>
                  <span className="font-semibold text-emerald-700">{formatPKR(s.totalPayments)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1 font-bold">
                  <span className="text-slate-900">Balance Payable:</span>
                  <span className={s.balancePayable > 0 ? "text-rose-600" : "text-emerald-600"}>
                    {formatPKR(s.balancePayable)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 text-xs">
                <button
                  onClick={() => setSelectedSupplierForLedger(s)}
                  className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ledger</span>
                </button>

                {isOwner && (
                  <button
                    onClick={() => {
                      setSelectedSupplierForPayment(s);
                      setPaymentAmount(Math.max(0, s.balancePayable));
                    }}
                    className="flex-1 py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add New Supplier</h3>
            {supplierError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{supplierError}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSupplierMutation.mutate({
                  name: name.trim(),
                  phone: phone.trim(),
                  address: address.trim() || undefined,
                  cnic: cnic.trim() || undefined,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Supplier Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apex EV Importers"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0300-1234567"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="City, Area or Port"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CNIC (Optional)</label>
                <input
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(e.target.value)}
                  placeholder="12345-1234567-1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSupplierMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {addSupplierMutation.isPending ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger Drawer / Modal */}
      {selectedSupplierForLedger && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedSupplierForLedger.name}</h3>
                <p className="text-xs text-slate-500">Transaction History & Ledger</p>
              </div>
              <button
                onClick={() => setSelectedSupplierForLedger(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 text-xs">
              {!ledgerData ? (
                <div className="p-4 text-center text-slate-400">Loading ledger...</div>
              ) : ledgerData.transactions.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No transactions recorded yet.</div>
              ) : (
                ledgerData.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                            tx.type === "purchase"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="text-slate-800">{tx.reference || "Transaction"}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {formatPKTDate(tx.transactionDate)} {tx.notes ? `• ${tx.notes}` : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-bold text-sm ${
                          tx.type === "purchase" ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {tx.type === "purchase" ? "-" : "+"} {formatPKR(tx.amount)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSupplierForLedger(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment to Supplier Modal (Owner only) */}
      {selectedSupplierForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Record Supplier Payment</h3>
              <p className="text-xs text-slate-500 font-semibold">{selectedSupplierForPayment.name}</p>
            </div>

            {paymentError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{paymentError}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (paymentAmount <= 0) {
                  setPaymentError("Payment amount must be greater than zero");
                  return;
                }
                recordPaymentMutation.mutate({
                  supplierId: selectedSupplierForPayment.id,
                  amount: Math.round(paymentAmount),
                  reference: paymentReference.trim() || undefined,
                  notes: paymentNotes.trim() || undefined,
                  transactionDate: paymentDate,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount to Pay (PKR) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reference / Cheque No / Bank Transfer</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. Bank Alfalah Trx #98210"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Partial payment for batch #1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSupplierForPayment(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
