"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  Users,
  UserCheck,
  UsersRound,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertCircle,
  Trash2,
  Download,
  FileText,
} from "lucide-react";
import { Line, LineChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  pendingReports: number;
  unresolvedErrors: number;
  messages24h: number;
  newUsersThisWeek: number;
  growth: {
    users: number;
    groups: number;
    messages: number;
  };
}

interface GrowthData {
  date: string;
  users: number;
  groups: number;
  messages: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [dashboardData, growth, system] = await Promise.all([
          api.getDashboard(),
          api.getGrowthMetrics(30),
          api.getSystemStatus(),
        ]);
        setStats(dashboardData);
        setGrowthData(Array.isArray(growth) ? growth : growth.data || []);
        setSystemStatus(system);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Quick Action Handlers
  const handleReviewReports = () => {
    router.push("/dashboard/moderation");
  };

  const handleViewErrors = () => {
    router.push("/dashboard/errors");
  };

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear the cache? This will temporarily slow down the system.")) {
      return;
    }

    try {
      setActionLoading("cache");
      await api.clearCache();
      alert("✅ Cache cleared successfully!");
    } catch (error: any) {
      console.error("Clear cache error:", error);
      alert(`❌ Failed to clear cache: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportData = async () => {
    try {
      setActionLoading("export");
      
      // Gather all data
      const [users, groups, reports, errors, auditLogs] = await Promise.all([
        api.getUsers({ limit: 1000 }),
        api.getGroups({ limit: 1000 }),
        api.getReports({ limit: 1000 }),
        api.getErrors({ limit: 1000 }),
        api.getAuditLogs({ limit: 1000 }),
      ]);

      // Create export data
      const exportData = {
        exportedAt: new Date().toISOString(),
        stats: stats,
        users: users.data || users,
        groups: groups.data || groups,
        reports: reports.data || reports,
        errors: errors.data || errors,
        auditLogs: auditLogs.data || auditLogs,
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oncampus-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("✅ Data exported successfully!");
    } catch (error: any) {
      console.error("Export error:", error);
      alert(`❌ Failed to export data: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats?.totalUsers.toLocaleString() || "0",
      icon: Users,
      change: stats?.growth.users || 0,
      trend: (stats?.growth.users || 0) >= 0 ? "up" : "down",
      color: "bg-blue-500",
    },
    {
      title: "Active Users (24h)",
      value: stats?.activeUsers.toLocaleString() || "0",
      icon: UserCheck,
      change: null,
      color: "bg-green-500",
    },
    {
      title: "Total Groups",
      value: stats?.totalGroups.toLocaleString() || "0",
      icon: UsersRound,
      change: stats?.growth.groups || 0,
      trend: (stats?.growth.groups || 0) >= 0 ? "up" : "down",
      color: "bg-purple-500",
    },
    {
      title: "Messages (24h)",
      value: stats?.messages24h.toLocaleString() || "0",
      icon: MessageSquare,
      change: stats?.growth.messages || 0,
      trend: (stats?.growth.messages || 0) >= 0 ? "up" : "down",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;

          return (
            <div key={stat.title} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {stat.change !== null && (
                  <div
                    className={`flex items-center space-x-1 text-sm font-medium ${
                      stat.trend === "up" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    <TrendIcon className="w-4 h-4" />
                    <span>{Math.abs(stat.change)}%</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Growth Overview</h2>
            <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Users</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span>Groups</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>Messages</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" style={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="groups" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="messages" stroke="#f97316" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Status</span>
              <span className="text-sm font-medium text-green-600 capitalize">
                {systemStatus?.status || "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="text-sm font-medium text-green-600 capitalize">
                {systemStatus?.database || "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Backend Version</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.version || "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Unresolved Errors</span>
              <span className="text-sm font-medium text-red-600">
                {stats?.unresolvedErrors ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active Users (24h)</span>
              <span className="text-sm font-medium text-blue-600">
                {stats?.activeUsers || 0} active
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleReviewReports}
              className="px-4 py-3 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Review Reports
            </button>
            <button
              onClick={handleViewErrors}
              className="px-4 py-3 text-sm font-medium text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              View Errors
            </button>
            <button
              onClick={handleClearCache}
              disabled={actionLoading === "cache"}
              className="px-4 py-3 text-sm font-medium text-orange-600 border border-orange-600 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionLoading === "cache" ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Clear Cache
                </>
              )}
            </button>
            <button
              onClick={handleExportData}
              disabled={actionLoading === "export"}
              className="px-4 py-3 text-sm font-medium text-green-600 border border-green-600 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionLoading === "export" ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
