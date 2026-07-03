"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  ShieldAlert,
  FileText,
  BarChart3,
  Bug,
  Lock,
  Settings,
  Database,
  UserCog,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Groups", href: "/dashboard/groups", icon: UsersRound },
  { name: "Moderation", href: "/dashboard/moderation", icon: ShieldAlert, badge: true },
  { name: "Audit Logs", href: "/dashboard/audit-logs", icon: FileText },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Errors", href: "/dashboard/errors", icon: Bug, badge: true },
  { name: "Security", href: "/dashboard/security", icon: Lock },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const superAdminNav = [
  { name: "Database", href: "/dashboard/database", icon: Database },
  { name: "Admins", href: "/dashboard/admins", icon: UserCog },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ pendingReports: 0, unresolvedErrors: 0 });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    // Fetch badge counts
    const fetchStats = async () => {
      try {
        const dashboard = await api.getDashboard();
        setStats({
          pendingReports: dashboard.pendingReports || 0,
          unresolvedErrors: dashboard.unresolvedErrors || 0,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated, router]);

  const handleLogout = async () => {
    await api.logout();
    logout();
    router.push("/auth/login");
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
            <h1 className="text-xl font-bold">OnCampus Admin</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const badgeCount = item.badge
                ? item.name === "Moderation"
                  ? stats.pendingReports
                  : stats.unresolvedErrors
                : 0;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                  {badgeCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}

            {isSuperAdmin && (
              <>
                <div className="border-t border-gray-800 my-2" />
                <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase">
                  Super Admin
                </div>
                {superAdminNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-800 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || user?.email}
                </p>
                <p className="text-xs text-gray-400 capitalize">{user?.role?.replace("_", " ")}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-4 ml-auto">
            <button className="text-gray-400 hover:text-gray-600">
              <Bell className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
