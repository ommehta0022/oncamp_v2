"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Users,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  Globe,
  Lock,
  AlertTriangle,
  Download,
} from "lucide-react";
import Link from "next/link";

interface DeleteGroupModal {
  open: boolean;
  group: any | null;
  confirmText: string;
  deleting: boolean;
  error: string | null;
}

export default function GroupsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<DeleteGroupModal>({
    open: false,
    group: null,
    confirmText: "",
    deleting: false,
    error: null,
  });

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
      closeDeleteModal();
    },
    onError: (err: any) => {
      setDeleteModal((prev) => ({
        ...prev,
        deleting: false,
        error: err?.response?.data?.detail || "Failed to delete group. Please try again.",
      }));
    },
  });

  const verifyGroupMutation = useMutation({
    mutationFn: (id: string) => api.verifyGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
  });

  const openDeleteModal = (group: any) => {
    setDeleteModal({ open: true, group, confirmText: "", deleting: false, error: null });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ open: false, group: null, confirmText: "", deleting: false, error: null });
  };

  const handleDeleteGroup = () => {
    if (!deleteModal.group) return;
    if (deleteModal.confirmText !== "DELETE") {
      setDeleteModal((prev) => ({ ...prev, error: 'Type "DELETE" exactly to confirm.' }));
      return;
    }
    setDeleteModal((prev) => ({ ...prev, deleting: true, error: null }));
    deleteGroupMutation.mutate({ id: deleteModal.group.id, reason: "Admin deletion" });
  };

  const exportGroups = () => {
    if (!data?.data) return;
    const headers = ["id", "name", "category", "visibility", "member_count", "city", "status"];
    const rows = data.data.map((group: any) =>
      headers.map((header) => JSON.stringify(group[header] ?? "")).join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `groups-all-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.group && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className="bg-red-50 px-6 py-4 flex items-center space-x-3 border-b border-red-100">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Delete Group</h3>
                <p className="text-sm text-red-600">This will mark the group as deleted.</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <p className="text-sm font-medium text-gray-700">Group to be deleted:</p>
                <p className="text-base font-bold text-gray-900">{deleteModal.group.name}</p>
                <p className="text-sm text-gray-500">Category: {deleteModal.group.category || "Uncategorized"}</p>
                <p className="text-sm text-gray-500">Members: {deleteModal.group.member_count || 0}</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> The group will be soft-deleted (marked as deleted in the database). All group data will remain but the group will be inaccessible to users.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteModal.confirmText}
                  onChange={(e) =>
                    setDeleteModal((prev) => ({ ...prev, confirmText: e.target.value, error: null }))
                  }
                  placeholder="Type DELETE"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleDeleteGroup()}
                  autoFocus
                />
                {deleteModal.error && (
                  <p className="mt-2 text-sm text-red-600">{deleteModal.error}</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex space-x-3 justify-end">
              <button
                onClick={closeDeleteModal}
                disabled={deleteModal.deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deleteModal.deleting || deleteModal.confirmText !== "DELETE"}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {deleteModal.deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Group</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups Management</h1>
          <p className="text-gray-600 mt-1">
            Manage all groups, verify official groups, and moderate content
          </p>
        </div>
        <button
          onClick={exportGroups}
          disabled={!data?.data || data.data.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
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
                {data?.data?.filter((g: any) => g.visibility === "public").length || 0}
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
                {data?.data?.filter((g: any) => g.visibility === "private").length || 0}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Group</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <Link
                        href={`/dashboard/groups/${group.id}`}
                        className="text-blue-600 hover:text-blue-900"
                        title="View group"
                      >
                        <Eye className="inline w-5 h-5" />
                      </Link>
                      {!group.is_official && (
                        <button
                          onClick={() => verifyGroupMutation.mutate(group.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Verify as official"
                        >
                          <CheckCircle className="inline w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => openDeleteModal(group)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Delete group"
                      >
                        <Trash2 className="inline w-5 h-5" />
                      </button>
                    </div>
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
