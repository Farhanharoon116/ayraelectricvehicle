import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import {
  Bike,
  PackagePlus,
  ShoppingCart,
  FileText,
  Users,
  Layers,
  Truck,
  Settings,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isOwner = user?.role === "owner";

  const navItems = [
    { name: "New Sale", path: "/sales/new", icon: ShoppingCart },
    { name: "Sales", path: "/sales", icon: FileText },
    { name: "Inventory", path: "/inventory", icon: Bike },
    { name: "Stock In", path: "/stock-in", icon: PackagePlus },
    { name: "Customers", path: "/customers", icon: Users },
    { name: "Catalog", path: "/catalog", icon: Layers },
    { name: "Suppliers", path: "/suppliers", icon: Truck },
    ...(isOwner ? [{ name: "Settings", path: "/settings", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-100 min-h-screen border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-black text-white text-base">
              AEV
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white leading-none">AEV Motors</div>
              <div className="text-[10px] text-slate-400">Showroom Management</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800">
          <div className="p-3 bg-slate-800/80 rounded-xl mb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{user?.fullName}</div>
                <div className="text-[10px] font-medium text-brand-400 uppercase tracking-wider">
                  {user?.role}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-white text-xs">
            AEV
          </div>
          <div className="font-bold text-sm tracking-tight">AEV Motors</div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-brand-400 capitalize">
            {user?.role}
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Menu (Secondary links) */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-800 text-slate-200 border-b border-slate-700 px-4 py-3 space-y-2">
          <div className="text-xs text-slate-400 pb-1 border-b border-slate-700">
            Signed in as <span className="text-white font-medium">{user?.fullName}</span>
          </div>
          {isOwner && (
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center space-x-2 py-2 text-sm text-slate-200 hover:text-brand-400"
            >
              <Settings className="w-4 h-4" />
              <span>Showroom Settings</span>
            </Link>
          )}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              logout();
            }}
            className="w-full flex items-center space-x-2 py-2 text-sm text-red-400"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb-friendly tap targets) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex items-center justify-around py-2 px-1 shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? "text-brand-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-brand-600 stroke-[2.5]" : "stroke-2"}`} />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
