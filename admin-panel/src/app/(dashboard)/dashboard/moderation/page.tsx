"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  User,
  Users,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react";

export default function ModerationPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("pending");
  const [type, setType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", page, status, type],
    queryFn: () =>
      api.getReports({
        page,
        limit: 50,
        status: status || undefined,
        type: type || undefined,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: string;
      action: string;
      notes: string;
    }) => api.resolveReport(id, { action, notes, notifyReporter: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.dismissReport(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  const handleResolve = (reportId: string, reportedType: string) => {
    const action = prompt(
      `Action to take (ban_user, mute_user, delete_content, warn_user):`
    );
    if (!action) return;

    const notes = prompt("Resolution notes:");
    if (notes) {
      resolveMutation.mutate({ id: reportId, action, notes });
    }
  };

  const handleDismiss = (reportId: string) => {
    const reason = prompt("Reason for dismissal:");
    if (reason) {
      dismissMutation.mutate({ id: reportId, reason });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "user":
        return <User className="w-5 h-5" />;
      case "group":
        return <Users className="w-5 h-5" />;
      case "message":
        return <MessageSquare className="w-5 h-5" />;
      case "post":
        return <ImageIcon className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
        <p className="text-gray-600 mt-1">
          Review and resolve user reports and flagged content
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Reports</p>
              <p className="text-2xl font-bold text-orange-600">
                {data?.data?.filter((r: any) => r.status === "pending").length ||
                  0}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Resolved Today</p>
              <p className="text-2xl font-bold text-green-600">
                {data?.data?.filter(
                  (r: any) =>
                    r.status === "resolved" &&
                    new Date(r.resolved_at).toDateString() ===
                      new Date().toDateString()
                ).length || 0}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Dismissed</p>
              <p className="text-2xl font-bold text-gray-600">
                {data?.data?.filter((r: any) => r.status === "dismissed")
                  .length || 0}
              </p>
            </div>
            <XCircle className="w-10 h-10 text-gray-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.meta?.total || 0}
              </p>
            </div>
            <Eye className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="user">User</option>
            <option value="group">Group</option>
            <option value="message">Message</option>
            <option value="post">Post</option>
          </select>

          <button
            onClick={() => {
              setStatus("");
              setType("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Report
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reporter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
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
                  Loading reports...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No reports found
                </td>
              </tr>
            ) : (
              data?.data?.map((report: any) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      Report #{report.id.substring(0, 8)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {report.description?.substring(0, 50)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(report.reported_type)}
                      <span className="text-sm text-gray-900 capitalize">
                        {report.reported_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                      {report.reason}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    User #{report.reporter_id?.substring(0, 8)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        report.status === "pending"
                          ? "bg-orange-100 text-orange-800"
                          : report.status === "resolved"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {report.status === "pending" && (
                      <>
                        <button
                          onClick={() =>
                            handleResolve(report.id, report.reported_type)
                          }
                          className="text-green-600 hover:text-green-900"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleDismiss(report.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    <button className="text-blue-600 hover:text-blue-900">
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
    </div>
  );
}
