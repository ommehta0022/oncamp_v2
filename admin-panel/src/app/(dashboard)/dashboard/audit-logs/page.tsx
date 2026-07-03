"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  FileText,
  User,
  Users,
  Shield,
  Lock,
  Settings,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle,
  Database,
  Search,
  Download,
} from "lucide-react";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [adminFilter, setAdminFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", page, adminFilter, actionFilter, startDate, endDate],
    queryFn: () =>
      api.getAuditLogs({
        page,
        limit: 50,
        admin: adminFilter || undefined,
        action: actionFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const getActionIcon = (action: string) => {
    if (action.includes("USER")) return <User className="w-5 h-5 text-blue-500" />;
    if (action.includes("GROUP")) return <Users className="w-5 h-5 text-purple-500" />;
    if (action.includes("BAN") || action.includes("MUTE"))
      return <Shield className="w-5 h-5 text-red-500" />;
    if (action.includes("AUTH")) return <Lock className="w-5 h-5 text-green-500" />;
    if (action.includes("SETTINGS")) return <Settings className="w-5 h-5 text-gray-500" />;
    if (action.includes("DELETE")) return <Trash2 className="w-5 h-5 text-red-500" />;
    if (action.includes("UPDATE")) return <Edit2 className="w-5 h-5 text-orange-500" />;
    if (action.includes("DB")) return <Database className="w-5 h-5 text-indigo-500" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes("DELETE") || action.includes("BAN"))
      return "bg-red-100 text-red-800";
    if (action.includes("CREATE") || action.includes("VERIFY"))
      return "bg-green-100 text-green-800";
    if (action.includes("UPDATE") || action.includes("MUTE"))
      return "bg-orange-100 text-orange-800";
    if (action.includes("AUTH")) return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  };

  const exportLogs = () => {
    const logs = data?.data || [];
    const headers = ["id", "action", "admin_id", "admin_email", "target_type", "target_id", "details", "ip_address", "created_at"];
    const rows = logs.map((log: any) =>
      headers.map((header) => JSON.stringify(log[header] ?? "")).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-logs-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Track all admin actions and system changes
          </p>
        </div>
        <button
          onClick={exportLogs}
          disabled={!data?.data?.length}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          <span>Export Logs</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Actions Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.data?.filter(
                  (log: any) =>
                    new Date(log.created_at).toDateString() === new Date().toDateString()
                ).length || 0}
              </p>
            </div>
            <FileText className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">User Actions</p>
              <p className="text-2xl font-bold text-blue-600">
                {data?.data?.filter((log: any) => log.action?.includes("USER")).length || 0}
              </p>
            </div>
            <User className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Security Actions</p>
              <p className="text-2xl font-bold text-red-600">
                {data?.data?.filter(
                  (log: any) =>
                    log.action?.includes("BAN") || log.action?.includes("MUTE")
                ).length || 0}
              </p>
            </div>
            <Shield className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">DB Operations</p>
              <p className="text-2xl font-bold text-indigo-600">
                {data?.data?.filter((log: any) => log.action?.includes("DB")).length || 0}
              </p>
            </div>
            <Database className="w-10 h-10 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input
            type="text"
            placeholder="Filter by admin ID"
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="AUTH">Authentication</option>
            <option value="USER">User Management</option>
            <option value="GROUP">Group Management</option>
            <option value="BAN">Bans</option>
            <option value="MUTE">Mutes</option>
            <option value="DELETE">Deletions</option>
            <option value="DB">Database</option>
            <option value="SETTINGS">Settings</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={() => {
              setAdminFilter("");
              setActionFilter("");
              setStartDate("");
              setEndDate("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Target
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Loading audit logs...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              data?.data?.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      {getActionIcon(log.action)}
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {log.admin_email || "System"}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {log.admin_id?.substring(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.target_type || "N/A"}
                    </div>
                    {log.target_id && (
                      <div className="text-sm text-gray-500">
                        {log.target_id.substring(0, 8)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-md truncate">
                      {log.details || "No details"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ip_address || "N/A"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.meta && data.meta.total > 50 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Showing page {page} of {Math.ceil(data.meta.total / 50)} ({data.meta.total} total logs)
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.meta.total / 50)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Critical Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
          Recent Critical Actions
        </h3>
        <div className="space-y-3">
          {data?.data
            ?.filter(
              (log: any) =>
                log.action?.includes("DELETE") ||
                log.action?.includes("BAN") ||
                log.action?.includes("DB")
            )
            .slice(0, 5)
            .map((log: any) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.action} by {log.admin_email || "System"}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            )) || (
            <p className="text-center text-gray-500 py-4">
              No critical actions recorded recently
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
