import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Building2,
  FileSpreadsheet,
  Percent,
  Users,
  Upload,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface ShowroomSettings {
  id: string;
  name: string;
  logoR2Key?: string;
  address: string;
  phoneNumbers: string;
  email?: string;
  invoicePrefix: string;
  receiptPrefix: string;
  invoiceFooterText?: string;
  defaultWarrantyTerms?: string;
  minDownPaymentType: "percentage" | "fixed";
  minDownPaymentValue: number;
  defaultMarkupType: "flat" | "percentage";
  defaultMarkupValue: number;
  allowedDurations: number[];
  lateFineEnabled: boolean;
  lateFineType: "fixed" | "percentage";
  lateFineAmount: number;
  lateFineGraceDays: number;
  guarantorEnabled: boolean;
}

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: "owner" | "staff";
  isActive: boolean;
  createdAt: number;
}

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  if (user?.role !== "owner") {
    return (
      <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Owner Access Required</h2>
        <p className="text-xs">Only the showroom owner can configure settings and manage staff accounts.</p>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"profile" | "invoice" | "installment" | "users">("profile");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Settings query
  const { data: settingsData, isLoading } = useQuery<{ settings: ShowroomSettings }>({
    queryKey: ["showroom-settings"],
    queryFn: () => fetchApi("/api/settings"),
  });

  // Users query
  const { data: usersData } = useQuery<{ users: UserItem[] }>({
    queryKey: ["showroom-users"],
    queryFn: () => fetchApi("/api/auth/users"),
  });

  // Form State
  const [form, setForm] = useState<ShowroomSettings | null>(null);

  useEffect(() => {
    if (settingsData?.settings) {
      setForm(settingsData.settings);
    }
  }, [settingsData]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showroom-settings"] });
      setSaveSuccess(true);
      setErrorMessage("");
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: any) => setErrorMessage(err.message || "Failed to update settings"),
  });

  // Logo Upload Mutation
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      queryClient.invalidateQueries({ queryKey: ["showroom-settings"] });
      setSaveSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // User creation state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [userModalError, setUserModalError] = useState("");

  const createUserMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/auth/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["showroom-users"] });
      setShowAddUserModal(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      setNewPhone("");
      setUserModalError("");
    },
    onError: (err: any) => setUserModalError(err.message || "Failed to create staff user"),
  });

  // Reset password state
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserItem | null>(null);
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetError, setResetError] = useState("");

  const resetPasswordMutation = useMutation({
    mutationFn: (payload: any) =>
      fetchApi("/api/auth/users/reset-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSelectedUserForReset(null);
      setResetNewPass("");
      setResetError("");
    },
    onError: (err: any) => setResetError(err.message || "Failed to reset password"),
  });

  if (isLoading || !form) {
    return <div className="p-8 text-center text-slate-400">Loading settings...</div>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const toggleDuration = (month: number) => {
    const current = form.allowedDurations || [3, 6, 9, 12];
    if (current.includes(month)) {
      if (current.length > 1) {
        setForm({ ...form, allowedDurations: current.filter((m) => m !== month) });
      }
    } else {
      setForm({ ...form, allowedDurations: [...current, month].sort((a, b) => a - b) });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-600" />
            Showroom Settings
          </h1>
          <p className="text-xs md:text-sm text-slate-500">
            Configure showroom branding, A4 invoice templates, installment policies, and staff accounts.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-fit text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "profile" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Profile & Logo</span>
        </button>
        <button
          onClick={() => setActiveTab("invoice")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "invoice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Invoice Customization</span>
        </button>
        <button
          onClick={() => setActiveTab("installment")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "installment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>Installment Rules</span>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "users" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Staff</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tab 1: Profile & Logo */}
        {activeTab === "profile" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Showroom Identity & Contacts
            </h2>

            {/* Logo Upload Box */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {form.logoR2Key ? (
                  <img
                    src={`/api/settings/file/${form.logoR2Key}`}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-800 text-xs">Showroom Logo</div>
                <p className="text-[11px] text-slate-500">
                  Used on printed A4 Invoices, Installment Agreements, and Receipts.
                </p>
                <label className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer shadow-sm">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingLogo ? "Uploading..." : "Upload New Logo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Showroom Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone Numbers *</label>
                <input
                  type="text"
                  value={form.phoneNumbers}
                  onChange={(e) => setForm({ ...form, phoneNumbers: e.target.value })}
                  placeholder="0300-1234567, 042-35789000"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Physical Address *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: A4 Invoice Customization */}
        {activeTab === "invoice" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              A4 Invoice & Document Customization
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl uppercase font-mono font-bold focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  e.g. Resulting format: <strong>{form.invoicePrefix}-2026-0001</strong>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt Prefix</label>
                <input
                  type="text"
                  value={form.receiptPrefix}
                  onChange={(e) => setForm({ ...form, receiptPrefix: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl uppercase font-mono font-bold focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  e.g. Resulting format: <strong>{form.receiptPrefix}-2026-0001</strong>
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Invoice Footer Note / Slogan</label>
                <input
                  type="text"
                  value={form.invoiceFooterText || ""}
                  onChange={(e) => setForm({ ...form, invoiceFooterText: e.target.value })}
                  placeholder="Thank you for choosing AEV Motors! Drive green, save fuel."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Default Warranty Terms (A4 Document)</label>
                <textarea
                  rows={3}
                  value={form.defaultWarrantyTerms || ""}
                  onChange={(e) => setForm({ ...form, defaultWarrantyTerms: e.target.value })}
                  placeholder="e.g. 1 Year Battery Warranty, 2 Years Motor Warranty. Physical damage or water submersion voids warranty."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Installment Rules */}
        {activeTab === "installment" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs sm:text-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Installment Policies & Profit Calculation
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Minimum Down Payment */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <label className="block font-bold text-slate-800">Minimum Down Payment</label>
                <div className="flex gap-2">
                  <select
                    value={form.minDownPaymentType}
                    onChange={(e) => setForm({ ...form, minDownPaymentType: e.target.value as any })}
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed PKR</option>
                  </select>
                  <input
                    type="number"
                    value={form.minDownPaymentValue}
                    onChange={(e) => setForm({ ...form, minDownPaymentValue: Number(e.target.value) })}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {form.minDownPaymentType === "percentage"
                    ? `Customers must pay at least ${form.minDownPaymentValue}% of the vehicle price up front.`
                    : `Customers must pay at least Rs ${form.minDownPaymentValue.toLocaleString()} up front.`}
                </p>
              </div>

              {/* Default Markup */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <label className="block font-bold text-slate-800">Installment Markup (Profit)</label>
                <div className="flex gap-2">
                  <select
                    value={form.defaultMarkupType}
                    onChange={(e) => setForm({ ...form, defaultMarkupType: e.target.value as any })}
                    className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (PKR)</option>
                  </select>
                  <input
                    type="number"
                    value={form.defaultMarkupValue}
                    onChange={(e) => setForm({ ...form, defaultMarkupValue: Number(e.target.value) })}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Default markup applied to financed balance. Can be overridden by the owner on each sale.
                </p>
              </div>

              {/* Allowed Durations */}
              <div className="sm:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <label className="block font-bold text-slate-800">Allowed Installment Durations (Months)</label>
                <div className="flex flex-wrap gap-2">
                  {[3, 6, 9, 12, 18, 24].map((month) => {
                    const isSelected = form.allowedDurations?.includes(month);
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => toggleDuration(month)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {month} Months
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Late Fines */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Late Fines</label>
                  <input
                    type="checkbox"
                    checked={form.lateFineEnabled}
                    onChange={(e) => setForm({ ...form, lateFineEnabled: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                </div>
                {form.lateFineEnabled && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Fixed fine per late month:</span>
                      <input
                        type="number"
                        value={form.lateFineAmount}
                        onChange={(e) => setForm({ ...form, lateFineAmount: Number(e.target.value) })}
                        className="w-28 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold"
                      />
                      <span className="text-xs font-medium">PKR</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Grace period:</span>
                      <input
                        type="number"
                        value={form.lateFineGraceDays}
                        onChange={(e) => setForm({ ...form, lateFineGraceDays: Number(e.target.value) })}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-xs font-semibold"
                      />
                      <span className="text-xs">days</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Guarantor Requirement */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Require Guarantor for Installments</label>
                  <input
                    type="checkbox"
                    checked={form.guarantorEnabled}
                    onChange={(e) => setForm({ ...form, guarantorEnabled: e.target.checked })}
                    className="w-4 h-4 text-brand-600 rounded"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  When enabled, sale form requires guarantor name, CNIC, phone number, and address.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Users & Staff */}
        {activeTab === "users" && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Staff Accounts</h2>
                <p className="text-xs text-slate-400">
                  Staff can view inventory and record sales, but purchase costs and profits are hidden.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(true)}
                className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                + Add Staff Member
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {usersData?.users.map((u) => (
                <div
                  key={u.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{u.fullName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          u.role === "owner" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {u.email} {u.phone ? `• ${u.phone}` : ""}
                    </div>
                  </div>

                  {u.role === "staff" && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserForReset(u)}
                      className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Reset Password</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Save Button */}
        {activeTab !== "users" && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </form>

      {/* Add Staff User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Add Staff Account</h3>
            {userModalError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{userModalError}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createUserMutation.mutate({
                  email: newEmail.trim().toLowerCase(),
                  password: newPassword,
                  fullName: newFullName.trim(),
                  phone: newPhone.trim() || undefined,
                  role: "staff",
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Bilal Tariq"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="bilal@aevmotors.pk"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {createUserMutation.isPending ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {selectedUserForReset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Reset Password</h3>
              <p className="text-xs text-slate-500 font-semibold">{selectedUserForReset.fullName} ({selectedUserForReset.email})</p>
            </div>

            {resetError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded-lg">{resetError}</div>}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                resetPasswordMutation.mutate({
                  userId: selectedUserForReset.id,
                  newPassword: resetNewPass,
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <input
                  type="password"
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedUserForReset(null)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-sm disabled:opacity-50"
                >
                  {resetPasswordMutation.isPending ? "Saving..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
