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
  Send,
  School,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { usePlatformSettings } from "@/contexts/PlatformSettingsContext";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Users", href: "/dashboard/users", icon: Users },
  { name: "Groups", href: "/dashboard/groups", icon: UsersRound },
  { name: "Institutions", href: "/dashboard/institutional-verification", icon: School, badge: true },
  { name: "Moderation", href: "/dashboard/moderation", icon: ShieldAlert, badge: true },
  { name: "Audit Logs", href: "/dashboard/audit-logs", icon: FileText },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Errors", href: "/dashboard/errors", icon: Bug, badge: true },
  { name: "Security", href: "/dashboard/security", icon: Lock },
  { name: "Notifications", href: "/dashboard/notifications", icon: Send },
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
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();
  const { settings } = usePlatformSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [stats, setStats] = useState({ pendingReports: 0, unresolvedErrors: 0, pendingInstitutions: 0 });
  const [notificationStats, setNotificationStats] = useState<any>({
    unread: 0,
    recent: [],
  });

  // Wait for auth store to rehydrate before checking authentication
  useEffect(() => {
    // Don't check auth while still loading from localStorage
    if (isLoading) return;
    
    // Check if we have a valid token in localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    
    if (!isAuthenticated || !token) {
      router.push("/auth/login");
      return;
    }

    // Fetch badge counts
    const fetchStats = async () => {
      try {
        const [dashboard, settings, notifications] = await Promise.all([
          api.getDashboard(),
          api.getSettings(),
          api.getAdminNotificationStats(),
        ]);
        
        // Fetch pending institutions count separately
        let institutionsCount = 0;
        try {
          const token = localStorage.getItem('admin_token');
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/database/query?table=institution_verification_requests&status=eq.pending&select=count`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          if (response.ok) {
            const data = await response.json();
            institutionsCount = data?.length || 0;
          }
        } catch (error) {
          console.error('Failed to fetch institutions count:', error);
        }
        
        setStats({
          pendingReports: dashboard.pendingReports || 0,
          unresolvedErrors: dashboard.unresolvedErrors || 0,
          pendingInstitutions: institutionsCount,
        });
        setNotificationStats({
          unread: notifications?.unread || 0,
          recent: notifications?.recent || [],
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        // If API calls fail with 401, redirect to login
        if ((error as any)?.response?.status === 401) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_refresh_token');
          router.push("/auth/login");
        }
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [isAuthenticated, isLoading, router]);

  const handleLogout = async () => {
    await api.logout();
    logout();
    router.push("/auth/login");
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold truncate">{settings.platform_name || "OnCampus"} Admin</h1>
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
                  : item.name === "Institutions"
                  ? stats.pendingInstitutions
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((open) => !open)}
                className="relative text-gray-400 hover:text-gray-600"
                aria-label="Open notifications"
              >
                <Bell className="w-6 h-6" />
                {notificationStats.unread > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">
                    {notificationStats.unread > 99 ? "99+" : notificationStats.unread}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 top-9 z-50 w-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Notifications</p>
                      <p className="text-xs text-gray-500">{notificationStats.unread} unread user notifications</p>
                    </div>
                    <Link
                      href="/dashboard/notifications"
                      onClick={() => setNotificationOpen(false)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Manage
                    </Link>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notificationStats.recent.length > 0 ? (
                      notificationStats.recent.map((item: any) => (
                        <div key={item.id} className="border-b border-gray-100 px-4 py-3 last:border-b-0">
                          <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.body}</p>
                          <p className="mt-2 text-[11px] text-gray-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500">
                        No notifications yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
