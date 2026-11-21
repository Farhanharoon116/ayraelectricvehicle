import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import {
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKR, getTodayPKT } from "@aev/shared";

interface ModelOption {
  id: string;
  name: string;
  brandName: string;
  variant?: string;
  colorOptions: string[];
  defaultSellingPrice: number;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface UnitRowInput {
  chassisNumber: string;
  motorNumber: string;
  batterySerialNumbers: string;
  color: string;
  purchaseCost: number;
}

export function StockInPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modelId, setModelId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [receivedDate, setReceivedDate] = useState(getTodayPKT());
  const [defaultCost, setDefaultCost] = useState<number>(250000);
  const [defaultColor, setDefaultColor] = useState("");

  const [unitsList, setUnitsList] = useState<UnitRowInput[]>([
    {
      chassisNumber: "",
      motorNumber: "",
      batterySerialNumbers: "",
      color: "",
      purchaseCost: 250000,
    },
  ]);

  const [formError, setFormError] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);

  // Load models
  const { data: modelsData } = useQuery<{ models: ModelOption[] }>({
    queryKey: ["catalog-models"],
    queryFn: () => fetchApi("/api/catalog/models"),
  });

  // Load suppliers
  const { data: suppliersData } = useQuery<{ suppliers: SupplierOption[] }>({
    queryKey: ["suppliers"],
    queryFn: () => fetchApi("/api/suppliers"),
  });

  const selectedModel = modelsData?.models.find((m) => m.id === modelId);

  const stockInMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/units/stock-in", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSuccessCount(data.count);
      setFormError("");
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to stock in batch");
    },
  });

  const handleModelChange = (id: string) => {
    setModelId(id);
    const m = modelsData?.models.find((item) => item.id === id);
    if (m && m.colorOptions.length > 0) {
      const firstColor = m.colorOptions[0] || "";
      setDefaultColor(firstColor);
      setUnitsList((prev) =>
        prev.map((row) => ({
          ...row,
          color: row.color || firstColor,
        }))
      );
    }
  };

  const addRow = () => {
    setUnitsList((prev) => [
      ...prev,
      {
        chassisNumber: "",
        motorNumber: "",
        batterySerialNumbers: "",
        color: defaultColor || (selectedModel?.colorOptions[0] ?? ""),
        purchaseCost: defaultCost,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (unitsList.length === 1) return;
    setUnitsList((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof UnitRowInput, value: any) => {
    setUnitsList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const applyDefaultCostToAll = () => {
    setUnitsList((prev) => prev.map((u) => ({ ...u, purchaseCost: defaultCost })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!modelId) {
      setFormError("Please select a scooty model");
      return;
    }
    if (!supplierId) {
      setFormError("Please select a supplier");
      return;
    }

    // Validate units
    const chassisSet = new Set<string>();
    for (let i = 0; i < unitsList.length; i++) {
      const u = unitsList[i]!;
      const chassis = u.chassisNumber.trim().toUpperCase();
      if (!chassis) {
        setFormError(`Row #${i + 1}: Chassis number is required`);
        return;
      }
      if (chassisSet.has(chassis)) {
        setFormError(`Duplicate chassis number '${chassis}' in row #${i + 1}`);
        return;
      }
      chassisSet.add(chassis);

      if (!u.motorNumber.trim()) {
        setFormError(`Row #${i + 1}: Motor number is required`);
        return;
      }
      if (!u.batterySerialNumbers.trim()) {
        setFormError(`Row #${i + 1}: Battery serial is required`);
        return;
      }
      if (!u.color.trim()) {
        setFormError(`Row #${i + 1}: Color is required`);
        return;
      }
      if (!u.purchaseCost || u.purchaseCost <= 0) {
        setFormError(`Row #${i + 1}: Purchase cost must be positive PKR`);
        return;
      }
    }

    stockInMutation.mutate({
      modelId,
      supplierId,
      receivedDate,
      units: unitsList.map((u) => ({
        chassisNumber: u.chassisNumber.trim().toUpperCase(),
        motorNumber: u.motorNumber.trim().toUpperCase(),
        batterySerialNumbers: u.batterySerialNumbers.trim(),
        color: u.color.trim(),
        purchaseCost: Math.round(u.purchaseCost),
      })),
    });
  };

  const totalBatchCost = unitsList.reduce((acc, u) => acc + (Number(u.purchaseCost) || 0), 0);

  if (successCount !== null) {
    return (
      <div className="p-4 md:p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Batch Stocked In Successfully!</h2>
        <p className="text-sm text-slate-600">
          Added <strong className="text-slate-900">{successCount}</strong> scooties to inventory and recorded
          the purchase in the supplier ledger.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
          <button
            onClick={() => {
              setSuccessCount(null);
              setUnitsList([
                {
                  chassisNumber: "",
                  motorNumber: "",
                  batterySerialNumbers: "",
                  color: defaultColor,
                  purchaseCost: defaultCost,
                },
              ]);
            }}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-semibold transition-colors"
          >
            Stock In Another Batch
          </button>
          <Link
            to="/inventory"
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            View Inventory Units
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-brand-600" />
            Stock In Scooties
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Rapid batch entry for receiving units from an EV manufacturer or importer.
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs sm:text-sm text-rose-800">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Batch Header Info */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            1. Shipment & Supplier Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs sm:text-sm">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Scooty Model *</label>
              <select
                value={modelId}
                onChange={(e) => handleModelChange(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="">-- Choose Model --</option>
                {modelsData?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brandName} - {m.name} {m.variant ? `(${m.variant})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Supplier *</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="">-- Choose Supplier --</option>
                {suppliersData?.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Received Date *</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
              </input>
            </div>
          </div>

          {/* Quick Row Defaults Bar */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Default Purchase Cost (PKR):</span>
              <input
                type="number"
                value={defaultCost}
                onChange={(e) => setDefaultCost(Number(e.target.value))}
                className="w-32 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none"
              />
              <button
                type="button"
                onClick={applyDefaultCostToAll}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Apply to all rows
              </button>
            </div>

            {selectedModel && selectedModel.colorOptions.length > 0 && (
              <div className="text-slate-500 text-[11px]">
                Available Model Colors:{" "}
                <span className="font-semibold text-slate-700">
                  {selectedModel.colorOptions.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Individual Unit Rows */}
        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                2. Scooty Units ({unitsList.length})
              </h2>
              <p className="text-xs text-slate-400">Fill in chassis, motor, and battery serial numbers.</p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Unit</span>
            </button>
          </div>

          <div className="space-y-3">
            {unitsList.map((unit, idx) => (
              <div
                key={idx}
                className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 relative space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Unit #{idx + 1}</span>
                  {unitsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-0.5">
                      Chassis No. *
                    </label>
                    <input
                      type="text"
                      value={unit.chassisNumber}
                      onChange={(e) => updateRow(idx, "chassisNumber", e.target.value.toUpperCase())}
                      placeholder="YAD-2026-XXXX"
                      required
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-0.5">
                      Motor No. *
                    </label>
                    <input
                      type="text"
                      value={unit.motorNumber}
                      onChange={(e) => updateRow(idx, "motorNumber", e.target.value.toUpperCase())}
                      placeholder="MOT-72V-XXXX"
                      required
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-0.5">
                      Battery Serial(s) *
                    </label>
                    <input
                      type="text"
                      value={unit.batterySerialNumbers}
                      onChange={(e) => updateRow(idx, "batterySerialNumbers", e.target.value)}
                      placeholder="BAT-7232-XXX"
                      required
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-0.5">
                      Color *
                    </label>
                    {selectedModel && selectedModel.colorOptions.length > 0 ? (
                      <select
                        value={unit.color}
                        onChange={(e) => updateRow(idx, "color", e.target.value)}
                        required
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500"
                      >
                        <option value="">-- Select Color --</option>
                        {selectedModel.colorOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={unit.color}
                        onChange={(e) => updateRow(idx, "color", e.target.value)}
                        placeholder="e.g. Matte Grey"
                        required
                        className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-0.5">
                      Cost (PKR) *
                    </label>
                    <input
                      type="number"
                      value={unit.purchaseCost}
                      onChange={(e) => updateRow(idx, "purchaseCost", Number(e.target.value))}
                      required
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-semibold focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={addRow}
              className="w-full py-2.5 border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50/40 text-slate-600 hover:text-brand-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Unit Row</span>
            </button>
          </div>
        </div>

        {/* Total Summary and Submit Button */}
        <div className="bg-slate-900 text-white p-4 md:p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="text-xs text-slate-400">Batch Summary</div>
            <div className="text-lg font-bold">
              {unitsList.length} Units • {formatPKR(totalBatchCost)}
            </div>
            <div className="text-[11px] text-slate-400">
              Will automatically record a purchase of {formatPKR(totalBatchCost)} in supplier ledger.
            </div>
          </div>

          <button
            type="submit"
            disabled={stockInMutation.isPending}
            className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all active:scale-[0.98]"
          >
            {stockInMutation.isPending ? "Stocking In..." : `Confirm Stock-In (${unitsList.length} Units)`}
          </button>
        </div>
      </form>
    </div>
  );
}
