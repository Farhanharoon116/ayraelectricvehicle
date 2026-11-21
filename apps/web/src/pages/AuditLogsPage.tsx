import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { fetchApi } from "../lib/api";
import { formatPKTDateTime } from "@aev/shared";

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  userFullName?: string;
  userEmail?: string;
}

interface AuditLogResponse {
  logs: AuditLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 25;

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ["audit-logs", actionFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      return fetchApi(`/api/audit?${params.toString()}`);
    },
  });

  const getActionBadgeClass = (action: string) => {
    if (action.includes("VOID")) return "bg-rose-100 text-rose-800 border-rose-200";
    if (action.includes("CREATE") || action.includes("STOCK_IN")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (action.includes("PRICE") || action.includes("UPDATE")) return "bg-amber-100 text-amber-800 border-amber-200";
    if (action.includes("LOGIN")) return "bg-blue-100 text-blue-800 border-blue-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const renderDetails = (detailsStr?: string) => {
    if (!detailsStr) return <span className="text-slate-400 italic">No additional details</span>;
    try {
      const parsed = JSON.parse(detailsStr);
      return (
        <div className="font-mono text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700 max-w-md overflow-x-auto">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <span className="text-slate-500 font-semibold">{k}:</span>
              <span className="text-slate-900 font-medium">{String(v)}</span>
            </div>
          ))}
        </div>
      );
    } catch {
      return <span className="font-mono text-xs text-slate-600">{detailsStr}</span>;
    }
  };

  const totalPages = Math.ceil((data?.pagination.total || 0) / limit);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-brand-600" />
            Security & System Audit Logs
          </h1>
          <p className="text-xs text-slate-500">
            Immutable tracking of price edits, discounts, sales, voids, payments, inventory, and logins
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-700">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(0);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="">All Audited Actions</option>
            <option value="SALE_CREATED">SALE_CREATED</option>
            <option value="SALE_VOIDED">SALE_VOIDED</option>
            <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
            <option value="FINE_WAIVED">FINE_WAIVED</option>
            <option value="MODEL_PRICE_CHANGED">MODEL_PRICE_CHANGED</option>
            <option value="BATCH_STOCK_IN">BATCH_STOCK_IN</option>
            <option value="UNIT_STATUS_UPDATED">UNIT_STATUS_UPDATED</option>
            <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Showing {data?.logs.length || 0} of {data?.pagination.total || 0} records
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading audit history...</div>
        ) : data?.logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No audit logs matching this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (PKT)</th>
                  <th className="py-2.5 px-3">Actor / User</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Changes / Details</th>
                  <th className="py-2.5 px-3">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatPKTDateTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {log.userFullName ? (
                        <div>
                          <div className="font-bold text-slate-800">{log.userFullName}</div>
                          <div className="text-[10px] text-slate-400">{log.userEmail}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Event</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md border ${getActionBadgeClass(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-700 capitalize">{log.entityType}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">{log.entityId}</div>
                    </td>
                    <td className="py-2.5 px-3 py-1">{renderDetails(log.details)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 font-mono text-[10px]">
                      {log.ipAddress || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 font-semibold text-slate-700 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-slate-500 font-semibold">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 font-semibold text-slate-700 flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
