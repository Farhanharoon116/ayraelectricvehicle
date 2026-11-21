import { useState } from "react";
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
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, amountToWords, getTodayPKT, CNIC_REGEX } from "@aev/shared";

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

export function NewSalePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [saleDate, setSaleDate] = useState(getTodayPKT());
  const [basePrice, setBasePrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "other">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Customer inline search & add
  const [customerSearch, setCustomerSearch] = useState("");
  const [showInlineNewCustomer, setShowInlineNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustCnic, setNewCustCnic] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // Queries
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

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["customers-picker"] });
      setSelectedCustomerId(res.customerId);
      setShowInlineNewCustomer(false);
      setNewCustName("");
      setNewCustCnic("");
      setNewCustPhone("");
      setNewCustAddress("");
    },
    onError: (err: any) => setFormError(err.message || "Failed to register customer"),
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      navigate(`/invoices/${res.saleId}`);
    },
    onError: (err: any) => setFormError(err.message || "Failed to record sale"),
  });

  const selectedCustomer = customersData?.customers.find((c) => c.id === selectedCustomerId);
  const inStockUnits = unitsData?.units || [];
  const selectedUnit = inStockUnits.find((u) => u.id === selectedUnitId);

  const handleUnitSelect = (unit: InStockUnit) => {
    setSelectedUnitId(unit.id);
    setBasePrice(unit.defaultSellingPrice);
    const total = Math.max(0, unit.defaultSellingPrice - discount);
    setInitialPayment(total);
  };

  const handleDiscountChange = (val: number) => {
    setDiscount(val);
    const total = Math.max(0, basePrice - val);
    setInitialPayment(total);
  };

  const totalAmount = Math.max(0, basePrice - discount);
  const balanceRemaining = Math.max(0, totalAmount - initialPayment);

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

    if (!selectedCustomerId) {
      setFormError("Please select or register a customer");
      return;
    }
    if (!selectedUnitId) {
      setFormError("Please select an in-stock scooty unit");
      return;
    }
    if (basePrice <= 0) {
      setFormError("Selling price must be greater than zero");
      return;
    }

    createSaleMutation.mutate({
      customerId: selectedCustomerId,
      unitId: selectedUnitId,
      saleType: "full_payment",
      saleDate,
      basePrice,
      discount,
      initialPaymentAmount: initialPayment,
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-brand-600" />
          New Scooty Sale (Full Payment)
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Sell an electric scooty, snapshot vehicle & customer details, and generate an A4 invoice.
        </p>
      </div>

      {formError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSaleSubmit} className="space-y-4">
        {/* Step 1: Customer Selection */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              <span>1. Customer Selection</span>
            </h2>
            <button
              type="button"
              onClick={() => setShowInlineNewCustomer(!showInlineNewCustomer)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showInlineNewCustomer ? "Select Existing" : "Register New"}</span>
            </button>
          </div>

          {!showInlineNewCustomer ? (
            <div className="space-y-2">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search returning customer by name, CNIC, or phone..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />

              <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
                {customersData?.customers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      selectedCustomerId === c.id
                        ? "bg-brand-50/70 border-brand-500 text-brand-900"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div>
                      <span className="font-bold">{c.name}</span>
                      <span className="text-slate-500 ml-2 font-mono text-[11px]">{c.cnic}</span>
                      <div className="text-[11px] text-slate-400">{c.phone} • {c.address}</div>
                    </div>
                    {selectedCustomerId === c.id && (
                      <CheckCircle2 className="w-4 h-4 text-brand-600" />
                    )}
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
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="CNIC (12345-1234567-1) *"
                  value={newCustCnic}
                  onChange={(e) => setNewCustCnic(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                  required
                />
                <input
                  type="text"
                  placeholder="Phone (0300-1234567) *"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="Residential Address *"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <button
                type="button"
                onClick={handleInlineCustomerSubmit}
                disabled={createCustomerMutation.isPending}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-bold shadow-sm"
              >
                {createCustomerMutation.isPending ? "Saving..." : "Save & Select Customer"}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Unit Selection */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Bike className="w-4 h-4 text-brand-600" />
            <span>2. In-Stock Scooty Selection</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto">
            {inStockUnits.map((u) => (
              <div
                key={u.id}
                onClick={() => handleUnitSelect(u)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  selectedUnitId === u.id
                    ? "bg-brand-50/70 border-brand-500 text-brand-900 shadow-sm"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{u.brandName} {u.modelName}</span>
                    <span className="font-bold text-brand-700">{formatPKR(u.defaultSellingPrice)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Color: <strong className="text-slate-800">{u.color}</strong>
                  </div>
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
                <span className="font-bold text-sm">
                  {selectedUnit.brandName} - {selectedUnit.modelName} ({selectedUnit.color})
                </span>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Chassis: {selectedUnit.chassisNumber} | Motor: {selectedUnit.motorNumber}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Retail Price</span>
                <span className="font-bold text-base text-white">{formatPKR(selectedUnit.defaultSellingPrice)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Pricing & Payment Method */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
            <DollarSign className="w-4 h-4 text-brand-600" />
            <span>3. Pricing & Payment Breakdown</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Base Price (PKR) *</label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBasePrice(val);
                  setInitialPayment(Math.max(0, val - discount));
                }}
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

          {/* Payment Section */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-800">Amount Received Today</span>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Payable</span>
                <span className="text-base font-black text-slate-900">{formatPKR(totalAmount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (PKR) *</label>
                <input
                  type="number"
                  value={initialPayment}
                  onChange={(e) => setInitialPayment(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-emerald-700 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                >
                  <option value="cash">Cash in Hand</option>
                  <option value="bank_transfer">Bank Transfer / Online</option>
                  <option value="other">Cheque / Other</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Trx / Cheque Reference</label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Optional reference / receipt note"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Invoice Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Free helmet included, 1st service due in 30 days"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs font-semibold pt-1">
              <span className="text-slate-500">Remaining Balance:</span>
              <span className={balanceRemaining > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                {formatPKR(balanceRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="bg-slate-900 text-white p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="text-xs text-slate-400">Total Invoice Amount</div>
            <div className="text-xl font-black text-white">{formatPKR(totalAmount)}</div>
            <div className="text-[11px] text-slate-400">
              {amountToWords(totalAmount)}
            </div>
          </div>

          <button
            type="submit"
            disabled={createSaleMutation.isPending || !selectedCustomerId || !selectedUnitId}
            className="w-full sm:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2"
          >
            {createSaleMutation.isPending ? "Generating Invoice..." : "Confirm & Print A4 Invoice"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
