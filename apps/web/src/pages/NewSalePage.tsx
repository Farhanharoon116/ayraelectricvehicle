import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  User,
  Bike,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  CreditCard,
  Trash2,
  Calendar,
  Info,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import {
  formatPKR,
  amountToWords,
  getTodayPKT,
  CNIC_REGEX,
  calculateInstallmentPlan,
} from "@aev/shared";
import type { InstallmentCalculationResult } from "@aev/shared";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface CustomerOption {
  id: string;
  name: string;
  cnic: string;
  phone: string;
  address: string;
}

interface InStockUnit {
  id: string;
  chassisNumber: string;
  motorNumber: string;
  batterySerialNumbers: string;
  color: string;
  modelId: string;
  modelName: string;
  brandName: string;
  variant?: string;
  defaultSellingPrice: number;
}

interface ShowroomSettings {
  allowedDurations: number[];
  minDownPaymentType: "percentage" | "fixed";
  minDownPaymentValue: number;
  defaultMarkupType: "flat" | "percentage";
  defaultMarkupValue: number;
  guarantorEnabled: boolean;
  lateFineEnabled: boolean;
  lateFineType: "fixed" | "percentage";
  lateFineAmount: number;
  lateFineGraceDays: number;
}

interface AccountOption {
  id: string;
  name: string;
  type: "cash" | "bank" | "mobile_wallet" | "other";
  isActive: boolean;
}

interface PaymentRow {
  accountId: string;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "other";
  reference: string;
}

// ─── Helper: Payment Split UI ────────────────────────────────────────────────

function SplitPaymentRows({
  rows,
  onChange,
  totalLabel,
  targetAmount,
  accounts,
}: {
  rows: PaymentRow[];
  onChange: (rows: PaymentRow[]) => void;
  totalLabel: string;
  targetAmount: number;
  accounts: AccountOption[];
}) {
  const sumPayments = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const unallocated = targetAmount - sumPayments;
  const isOver = sumPayments > targetAmount;
  const isUnder = sumPayments < targetAmount;

  const updateRow = (idx: number, partial: Partial<PaymentRow>) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...partial } : r));
    onChange(next);
  };

  const handleAccountChange = (idx: number, accId: string) => {
    const acc = accounts.find((a) => a.id === accId);
    const method: "cash" | "bank_transfer" | "other" =
      acc?.type === "cash" ? "cash" : acc?.type === "bank" ? "bank_transfer" : "other";
    updateRow(idx, { accountId: accId, paymentMethod: method });
  };

  const addRow = () => {
    const defaultAcc = accounts[0];
    const defaultMethod =
      defaultAcc?.type === "cash" ? "cash" : defaultAcc?.type === "bank" ? "bank_transfer" : "other";
    onChange([
      ...rows,
      {
        accountId: defaultAcc?.id || "",
        amount: 0,
        paymentMethod: defaultMethod,
        reference: "",
      },
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2.5">
      {rows.map((row, idx) => (
        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Payment {idx + 1}</span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-rose-500 hover:text-rose-700 p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                Account *
              </label>
              <select
                value={row.accountId}
                onChange={(e) => handleAccountChange(idx, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {accounts.length === 0 ? (
                  <option value="">No accounts found</option>
                ) : (
                  accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                Amount (PKR) *
              </label>
              <input
                type="number"
                value={row.amount || ""}
                onChange={(e) => updateRow(idx, { amount: Number(e.target.value) })}
                placeholder="0"
                min={1}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>
          {(row.paymentMethod === "bank_transfer" || row.paymentMethod === "other") && (
            <input
              type="text"
              value={row.reference}
              onChange={(e) => updateRow(idx, { reference: e.target.value })}
              placeholder="Reference / Transaction ID (optional)"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-brand-400 text-slate-500 hover:text-brand-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Another Payment Method
      </button>

      {/* Running total */}
      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
        <span className="text-slate-500 font-semibold">{totalLabel}</span>
        <div className="text-right">
          <span className="font-black text-slate-900">{formatPKR(sumPayments)}</span>
          {isOver && (
            <div className="text-[10px] text-rose-600 font-bold">
              Overpaying by {formatPKR(sumPayments - targetAmount)}!
            </div>
          )}
          {isUnder && unallocated > 0 && (
            <div className="text-[10px] text-amber-600 font-semibold">
              {formatPKR(unallocated)} still unallocated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function NewSalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Wizard state ──
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [saleDate, setSaleDate] = useState(getTodayPKT());
  const [basePrice, setBasePrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [saleType, setSaleType] = useState<"full_payment" | "installment">("full_payment");
  const [formError, setFormError] = useState("");
  const [notes, setNotes] = useState("");

  // ── Customer state ──
  const [customerSearch, setCustomerSearch] = useState("");
  const [showInlineNewCustomer, setShowInlineNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustCnic, setNewCustCnic] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // ── Full Payment split rows ──
  const [fullPaymentRows, setFullPaymentRows] = useState<PaymentRow[]>([
    { accountId: "", amount: 0, paymentMethod: "cash", reference: "" },
  ]);

  // ── Installment state ──
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [downPaymentAmount, setDownPaymentAmount] = useState<number>(0);
  const [markupType, setMarkupType] = useState<"flat" | "percentage">("percentage");
  const [markupValue, setMarkupValue] = useState<number>(0);
  const [installStartDate, setInstallStartDate] = useState(getTodayPKT());
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorCnic, setGuarantorCnic] = useState("");
  const [guarantorPhone, setGuarantorPhone] = useState("");
  const [guarantorAddress, setGuarantorAddress] = useState("");
  const [downPaymentRows, setDownPaymentRows] = useState<PaymentRow[]>([
    { accountId: "", amount: 0, paymentMethod: "cash", reference: "" },
  ]);

  // ── Queries ──
  const { data: accountsData } = useQuery<{ accounts: AccountOption[] }>({
    queryKey: ["accounts"],
    queryFn: () => fetchApi("/api/accounts"),
  });
  const activeAccounts = accountsData?.accounts?.filter((a) => a.isActive) || [];

  // Default rows to first active account
  useEffect(() => {
    if (activeAccounts.length > 0) {
      const defaultAcc = activeAccounts[0]!;
      const defaultMethod =
        defaultAcc.type === "cash" ? "cash" : defaultAcc.type === "bank" ? "bank_transfer" : "other";
      setFullPaymentRows((prev) =>
        prev.map((r) => (!r.accountId ? { ...r, accountId: defaultAcc.id, paymentMethod: defaultMethod } : r))
      );
      setDownPaymentRows((prev) =>
        prev.map((r) => (!r.accountId ? { ...r, accountId: defaultAcc.id, paymentMethod: defaultMethod } : r))
      );
    }
  }, [activeAccounts]);
  const { data: customersData } = useQuery<{ customers: CustomerOption[] }>({
    queryKey: ["customers-picker", customerSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (customerSearch) params.set("q", customerSearch);
      return fetchApi(`/api/customers?${params.toString()}`);
    },
  });

  const { data: unitsData } = useQuery<{ units: InStockUnit[] }>({
    queryKey: ["units-picker"],
    queryFn: () => fetchApi("/api/units?status=in_stock"),
  });

  const { data: settingsData } = useQuery<{ settings: ShowroomSettings }>({
    queryKey: ["settings"],
    queryFn: () => fetchApi("/api/settings"),
  });

  // ── Mutations ──
  const createCustomerMutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi("/api/customers", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (res: { customerId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["customers-picker"] });
      setSelectedCustomerId(res.customerId);
      setShowInlineNewCustomer(false);
      setNewCustName("");
      setNewCustCnic("");
      setNewCustPhone("");
      setNewCustAddress("");
    },
    onError: (err: Error) => setFormError(err.message || "Failed to register customer"),
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: object) =>
      fetchApi("/api/sales", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (res: { saleId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      navigate(`/invoices/${res.saleId}`);
    },
    onError: (err: Error) => setFormError(err.message || "Failed to record sale"),
  });

  // ── Derived values ──
  const selectedCustomer = customersData?.customers.find((c) => c.id === selectedCustomerId);
  const inStockUnits = unitsData?.units || [];
  const selectedUnit = inStockUnits.find((u) => u.id === selectedUnitId);
  const totalAmount = Math.max(0, basePrice - discount);
  const settings = settingsData?.settings;
  const allowedDurations = settings?.allowedDurations ?? [3, 6, 9, 12];

  // ── Installment live preview ──
  let installCalc: InstallmentCalculationResult | null = null;
  if (saleType === "installment" && basePrice > 0 && durationMonths > 0) {
    installCalc = calculateInstallmentPlan({
      basePrice,
      discount,
      downPaymentAmount,
      durationMonths,
      markupType,
      markupValue,
      startDate: installStartDate,
    });
  }

  // Min down payment calculation
  const computeMinDownPayment = (): number => {
    if (!settings) return 0;
    if (settings.minDownPaymentType === "fixed") return settings.minDownPaymentValue;
    return Math.round((totalAmount * settings.minDownPaymentValue) / 100);
  };

  // ── Handlers ──
  const handleUnitSelect = (unit: InStockUnit) => {
    setSelectedUnitId(unit.id);
    setBasePrice(unit.defaultSellingPrice);
    const defaultAcc = activeAccounts[0];
    const defaultMethod =
      defaultAcc?.type === "cash" ? "cash" : defaultAcc?.type === "bank" ? "bank_transfer" : "other";
    setFullPaymentRows([
      {
        accountId: defaultAcc?.id || "",
        amount: unit.defaultSellingPrice,
        paymentMethod: defaultMethod,
        reference: "",
      },
    ]);
  };

  const handleDiscountChange = (val: number) => {
    setDiscount(val);
  };

  const handleInlineCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!CNIC_REGEX.test(newCustCnic)) {
      setFormError("CNIC must follow format: 12345-1234567-1");
      return;
    }
    createCustomerMutation.mutate({
      name: newCustName.trim(),
      cnic: newCustCnic.trim(),
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
    });
  };

  const handleSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedCustomerId) { setFormError("Please select or register a customer"); return; }
    if (!selectedUnitId) { setFormError("Please select an in-stock scooty unit"); return; }
    if (basePrice <= 0) { setFormError("Selling price must be greater than zero"); return; }

    if (saleType === "full_payment") {
      const sumPaid = fullPaymentRows.reduce((s, r) => s + (r.amount || 0), 0);
      if (sumPaid !== totalAmount) {
        setFormError(`Payment total (${formatPKR(sumPaid)}) must equal the total amount (${formatPKR(totalAmount)})`);
        return;
      }
      if (fullPaymentRows.some((r) => !r.accountId)) {
        setFormError("Please select an account for each payment row");
        return;
      }
      createSaleMutation.mutate({
        customerId: selectedCustomerId,
        unitId: selectedUnitId,
        saleType: "full_payment",
        saleDate,
        basePrice,
        discount,
        notes: notes.trim() || undefined,
        payments: fullPaymentRows.map((r) => ({
          accountId: r.accountId,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          reference: r.reference.trim() || undefined,
        })),
      });
    } else {
      // Installment
      if (!installCalc) { setFormError("Please fill in pricing details"); return; }
      const minDP = computeMinDownPayment();
      if (downPaymentAmount < minDP) {
        setFormError(`Minimum down payment is ${formatPKR(minDP)}`);
        return;
      }
      if (settings?.guarantorEnabled) {
        if (!guarantorName.trim() || !guarantorCnic.trim() || !guarantorPhone.trim() || !guarantorAddress.trim()) {
          setFormError("Guarantor details are required for installment sales");
          return;
        }
        if (!CNIC_REGEX.test(guarantorCnic)) {
          setFormError("Guarantor CNIC must follow format: 12345-1234567-1");
          return;
        }
      }
      const sumDP = downPaymentRows.reduce((s, r) => s + (r.amount || 0), 0);
      if (downPaymentAmount > 0 && sumDP !== downPaymentAmount) {
        setFormError(`Down payment split total (${formatPKR(sumDP)}) must equal down payment amount (${formatPKR(downPaymentAmount)})`);
        return;
      }
      if (downPaymentAmount > 0 && downPaymentRows.some((r) => !r.accountId)) {
        setFormError("Please select an account for each down payment row");
        return;
      }

      createSaleMutation.mutate({
        customerId: selectedCustomerId,
        unitId: selectedUnitId,
        saleType: "installment",
        saleDate,
        basePrice,
        discount,
        notes: notes.trim() || undefined,
        payments: downPaymentAmount > 0
          ? downPaymentRows.map((r) => ({
            accountId: r.accountId,
            amount: r.amount,
            paymentMethod: r.paymentMethod,
            reference: r.reference.trim() || undefined,
          }))
          : [],
        installmentPlan: {
          durationMonths,
          downPaymentAmount,
          markupType,
          markupValue,
          startDate: installStartDate,
          guarantor:
            settings?.guarantorEnabled
              ? {
                name: guarantorName.trim(),
                cnic: guarantorCnic.trim(),
                phone: guarantorPhone.trim(),
                address: guarantorAddress.trim(),
              }
              : undefined,
        },
      });
    }
  };

  const stepLabels = ["Customer", "Unit", "Pricing", "Payment"];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-brand-600" />
          New Scooty Sale
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          4-step wizard: select customer, unit, pricing, then payment mode.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as 1 | 2 | 3 | 4;
          const active = step === s;
          const done = step > s;
          return (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active
                  ? "bg-brand-600 text-white"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-400"
                  }`}
              >
                <span>{s}</span>
                <span className="hidden sm:inline">{label}</span>
                {done && <CheckCircle2 className="w-3 h-3" />}
              </div>
              {i < 3 && <ArrowRight className="w-3 h-3 text-slate-300" />}
            </div>
          );
        })}
      </div>

      {formError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSaleSubmit} className="space-y-4">
        {/* ─── STEP 1: Customer ─────────────────────────── */}
        {step === 1 && (
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-600" />
                1. Customer Selection
              </h2>
              <button
                type="button"
                onClick={() => setShowInlineNewCustomer(!showInlineNewCustomer)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {showInlineNewCustomer ? "Select Existing" : "Register New"}
              </button>
            </div>

            {!showInlineNewCustomer ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customer by name, CNIC, or phone..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                  {customersData?.customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${selectedCustomerId === c.id
                        ? "bg-brand-50/70 border-brand-500 text-brand-900"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                    >
                      <div>
                        <span className="font-bold">{c.name}</span>
                        <span className="text-slate-500 ml-2 font-mono text-[11px]">{c.cnic}</span>
                        <div className="text-[11px] text-slate-400">{c.phone} • {c.address}</div>
                      </div>
                      {selectedCustomerId === c.id && <CheckCircle2 className="w-4 h-4 text-brand-600" />}
                    </div>
                  ))}
                </div>
                {selectedCustomer && (
                  <div className="p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <span className="text-brand-400 font-semibold block text-[10px] uppercase">Selected Buyer</span>
                      <span className="font-bold text-sm">{selectedCustomer.name}</span>
                      <span className="text-slate-400 text-xs ml-2 font-mono">{selectedCustomer.cnic}</span>
                    </div>
                    <span className="text-xs text-slate-400">{selectedCustomer.phone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800">Quick Register New Customer</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" placeholder="Full Name *" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg" required />
                  <input type="text" placeholder="CNIC (12345-1234567-1) *" value={newCustCnic} onChange={(e) => setNewCustCnic(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono" required />
                  <input type="text" placeholder="Phone (0300-1234567) *" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg" required />
                  <input type="text" placeholder="Residential Address *" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} className="px-3 py-2 bg-white border border-slate-300 rounded-lg" required />
                </div>
                <button
                  type="button"
                  onClick={handleInlineCustomerSubmit}
                  disabled={createCustomerMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm text-xs"
                >
                  {createCustomerMutation.isPending ? "Saving..." : "Save & Select Customer"}
                </button>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => { setFormError(""); if (!selectedCustomerId) { setFormError("Please select or register a customer"); return; } setStep(2); }}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
              >
                Next: Select Unit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Unit ──────────────────────────────── */}
        {step === 2 && (
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
              <Bike className="w-4 h-4 text-brand-600" />
              2. In-Stock Scooty Selection
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
              {inStockUnits.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleUnitSelect(u)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${selectedUnitId === u.id
                    ? "bg-brand-50/70 border-brand-500 text-brand-900 shadow-sm"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{u.brandName} {u.modelName}</span>
                      <span className="font-bold text-brand-700">{formatPKR(u.defaultSellingPrice)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Color: <strong className="text-slate-800">{u.color}</strong></div>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-500 flex justify-between">
                    <span>Chassis: {u.chassisNumber}</span>
                    {selectedUnitId === u.id && <span className="font-bold text-brand-600">SELECTED</span>}
                  </div>
                </div>
              ))}
            </div>

            {selectedUnit && (
              <div className="p-3 bg-slate-900 text-white rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="text-brand-400 font-semibold block text-[10px] uppercase">Selected Vehicle</span>
                  <span className="font-bold text-sm">{selectedUnit.brandName} - {selectedUnit.modelName} ({selectedUnit.color})</span>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">Chassis: {selectedUnit.chassisNumber} | Motor: {selectedUnit.motorNumber}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Retail Price</span>
                  <span className="font-bold text-base text-white">{formatPKR(selectedUnit.defaultSellingPrice)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50">← Back</button>
              <button
                type="button"
                onClick={() => { setFormError(""); if (!selectedUnitId) { setFormError("Please select an in-stock scooty unit"); return; } setStep(3); }}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
              >
                Next: Pricing <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Pricing ────────────────────────────── */}
        {step === 3 && (
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
              <DollarSign className="w-4 h-4 text-brand-600" />
              3. Pricing Breakdown
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Base Price (PKR) *</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => { setBasePrice(Number(e.target.value)); }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Discount (PKR)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => handleDiscountChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sale Date *</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Payable</div>
                <div className="text-2xl font-black">{formatPKR(totalAmount)}</div>
                <div className="text-[11px] text-slate-400 italic mt-0.5">{amountToWords(totalAmount)}</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Base: <span className="text-white font-semibold">{formatPKR(basePrice)}</span></div>
                {discount > 0 && <div>Discount: <span className="text-rose-400 font-semibold">-{formatPKR(discount)}</span></div>}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Free helmet included, 1st service due in 30 days"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50">← Back</button>
              <button
                type="button"
                onClick={() => { setFormError(""); if (basePrice <= 0) { setFormError("Selling price must be greater than zero"); return; } setStep(4); }}
                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
              >
                Next: Payment <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Payment Mode & Confirm ─────────────── */}
        {step === 4 && (
          <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs sm:text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
              <CreditCard className="w-4 h-4 text-brand-600" />
              4. Payment Mode & Confirmation
            </h2>

            {/* Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSaleType("full_payment")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${saleType === "full_payment"
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "bg-white border-slate-300 text-slate-600 hover:border-brand-400"
                  }`}
              >
                💵 Full Payment
              </button>
              <button
                type="button"
                onClick={() => setSaleType("installment")}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${saleType === "installment"
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "bg-white border-slate-300 text-slate-600 hover:border-brand-400"
                  }`}
              >
                📅 Installment Plan
              </button>
            </div>

            {/* ── Full Payment ── */}
            {saleType === "full_payment" && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Total to Collect</span>
                  <span className="font-black text-slate-900 text-base">{formatPKR(totalAmount)}</span>
                </div>
                <SplitPaymentRows
                  rows={fullPaymentRows}
                  onChange={setFullPaymentRows}
                  totalLabel="Total Paid"
                  targetAmount={totalAmount}
                  accounts={activeAccounts}
                />
              </div>
            )}

            {/* ── Installment ── */}
            {saleType === "installment" && (
              <div className="space-y-5">
                {/* Duration */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-2">Duration (Months)</label>
                  <div className="flex flex-wrap gap-2">
                    {allowedDurations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationMonths(d)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${durationMonths === d
                          ? "bg-brand-600 border-brand-600 text-white"
                          : "bg-white border-slate-300 text-slate-600 hover:border-brand-400"
                          }`}
                      >
                        {d} months
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Down Payment */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Down Payment (PKR)</label>
                    <input
                      type="number"
                      value={downPaymentAmount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDownPaymentAmount(v);
                        const defaultAcc = activeAccounts[0];
                        const defaultMethod =
                          defaultAcc?.type === "cash" ? "cash" : defaultAcc?.type === "bank" ? "bank_transfer" : "other";
                        setDownPaymentRows([
                          {
                            accountId: defaultAcc?.id || "",
                            amount: v,
                            paymentMethod: defaultMethod,
                            reference: "",
                          },
                        ]);
                      }}
                      min={0}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                    {settings && (
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Min: {formatPKR(computeMinDownPayment())}
                        {settings.minDownPaymentType === "percentage" && ` (${settings.minDownPaymentValue}%)`}
                      </div>
                    )}
                  </div>

                  {/* Markup */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Markup
                      {settings && (
                        <span className="text-[10px] text-slate-400 ml-1 font-normal">
                          (default: {settings.defaultMarkupType === "percentage" ? `${settings.defaultMarkupValue}%` : formatPKR(settings.defaultMarkupValue)})
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={markupType}
                        onChange={(e) => setMarkupType(e.target.value as "flat" | "percentage")}
                        className="px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                      >
                        <option value="percentage">%</option>
                        <option value="flat">Flat PKR</option>
                      </select>
                      <input
                        type="number"
                        value={markupValue}
                        onChange={(e) => setMarkupValue(Number(e.target.value))}
                        min={0}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                        placeholder={markupType === "percentage" ? "e.g. 15" : "e.g. 50000"}
                      />
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Agreement Start Date
                    </label>
                    <input
                      type="date"
                      value={installStartDate}
                      onChange={(e) => setInstallStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                    <div className="text-[10px] text-slate-500 mt-0.5">First installment due 1 month from this date</div>
                  </div>
                </div>

                {/* Live Preview */}
                {installCalc && (
                  <div className="p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-brand-800 uppercase tracking-wider">📊 Installment Preview</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-brand-100">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Net Price</div>
                        <div className="font-black text-slate-900">{formatPKR(installCalc.netPrice)}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-brand-100">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Markup</div>
                        <div className="font-black text-amber-700">{formatPKR(installCalc.markupAmount)}</div>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-brand-100">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Payable</div>
                        <div className="font-black text-slate-900">{formatPKR(installCalc.totalPayable)}</div>
                      </div>
                      <div className="bg-brand-600 text-white p-2.5 rounded-lg">
                        <div className="text-[10px] text-brand-200 uppercase font-semibold">Monthly</div>
                        <div className="font-black">{formatPKR(installCalc.monthlyInstallmentAmount)}</div>
                      </div>
                    </div>

                    {/* Schedule table */}
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-brand-200">
                      <table className="w-full text-xs">
                        <thead className="bg-brand-700 text-white sticky top-0">
                          <tr>
                            <th className="py-1.5 px-3 text-left">#</th>
                            <th className="py-1.5 px-3 text-left">Due Date</th>
                            <th className="py-1.5 px-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-100 bg-white">
                          {installCalc.schedules.map((s) => (
                            <tr key={s.installmentNumber}>
                              <td className="py-1.5 px-3 font-semibold text-slate-700">{s.installmentNumber}</td>
                              <td className="py-1.5 px-3 font-mono text-slate-600">{s.dueDate}</td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">{formatPKR(s.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Guarantor Section */}
                {settings?.guarantorEnabled && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">👤 Guarantor Details (Required)</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        placeholder="Guarantor Full Name *"
                        value={guarantorName}
                        onChange={(e) => setGuarantorName(e.target.value)}
                        className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="CNIC (12345-1234567-1) *"
                        value={guarantorCnic}
                        onChange={(e) => setGuarantorCnic(e.target.value)}
                        className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Phone *"
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                        className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Address *"
                        value={guarantorAddress}
                        onChange={(e) => setGuarantorAddress(e.target.value)}
                        className="px-3 py-2 bg-white border border-amber-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Down payment split */}
                {downPaymentAmount > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Down Payment Method ({formatPKR(downPaymentAmount)})
                    </div>
                    <SplitPaymentRows
                      rows={downPaymentRows}
                      onChange={setDownPaymentRows}
                      totalLabel="Total Down Payment"
                      targetAmount={downPaymentAmount}
                      accounts={activeAccounts}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Submit bar */}
            <div className="flex justify-between items-center border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setStep(3)} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50">← Back</button>
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Invoice</div>
                <div className="text-lg font-black text-slate-900">{formatPKR(totalAmount)}</div>
              </div>
              <button
                type="submit"
                disabled={createSaleMutation.isPending || !selectedCustomerId || !selectedUnitId}
                className="px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center gap-2"
              >
                {createSaleMutation.isPending
                  ? "Processing..."
                  : saleType === "installment"
                    ? "Confirm Installment Sale"
                    : "Confirm Full Payment"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
