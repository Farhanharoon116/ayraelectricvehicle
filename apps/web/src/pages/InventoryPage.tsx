import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bike,
  Search,
  Plus,
  MoreVertical,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatPKR } from "@aev/shared";

interface UnitItem {
  id: string;
  chassisNumber: string;
  motorNumber: string;
  batterySerialNumbers: string;
  color: string;
  purchaseCost?: number;
  status: "in_stock" | "sold" | "returned";
  receivedDate: number;
  soldAt?: number;
  modelId: string;
  modelName: string;
  variant?: string;
  defaultSellingPrice: number;
  brandId: string;
  brandName: string;
  supplierId: string;
  supplierName: string;
}

export function InventoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"in_stock" | "sold" | "returned">("in_stock");
  const [search, setSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [newStatus, setNewStatus] = useState<"in_stock" | "sold" | "returned">("in_stock");
  const [statusReason, setStatusReason] = useState("");

  const isOwner = user?.role === "owner";

  const { data, isLoading } = useQuery<{ units: UnitItem[] }>({
    queryKey: ["units", activeTab, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab) params.set("status", activeTab);
      if (search) params.set("search", search);
      return fetchApi(`/api/units?${params.toString()}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ unitId, status, reason }: { unitId: string; status: string; reason?: string }) =>
      fetchApi(`/api/units/${unitId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setSelectedUnit(null);
      setStatusReason("");
    },
  });

  const units = data?.units || [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bike className="w-6 h-6 text-brand-600" />
            Inventory Units
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Track individual electric scooties by chassis, motor, and battery serial.
          </p>
        </div>

        <Link
          to="/stock-in"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Stock In Scooties</span>
        </Link>
      </div>

      {/* Status Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab("in_stock")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all ${
              activeTab === "in_stock" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            In Stock
          </button>
          <button
            onClick={() => setActiveTab("sold")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all ${
              activeTab === "sold" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sold
          </button>
          <button
            onClick={() => setActiveTab("returned")}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg transition-all ${
              activeTab === "returned" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Returned
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chassis, motor, model, color..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
          />
        </div>
      </div>

      {/* Units List Cards / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <Bike className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-700">No units found</h3>
          <p className="text-xs text-slate-400">
            {search ? "Try adjusting your search criteria" : `No scooties currently marked as ${activeTab.replace("_", " ")}`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-shadow relative space-y-3"
            >
              {/* Unit Header */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white tracking-wider">
                      {unit.brandName}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{unit.modelName}</span>
                    {unit.variant && (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {unit.variant}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>Color: <strong className="text-slate-700">{unit.color}</strong></span>
                    <span>•</span>
                    <span>Supplier: <strong className="text-slate-700">{unit.supplierName}</strong></span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      unit.status === "in_stock"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : unit.status === "sold"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {unit.status.replace("_", " ")}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => {
                        setSelectedUnit(unit);
                        setNewStatus(unit.status);
                      }}
                      className="block mt-1 text-[11px] text-slate-400 hover:text-slate-700 ml-auto"
                      title="Update status"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Hardware Identifiers */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                <div>
                  <span className="block text-[10px] uppercase font-sans font-semibold text-slate-400">
                    Chassis No.
                  </span>
                  <span className="font-semibold text-slate-900 select-all">{unit.chassisNumber}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-sans font-semibold text-slate-400">
                    Motor No.
                  </span>
                  <span className="font-semibold text-slate-900 select-all">{unit.motorNumber}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[10px] uppercase font-sans font-semibold text-slate-400">
                    Battery Serial(s)
                  </span>
                  <span className="text-slate-700 select-all text-[11px]">{unit.batterySerialNumbers}</span>
                </div>
              </div>

              {/* Pricing & Financial Snapshot */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Selling Price</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatPKR(unit.defaultSellingPrice)}
                  </span>
                </div>

                {isOwner && unit.purchaseCost !== undefined && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-medium">Purchase Cost</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {formatPKR(unit.purchaseCost)}
                    </span>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      Est. Margin: {formatPKR(unit.defaultSellingPrice - unit.purchaseCost)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Owner Status Change Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Update Unit Status</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedUnit.chassisNumber}</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  <option value="in_stock">In Stock</option>
                  <option value="sold">Sold</option>
                  <option value="returned">Returned to Supplier</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Note (Optional)</label>
                <input
                  type="text"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Return due to battery fault"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    unitId: selectedUnit.id,
                    status: newStatus,
                    reason: statusReason,
                  })
                }
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
