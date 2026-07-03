"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Shield,
  Lock,
  AlertTriangle,
  Ban,
  Eye,
  Plus,
  Trash2,
  Settings,
} from "lucide-react";

export default function SecurityPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("alerts");
  const [newKeyword, setNewKeyword] = useState("");
  const [matchType, setMatchType] = useState("exact");
  const [rateLimitForm, setRateLimitForm] = useState({
    message_rate_limit_per_minute: 0,
    join_requests_per_hour: 0,
    otp_attempts_per_hour: 0,
    suspicious_activity_alerts_enabled: false,
  });

  const { data: alerts } = useQuery({
    queryKey: ["admin-security-alerts"],
    queryFn: () => api.getSecurityAlerts(),
  });

  const { data: failedLogins } = useQuery({
    queryKey: ["admin-failed-logins"],
    queryFn: () => api.getFailedLogins(),
  });

  const { data: keywords } = useQuery({
    queryKey: ["admin-blocked-keywords"],
    queryFn: () => api.getBlockedKeywords(),
  });

  const { data: rateLimits } = useQuery({
    queryKey: ["admin-rate-limits"],
    queryFn: () => api.getRateLimits(),
  });

  useEffect(() => {
    if (rateLimits && !Array.isArray(rateLimits)) {
      setRateLimitForm((current) => ({ ...current, ...rateLimits }));
    }
  }, [rateLimits]);

  const addKeywordMutation = useMutation({
    mutationFn: () => api.addBlockedKeyword(newKeyword, matchType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-keywords"] });
      setNewKeyword("");
    },
  });

  const deleteKeywordMutation = useMutation({
    mutationFn: (id: string) => api.deleteBlockedKeyword(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-blocked-keywords"] });
    },
  });

  const updateRateLimitsMutation = useMutation({
    mutationFn: () => api.updateRateLimits(rateLimitForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-rate-limits"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security & Safety</h1>
        <p className="text-gray-600 mt-1">
          Monitor security alerts, failed logins, and content moderation
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold text-red-600">
                {alerts?.filter((a: any) => a.status === "active").length || 0}
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed Logins (24h)</p>
              <p className="text-2xl font-bold text-orange-600">
                {failedLogins?.length || 0}
              </p>
            </div>
            <Lock className="w-10 h-10 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Blocked Keywords</p>
              <p className="text-2xl font-bold text-gray-900">
                {keywords?.length || 0}
              </p>
            </div>
            <Ban className="w-10 h-10 text-gray-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Status</p>
              <p className="text-lg font-semibold text-green-600">Secure</p>
            </div>
            <Shield className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 px-6">
            <button
              onClick={() => setActiveTab("alerts")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "alerts"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Security Alerts
            </button>
            <button
              onClick={() => setActiveTab("failed-logins")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "failed-logins"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Failed Logins
            </button>
            <button
              onClick={() => setActiveTab("keywords")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "keywords"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Blocked Keywords
            </button>
            <button
              onClick={() => setActiveTab("rate-limits")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "rate-limits"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Rate Limits
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Security Alerts Tab */}
          {activeTab === "alerts" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Security Alerts
              </h3>
              <div className="space-y-4">
                {alerts && alerts.length > 0 ? (
                  alerts.map((alert: any) => (
                    <div
                      key={alert.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="w-5 h-5 text-red-500 mt-1" />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {alert.title}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              {alert.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(alert.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            alert.severity === "critical"
                              ? "bg-red-100 text-red-800"
                              : alert.severity === "high"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No security alerts
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Failed Logins Tab */}
          {activeTab === "failed-logins" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Failed Login Attempts
              </h3>
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Email/Phone
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      IP Address
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Attempts
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Last Attempt
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {failedLogins && failedLogins.length > 0 ? (
                    failedLogins.map((login: any) => (
                      <tr key={login.id} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {login.email || login.phone || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {login.ip_address}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {login.attempts}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(login.last_attempt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button className="text-red-600 hover:text-red-900">
                            Block IP
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500"
                      >
                        No failed login attempts
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Blocked Keywords Tab */}
          {activeTab === "keywords" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Blocked Keywords
                </h3>
              </div>

              {/* Add Keyword Form */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Add New Blocked Keyword
                </h4>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="Enter keyword or phrase"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="exact">Exact Match</option>
                    <option value="contains">Contains</option>
                    <option value="starts_with">Starts With</option>
                    <option value="ends_with">Ends With</option>
                  </select>
                  <button
                    onClick={() => addKeywordMutation.mutate()}
                    disabled={!newKeyword.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Keywords List */}
              <div className="space-y-2">
                {keywords && keywords.length > 0 ? (
                  keywords.map((keyword: any) => (
                    <div
                      key={keyword.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <span className="font-medium text-gray-900">
                          {keyword.keyword}
                        </span>
                        <span className="ml-3 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                          {keyword.match_type}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteKeywordMutation.mutate(keyword.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No blocked keywords
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rate Limits Tab */}
          {activeTab === "rate-limits" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                API Rate Limits Configuration
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Messages per Minute
                    </label>
                    <input
                      type="number"
                      value={rateLimitForm.message_rate_limit_per_minute}
                      onChange={(event) =>
                        setRateLimitForm({
                          ...rateLimitForm,
                          message_rate_limit_per_minute: Number(event.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Join Requests per Hour
                    </label>
                    <input
                      type="number"
                      value={rateLimitForm.join_requests_per_hour}
                      onChange={(event) =>
                        setRateLimitForm({
                          ...rateLimitForm,
                          join_requests_per_hour: Number(event.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OTP Attempts per Hour
                    </label>
                    <input
                      type="number"
                      value={rateLimitForm.otp_attempts_per_hour}
                      onChange={(event) =>
                        setRateLimitForm({
                          ...rateLimitForm,
                          otp_attempts_per_hour: Number(event.target.value),
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Suspicious Activity Alerts
                    </label>
                    <label className="flex h-10 items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={rateLimitForm.suspicious_activity_alerts_enabled}
                        onChange={(event) =>
                          setRateLimitForm({
                            ...rateLimitForm,
                            suspicious_activity_alerts_enabled: event.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {rateLimitForm.suspicious_activity_alerts_enabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => updateRateLimitsMutation.mutate()}
                    disabled={updateRateLimitsMutation.isPending}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateRateLimitsMutation.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
