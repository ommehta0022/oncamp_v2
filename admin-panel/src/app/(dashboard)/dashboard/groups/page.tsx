"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Globe,
  Lock,
  Building2,
} from "lucide-react";
import Link from "next/link";

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-groups", page, search, visibility, category, city],
    queryFn: () =>
      api.getGroups({
        page,
        limit: 50,
        search: search || undefined,
        visibility: visibility || undefined,
        category: category || undefined,
        city: city || undefined,
      }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.deleteGroup(id, reason, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });

  const verifyGroupMutation = useMutation({
    mutationFn: (id: string) => api.verifyGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });

  const handleDeleteGroup = (id: string) => {
    const reason = prompt("Enter reason for deletion:");
    if (reason) {
      deleteGroupMutation.mutate({ id, reason });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Groups Management</h1>
        <p className="text-gray-600 mt-1">
          Manage all groups, verify official groups, and moderate content
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Visibility</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="institution">Institution</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            <option value="academic">Academic</option>
            <option value="clubs">Clubs</option>
            <option value="sports">Sports</option>
            <option value="cultural">Cultural</option>
            <option value="technical">Technical</option>
            <option value="social">Social</option>
          </select>

          <input
            type="text"
            placeholder="Filter by city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={() => {
              setSearch("");
              setVisibility("");
              setCategory("");
              setCity("");
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Groups</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.meta?.total || 0}
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Public Groups</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.data?.filter((g: any) => g.visibility === "public")
                  .length || 0}
              </p>
            </div>
            <Globe className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Private Groups</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.data?.filter((g: any) => g.visibility === "private")
                  .length || 0}
              </p>
            </div>
            <Lock className="w-10 h-10 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Official Groups</p>
              <p className="text-2xl font-bold text-gray-900">
                {data?.data?.filter((g: any) => g.is_official).length || 0}
              </p>
            </div>
            <CheckCircle className="w-10 h-10 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Groups Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Group
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Visibility
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                City
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading groups...
                </td>
              </tr>
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No groups found
                </td>
              </tr>
            ) : (
              data?.data?.map((group: any) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {group.avatar_url ? (
                        <img
                          src={group.avatar_url}
                          alt={group.name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                          {group.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {group.name}
                          {group.is_official && (
                            <CheckCircle className="inline w-4 h-4 ml-1 text-blue-500" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {group.description?.substring(0, 50)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {group.category || "Uncategorized"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        group.visibility === "public"
                          ? "bg-green-100 text-green-800"
                          : group.visibility === "private"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {group.visibility}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {group.member_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {group.city || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        group.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {group.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <Link
                      href={`/dashboard/groups/${group.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Eye className="inline w-4 h-4" />
                    </Link>
                    {!group.is_official && (
                      <button
                        onClick={() => verifyGroupMutation.mutate(group.id)}
                        className="text-green-600 hover:text-green-900"
                        title="Verify as official"
                      >
                        <CheckCircle className="inline w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteGroup(group.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="inline w-4 h-4" />
                    </button>
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
              Showing page {page} of {Math.ceil(data.meta.total / 50)}
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
    </div>
  );
}
