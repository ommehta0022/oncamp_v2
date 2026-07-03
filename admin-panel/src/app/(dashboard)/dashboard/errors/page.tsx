"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  CheckCircle,
  Eye,
  XCircle,
} from "lucide-react";

export default function ErrorsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("");
  const [selectedError, setSelectedError] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-errors", page, level],
    queryFn: () =>
      api.getErrors({
        page,
        limit: 50,
        level: level || undefined,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.markErrorResolved(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-errors"] });
      setSelectedError(null);
    },
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
      case "critical":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-orange-100 text-orange-800";
      case "info":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
      case "critical":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case "info":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <Bug className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Error Tracking</h1>
        <p className="text-gray-600 mt-1">
          Monitor and resolve system errors and exceptions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {data?.data?.filter((e: any) => e.level === "critical" && e.status !== "resolved").length || 0}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-orange-600">
                {data?.data?.filter((e: any) => e.level === "error" && e.status !== "resolved").length || 0}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Warnings</p>
              <p className="text-2xl font-bold text-yellow-600">
                {data?.data?.filter((e: any) => e.level === "warning" && e.status !== "resolved").length || 0}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-green-600">
                {data?.data?.filter((e: any) => e.status === "resolved").length || 0}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <button
            onClick={() => setLevel("")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Errors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Error
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Occurrences
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Seen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading errors...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No errors found
                </td>
              </tr>
            ) : (
              data?.data?.map((error: any) => (
                <tr
                  key={error.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedError(error)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-start space-x-3">
                      {getLevelIcon(error.level)}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {error.message}
                        </div>
                        <div className="text-sm text-gray-500">
                          {error.endpoint || error.file || "Unknown location"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded uppercase ${getLevelColor(
                        error.level
                      )}`}
                    >
                      {error.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {error.user_id ? `User #${error.user_id.substring(0, 8)}` : "System"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {error.occurrences || 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(error.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        error.status === "resolved"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {error.status || "open"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {error.status !== "resolved" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          resolveMutation.mutate(error.id);
                        }}
                        className="text-green-600 hover:text-green-900"
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedError(error);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Eye className="inline w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.meta && data.meta.total > 50 && (
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
            <div className="text-sm text-gray-700">
              Showing page {page} of {Math.ceil(data.meta.total / 50)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(data.meta.total / 50)}
                className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Error Details
              </h3>
              <button
                onClick={() => setSelectedError(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Error Message
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedError.message}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Stack Trace
                </label>
                <pre className="mt-1 p-4 bg-gray-50 rounded text-xs text-gray-900 overflow-x-auto">
                  {selectedError.stack_trace || "No stack trace available"}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Level
                  </label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">
                    {selectedError.level}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">
                    {selectedError.status || "open"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Occurrences
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedError.occurrences || 1}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    First Seen
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedError.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {selectedError.status !== "resolved" && (
                <div className="flex justify-end">
                  <button
                    onClick={() => resolveMutation.mutate(selectedError.id)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Mark as Resolved
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
