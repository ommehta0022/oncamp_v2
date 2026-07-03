"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users,
  UsersRound,
  MessageSquare,
  TrendingUp,
  Activity,
  MapPin,
  Building2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

export default function AnalyticsPage() {
  const { data: overview } = useQuery({
    queryKey: ["admin-analytics-overview"],
    queryFn: () => api.getAnalyticsOverview(),
  });

  const { data: growth } = useQuery({
    queryKey: ["admin-growth-metrics"],
    queryFn: () => api.getGrowthMetrics(30),
  });

  const { data: cities } = useQuery({
    queryKey: ["admin-city-metrics"],
    queryFn: () => api.getCityMetrics(),
  });

  const { data: institutions } = useQuery({
    queryKey: ["admin-institution-metrics"],
    queryFn: () => api.getInstitutionMetrics(),
  });

  const growthRows = Array.isArray(growth) ? growth : growth?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Comprehensive insights and platform metrics
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.users?.total?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{overview?.users?.growth || 0}% from last month
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.users?.active?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {((overview?.users?.active / overview?.users?.total) * 100 || 0).toFixed(1)}% of total
              </p>
            </div>
            <Activity className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Groups</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.groups?.total?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-green-600 mt-1">
                +{overview?.groups?.growth || 0}% from last month
              </p>
            </div>
            <UsersRound className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.engagement?.messages?.toLocaleString() || 0}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {overview?.engagement?.posts?.toLocaleString() || 0} posts
              </p>
            </div>
            <MessageSquare className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          30-Day Growth Trends
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={growthRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#3B82F6"
              strokeWidth={2}
              name="New Users"
            />
            <Line
              type="monotone"
              dataKey="groups"
              stroke="#10B981"
              strokeWidth={2}
              name="New Groups"
            />
            <Line
              type="monotone"
              dataKey="messages"
              stroke="#F59E0B"
              strokeWidth={2}
              name="Messages"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* City Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-blue-500" />
            Top Cities by Users
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cities || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="city" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="users" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-purple-500" />
            Top Institutions
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={institutions || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="users"
              >
                {(institutions || []).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Engagement Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Post Comments</p>
            <p className="text-2xl font-bold text-gray-900">
              {overview?.engagement?.comments?.toLocaleString() || 0}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Messages per User</p>
            <p className="text-2xl font-bold text-gray-900">
              {(
                (overview?.engagement?.messages || 0) /
                (overview?.users?.total || 1)
              ).toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Groups per User</p>
            <p className="text-2xl font-bold text-gray-900">
              {(
                (overview?.groups?.total || 0) / (overview?.users?.total || 1)
              ).toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-500" />
          Real-time Activity (Last Hour)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Active Users</p>
            <p className="text-3xl font-bold text-blue-600">
              {overview?.users?.active || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Messages Sent</p>
            <p className="text-3xl font-bold text-green-600">
              {overview?.engagement?.messagesLastHour?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">New Groups</p>
            <p className="text-3xl font-bold text-purple-600">
              {overview?.engagement?.newGroupsLastHour?.toLocaleString() || 0}
            </p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600">New Users</p>
            <p className="text-3xl font-bold text-orange-600">
              {overview?.engagement?.newUsersLastHour?.toLocaleString() || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
