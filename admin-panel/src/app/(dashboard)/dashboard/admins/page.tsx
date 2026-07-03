"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import {
  UserCog,
  Shield,
  Plus,
  Trash2,
  Crown,
  Key,
} from "lucide-react";

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    role: "admin",
    tempPassword: "",
  });

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: () => api.getAdmins(),
  });

  const createAdminMutation = useMutation({
    mutationFn: () => api.createAdmin(newAdmin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
      setShowCreateModal(false);
      setNewAdmin({ email: "", role: "admin", tempPassword: "" });
      alert("Admin created successfully! Temporary password has been generated.");
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
    },
  });

  const handleDeleteAdmin = (id: string, email: string) => {
    if (confirm(`Are you sure you want to remove admin access for ${email}?`)) {
      deleteAdminMutation.mutate(id);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewAdmin({ ...newAdmin, tempPassword: password });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Admin Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage admin users and their permissions (Super Admin Only)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Admins</p>
              <p className="text-2xl font-bold text-gray-900">
                {admins?.length || 0}
              </p>
            </div>
            <UserCog className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Super Admins</p>
              <p className="text-2xl font-bold text-purple-600">
                {admins?.filter((a: any) => a.role === "super_admin").length || 0}
              </p>
            </div>
            <Crown className="w-10 h-10 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Moderators</p>
              <p className="text-2xl font-bold text-green-600">
                {admins?.filter((a: any) => a.role === "moderator").length || 0}
              </p>
            </div>
            <Shield className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Admin Users</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Admin
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Login
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Loading admins...
                </td>
              </tr>
            ) : admins?.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No admins found
                </td>
              </tr>
            ) : (
              admins?.map((admin: any) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {admin.email?.[0]?.toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {admin.name || "Admin User"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        admin.role === "super_admin"
                          ? "bg-purple-100 text-purple-800"
                          : admin.role === "admin"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {admin.role === "super_admin"
                        ? "Super Admin"
                        : admin.role === "admin"
                        ? "Admin"
                        : "Moderator"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {admin.last_login
                      ? new Date(admin.last_login).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {admin.id !== user?.id && user?.role === "super_admin" && (
                      <button
                        onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="inline w-4 h-4" />
                      </button>
                    )}
                    {admin.id === user?.id && (
                      <span className="text-gray-400 text-xs">(You)</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Role Permissions Reference */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Role Permissions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
            <div className="flex items-center space-x-2 mb-3">
              <Crown className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-purple-900">Super Admin</h4>
            </div>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Full database access</li>
              <li>• Manage other admins</li>
              <li>• System configuration</li>
              <li>• All admin permissions</li>
            </ul>
          </div>

          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">Admin</h4>
            </div>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Manage users & groups</li>
              <li>• View analytics</li>
              <li>• Moderate content</li>
              <li>• View audit logs</li>
            </ul>
          </div>

          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-900">Moderator</h4>
            </div>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• Moderate content</li>
              <li>• Resolve reports</li>
              <li>• Mute/warn users</li>
              <li>• Limited permissions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Admin
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, email: e.target.value })
                  }
                  placeholder="admin@oncampus.app"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, role: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temporary Password
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newAdmin.tempPassword}
                    onChange={(e) =>
                      setNewAdmin({ ...newAdmin, tempPassword: e.target.value })
                    }
                    placeholder="Enter or generate password"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={generatePassword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center space-x-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>Generate</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Admin will be required to change password on first login
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => createAdminMutation.mutate()}
                disabled={
                  !newAdmin.email ||
                  !newAdmin.tempPassword ||
                  createAdminMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
