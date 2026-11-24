import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { InventoryPage } from "./pages/InventoryPage";
import { StockInPage } from "./pages/StockInPage";
import { CatalogPage } from "./pages/CatalogPage";
import { SuppliersPage } from "./pages/SuppliersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { SalesPage } from "./pages/SalesPage";
import { NewSalePage } from "./pages/NewSalePage";
import { InvoicePrintPage } from "./pages/InvoicePrintPage";
import { SaleDetailPage } from "./pages/SaleDetailPage";
import { InstallmentAgreementPage } from "./pages/InstallmentAgreementPage";
import { PaymentReceiptPage } from "./pages/PaymentReceiptPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { ExpensesPage } from "./pages/ExpensesPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30s
    },
  },
});

function LoginView() {
  const { login, user } = useAuth();
  const [email, setEmail] = React.useState("owner@aevmotors.pk");
  const [password, setPassword] = React.useState("password123");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (user) {
    return <Navigate to="/inventory" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white mb-2 font-black text-xl">
            AEV
          </div>
          <h1 className="text-2xl font-bold">AEV Motors Pakistan</h1>
          <p className="text-sm text-slate-400">Showroom Management System</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm text-white"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="sales" element={<SalesPage />} />
              <Route path="sales/new" element={<NewSalePage />} />
              <Route path="sales/:id" element={<SaleDetailPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="stock-in" element={<StockInPage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route
              path="/invoices/:saleId"
              element={
                <ProtectedRoute>
                  <InvoicePrintPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agreements/:saleId"
              element={
                <ProtectedRoute>
                  <InstallmentAgreementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receipts/:paymentId"
              element={
                <ProtectedRoute>
                  <PaymentReceiptPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
