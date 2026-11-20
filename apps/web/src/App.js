import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
        return _jsx(Navigate, { to: "/", replace: true });
    }
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
        }
        catch (err) {
            setError(err.message || "Failed to log in");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4", children: _jsxs("div", { className: "max-w-md w-full bg-slate-800 text-white rounded-2xl p-6 shadow-xl border border-slate-700", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("div", { className: "inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 text-white mb-2 font-black text-xl", children: "AEV" }), _jsx("h1", { className: "text-2xl font-bold", children: "AEV Motors Pakistan" }), _jsx("p", { className: "text-sm text-slate-400", children: "Showroom Management System" })] }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs uppercase font-medium text-slate-400 mb-1", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs uppercase font-medium text-slate-400 mb-1", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full px-3 py-2.5 bg-slate-700 rounded-lg border border-slate-600 focus:outline-none focus:border-brand-500 text-sm", required: true })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm", children: loading ? "Signing in..." : "Sign In" })] })] }) }));
}
function DashboardPlaceholder() {
    const { user, logout } = useAuth();
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 flex flex-col", children: [_jsxs("header", { className: "bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "font-black text-brand-600 text-lg", children: "AEV" }), _jsx("span", { className: "font-semibold text-slate-800", children: "Showroom System" })] }), _jsxs("div", { className: "flex items-center space-x-3 text-sm", children: [_jsxs("span", { className: "text-slate-600", children: [user?.fullName, " (", user?.role, ")"] }), _jsx("button", { onClick: logout, className: "px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium", children: "Logout" })] })] }), _jsx("main", { className: "p-4 flex-1 max-w-4xl mx-auto w-full", children: _jsxs("div", { className: "bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-4", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900 mb-1", children: "Welcome to AEV Management System" }), _jsx("p", { className: "text-slate-600 text-sm", children: "Phase 0 Scaffold Active. Cloudflare Workers + D1 + R2 + PWA." })] }) })] }));
}
function ProtectedRoute({ children }) {
    const { user, isLoading } = useAuth();
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-slate-50", children: _jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" }) }));
    }
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
export function App() {
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(AuthProvider, { children: _jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPlaceholder, {}) }), _jsx(Route, { path: "/*", element: _jsx(ProtectedRoute, { children: _jsx(DashboardPlaceholder, {}) }) })] }) }) }) }));
}
export default App;
