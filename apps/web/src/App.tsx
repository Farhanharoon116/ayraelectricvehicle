import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30, // 30s
    },
  },
});

function LoginPlaceholder() {
  const { login, user } = useAuth();
  const [email, setEmail] = React.useState("owner@aevmotors.pk");
  const [password, setPassword] = React.useState("password123");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (user) {
    return <Navigate to="/" replace />;
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
              className="w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-medium text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm"
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

function DashboardPlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="font-black text-brand-600 text-lg">AEV</span>
          <span className="font-semibold text-slate-800">Showroom System</span>
        </div>
        <div className="flex items-center space-x-3 text-sm">
          <span className="text-slate-600">
            {user?.fullName} ({user?.role})
          </span>
          <button
            onClick={logout}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-4 flex-1 max-w-4xl mx-auto w-full">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-4">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Welcome to AEV Management System</h2>
          <p className="text-slate-600 text-sm">Phase 0 Scaffold Active. Cloudflare Workers + D1 + R2 + PWA.</p>
        </div>
      </main>
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
            <Route path="/login" element={<LoginPlaceholder />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardPlaceholder />
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
