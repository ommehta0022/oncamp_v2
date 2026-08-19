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
  growth: { users: number; groups: number; messages: number };
}

interface GrowthData {
  date: string;
  users: number;
  groups: number;
  messages: number;
}

const EMPTY_STATS: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalGroups: 0,
  pendingReports: 0,
  unresolvedErrors: 0,
  messages24h: 0,
  newUsersThisWeek: 0,
  growth: { users: 0, groups: 0, messages: 0 },
};

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStats(raw: any): DashboardStats {
  return {
    totalUsers: safeNumber(raw?.totalUsers),
    activeUsers: safeNumber(raw?.activeUsers),
    totalGroups: safeNumber(raw?.totalGroups),
    pendingReports: safeNumber(raw?.pendingReports),
    unresolvedErrors: safeNumber(raw?.unresolvedErrors),
    messages24h: safeNumber(raw?.messages24h),
    newUsersThisWeek: safeNumber(raw?.newUsersThisWeek),
    growth: {
      users: safeNumber(raw?.growth?.users),
      groups: safeNumber(raw?.growth?.groups),
      messages: safeNumber(raw?.growth?.messages),
    },
  };
}

function normalizeGrowth(raw: any): GrowthData[] {
  const source = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  return source.map((item: any) => ({
    date: String(item?.date || ""),
    users: safeNumber(item?.users),
    groups: safeNumber(item?.groups),
    messages: safeNumber(item?.messages),
  }));
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const results = await Promise.allSettled([
        api.getDashboard(),
        api.getGrowthMetrics(30),
        api.getSystemStatus(),
      ]);

      const dashboard = results[0].status === "fulfilled" ? results[0].value : null;
      const growth = results[1].status === "fulfilled" ? results[1].value : [];
      const system = results[2].status === "fulfilled" ? results[2].value : {};

      setStats(normalizeStats(dashboard));
      setGrowthData(normalizeGrowth(growth));
      setSystemStatus(system && typeof system === "object" ? system : {});

      if (results.every((result) => result.status === "rejected")) {
        setLoadError("Dashboard data is temporarily unavailable. Please retry.");
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setStats(EMPTY_STATS);
      setGrowthData([]);
      setSystemStatus({});
      setLoadError("Dashboard data is temporarily unavailable. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
  }, []);

  const handleClearCache = async () => {
    if (!confirm("Are you sure you want to clear the cache? This will temporarily slow down the system.")) return;
    try {
      setActionLoading("cache");
      await api.clearCache();
      alert("Cache cleared successfully.");
    } catch (error: any) {
      alert(`Failed to clear cache: ${error?.response?.data?.detail || error?.message || "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportData = async () => {
    try {
      setActionLoading("export");
      const [users, groups, reports, errors, auditLogs] = await Promise.all([
        api.getUsers({ limit: 1000 }),
        api.getGroups({ limit: 1000 }),
        api.getReports({ limit: 1000 }),
        api.getErrors({ limit: 1000 }),
        api.getAuditLogs({ limit: 1000 }),
      ]);
      const exportData = {
        exportedAt: new Date().toISOString(),
        stats,
        users: users?.data || users || [],
        groups: groups?.data || groups || [],
        reports: reports?.data || reports || [],
        errors: errors?.data || errors || [],
        auditLogs: auditLogs?.data || auditLogs || [],
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oncampus-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Failed to export data: ${error?.response?.data?.detail || error?.message || "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, change: stats.growth.users, color: "bg-blue-500" },
    { title: "Active Users (24h)", value: stats.activeUsers, icon: UserCheck, change: null, color: "bg-green-500" },
    { title: "Total Groups", value: stats.totalGroups, icon: UsersRound, change: stats.growth.groups, color: "bg-purple-500" },
    { title: "Messages (24h)", value: stats.messages24h, icon: MessageSquare, change: stats.growth.messages, color: "bg-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Platform overview and key metrics</p>
        </div>
        {loadError && (
          <button onClick={() => void fetchDashboardData()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Retry
          </button>
        )}
      </div>

      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const change = stat.change;
          const up = change === null || change >= 0;
          const TrendIcon = up ? TrendingUp : TrendingDown;
          return (
            <div key={stat.title} className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div className={`${stat.color} rounded-lg p-3`}><Icon className="h-6 w-6 text-white" /></div>
                {change !== null && (
                  <div className={`flex items-center space-x-1 text-sm font-medium ${up ? "text-green-600" : "text-red-600"}`}>
                    <TrendIcon className="h-4 w-4" />
                    <span>{Math.abs(safeNumber(change))}%</span>
                  </div>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900">{safeNumber(stat.value).toLocaleString()}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.title}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-gray-900">Growth Overview</h2><p className="mt-1 text-sm text-gray-500">Last 30 days</p></div>
          <div className="text-sm text-gray-500">{growthData.length ? `${growthData.length} data points` : "No growth data available"}</div>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">System Health</h2>
          <div className="space-y-4 text-sm">
            <HealthRow label="API Status" value={String(systemStatus?.status || "Unavailable")} />
            <HealthRow label="Database" value={String(systemStatus?.database || "Unavailable")} />
            <HealthRow label="Backend Version" value={String(systemStatus?.version || "Unknown")} />
            <HealthRow label="Unresolved Errors" value={String(stats.unresolvedErrors)} />
            <HealthRow label="Active Users (24h)" value={`${stats.activeUsers} active`} />
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionButton onClick={() => router.push("/dashboard/moderation")} icon={<FileText className="h-4 w-4" />} label="Review Reports" />
            <ActionButton onClick={() => router.push("/dashboard/errors")} icon={<AlertCircle className="h-4 w-4" />} label="View Errors" />
            <ActionButton onClick={() => void handleClearCache()} disabled={actionLoading === "cache"} icon={<Trash2 className="h-4 w-4" />} label={actionLoading === "cache" ? "Clearing..." : "Clear Cache"} />
            <ActionButton onClick={() => void handleExportData()} disabled={actionLoading === "export"} icon={<Download className="h-4 w-4" />} label={actionLoading === "export" ? "Exporting..." : "Export Data"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-gray-600">{label}</span><span className="font-medium text-gray-900">{value}</span></div>;
}

function ActionButton({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">{icon}{label}</button>;
}
