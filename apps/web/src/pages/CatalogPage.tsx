import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layers,
  Plus,
  Edit2,
  Bike,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatPKR } from "@aev/shared";

interface BrandItem {
  id: string;
  name: string;
}

interface ModelItem {
  id: string;
  brandId: string;
  brandName: string;
  name: string;
  variant?: string;
  colorOptions: string[];
  batteryCapacity?: string;
  rangeKm?: number;
  defaultSellingPrice: number;
  inStockCount: number;
}

export function CatalogPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = user?.role === "owner";

  const [activeTab, setActiveTab] = useState<"models" | "brands">("models");
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelItem | null>(null);

  // Brand form state
  const [brandName, setBrandName] = useState("");
  const [brandError, setBrandError] = useState("");

  // Model form state
  const [modelBrandId, setModelBrandId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelVariant, setModelVariant] = useState("");
  const [modelBattery, setModelBattery] = useState("");
  const [modelRange, setModelRange] = useState<number | "">("");
  const [modelPrice, setModelPrice] = useState<number>(250000);
  const [colorInput, setColorInput] = useState("");
  const [colorsList, setColorsList] = useState<string[]>([]);
  const [modelError, setModelError] = useState("");

  // Queries
  const { data: brandsData } = useQuery<{ brands: BrandItem[] }>({
    queryKey: ["catalog-brands"],
    queryFn: () => fetchApi("/api/catalog/brands"),
  });

  const { data: modelsData } = useQuery<{ models: ModelItem[] }>({
    queryKey: ["catalog-models"],
    queryFn: () => fetchApi("/api/catalog/models"),
  });

  // Mutations
  const createBrandMutation = useMutation({
    mutationFn: (name: string) =>
      fetchApi("/api/catalog/brands", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-brands"] });
      setShowBrandModal(false);
      setBrandName("");
      setBrandError("");
    },
    onError: (err: any) => setBrandError(err.message || "Failed to create brand"),
  });

  const saveModelMutation = useMutation({
    mutationFn: (payload: any) => {
      if (editingModel) {
        return fetchApi(`/api/catalog/models/${editingModel.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return fetchApi("/api/catalog/models", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-models"] });
      setShowModelModal(false);
      resetModelForm();
    },
    onError: (err: any) => setModelError(err.message || "Failed to save model"),
  });

  const resetModelForm = () => {
    setEditingModel(null);
    setModelBrandId("");
    setModelName("");
    setModelVariant("");
    setModelBattery("");
    setModelRange("");
    setModelPrice(250000);
    setColorsList([]);
    setColorInput("");
    setModelError("");
  };

  const openEditModel = (model: ModelItem) => {
    setEditingModel(model);
    setModelBrandId(model.brandId);
    setModelName(model.name);
    setModelVariant(model.variant || "");
    setModelBattery(model.batteryCapacity || "");
    setModelRange(model.rangeKm || "");
    setModelPrice(model.defaultSellingPrice);
    setColorsList(model.colorOptions || []);
    setShowModelModal(true);
  };

  const addColorTag = () => {
    const trimmed = colorInput.trim();
    if (trimmed && !colorsList.includes(trimmed)) {
      setColorsList([...colorsList, trimmed]);
      setColorInput("");
    }
  };

  const removeColorTag = (c: string) => {
    setColorsList(colorsList.filter((item) => item !== c));
  };

  const handleSaveModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelBrandId) {
      setModelError("Please select a brand");
      return;
    }
    if (!modelName.trim()) {
      setModelError("Model name is required");
      return;
    }

    saveModelMutation.mutate({
      brandId: modelBrandId,
      name: modelName.trim(),
      variant: modelVariant.trim() || undefined,
      colorOptions: colorsList,
      batteryCapacity: modelBattery.trim() || undefined,
      rangeKm: modelRange ? Number(modelRange) : undefined,
      defaultSellingPrice: Math.round(Number(modelPrice)),
    });
  };

  const brands = brandsData?.brands || [];
  const models = modelsData?.models || [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-brand-600" />
            Catalog & Models
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Manage EV scooty brands, specifications, variants, and default retail prices.
          </p>
        </div>

        {isOwner && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowBrandModal(true)}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              + Add Brand
            </button>
            <button
              onClick={() => {
                resetModelForm();
                setShowModelModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Model</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab("models")}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === "models" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Scooty Models ({models.length})
        </button>
        <button
          onClick={() => setActiveTab("brands")}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === "brands" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Brands ({brands.length})
        </button>
      </div>

      {/* Models Tab */}
      {activeTab === "models" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {models.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                    {m.brandName}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{m.name}</h3>
                  {m.variant && <p className="text-xs text-slate-500">{m.variant}</p>}
                </div>
                {isOwner && (
                  <button
                    onClick={() => openEditModel(m)}
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                    title="Edit model"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Specs Badge */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-xl text-slate-600">
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 font-semibold">Battery</span>
                  <span className="font-medium text-slate-800">{m.batteryCapacity || "Standard"}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-400 font-semibold">Est. Range</span>
                  <span className="font-medium text-slate-800">{m.rangeKm ? `${m.rangeKm} km` : "N/A"}</span>
                </div>
              </div>

              {/* Colors */}
              {m.colorOptions.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {m.colorOptions.map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer / Price & In-stock */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Selling Price</span>
                  <span className="font-bold text-slate-900 text-sm">{formatPKR(m.defaultSellingPrice)}</span>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      m.inStockCount > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" />
                    <span>{m.inStockCount} In Stock</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Brands Tab */}
      {activeTab === "brands" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {brands.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
              >
                <span className="font-bold text-slate-900 text-sm">{b.name}</span>
                <span className="text-xs text-slate-400">
                  {models.filter((m) => m.brandId === b.id).length} Models
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brand Modal */}
      {showBrandModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add EV Brand</h3>
            {brandError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{brandError}</div>}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Name *</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Yadea, Metro, Crown"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBrandModal(false)}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createBrandMutation.isPending || !brandName.trim()}
                onClick={() => createBrandMutation.mutate(brandName)}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {createBrandMutation.isPending ? "Saving..." : "Save Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Add / Edit Modal */}
      {showModelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 my-8">
            <h3 className="font-bold text-slate-900 text-base">
              {editingModel ? "Edit Scooty Model" : "Add New Scooty Model"}
            </h3>

            {modelError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{modelError}</div>}

            <form onSubmit={handleSaveModel} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Brand *</label>
                <select
                  value={modelBrandId}
                  onChange={(e) => setModelBrandId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                >
                  <option value="">-- Choose Brand --</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Model Name *</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g. T9, E8S Pro, G5"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variant / Spec Note</label>
                <input
                  type="text"
                  value={modelVariant}
                  onChange={(e) => setModelVariant(e.target.value)}
                  placeholder="e.g. 72V 32Ah Graphene"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Battery Spec</label>
                  <input
                    type="text"
                    value={modelBattery}
                    onChange={(e) => setModelBattery(e.target.value)}
                    placeholder="e.g. 72V 32Ah"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Est. Range (km)</label>
                  <input
                    type="number"
                    value={modelRange}
                    onChange={(e) => setModelRange(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 90"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Default Selling Price (PKR) *</label>
                <input
                  type="number"
                  value={modelPrice}
                  onChange={(e) => setModelPrice(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none"
                />
              </div>

              {/* Color Options Chips */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Color Options</label>
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    value={colorInput}
                    onChange={(e) => setColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addColorTag();
                      }
                    }}
                    placeholder="Type color & click add"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addColorTag}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 min-h-6">
                  {colorsList.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => removeColorTag(c)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveModelMutation.isPending}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {saveModelMutation.isPending ? "Saving..." : "Save Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
