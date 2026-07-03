"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  Clock,
  Edit,
  Save,
  Shield,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface UserDetail {
  id: string;
  name: string;
  phone_hash: string;
  email: string;
  city: string;
  institution: string;
  status: string;
  verified: boolean;
  created_at: string;
  last_seen_at: string;
  bio: string;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<UserDetail>>({});
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [muteData, setMuteData] = useState({ duration: "24h", reason: "" });
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await api.getUser(userId);
      setUser(response);
      setEditData(response);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.updateUser(userId, editData);
      toast.success("User updated successfully");
      setEditing(false);
      fetchUser();
    } catch (error) {
      toast.error("Failed to update user");
    }
  };

  const handleMute = async () => {
    try {
      await api.muteUser(userId, muteData.duration, muteData.reason);
      toast.success("User muted successfully");
      setShowMuteModal(false);
      fetchUser();
    } catch (error) {
      toast.error("Failed to mute user");
    }
  };

  const handleBan = async () => {
    try {
      await api.banUser(userId, banReason);
      toast.success("User banned successfully");
      setShowBanModal(false);
      fetchUser();
    } catch (error) {
      toast.error("Failed to ban user");
    }
  };

  const handleUnban = async () => {
    try {
      await api.unbanUser(userId);
      toast.success("User unbanned successfully");
      fetchUser();
    } catch (error) {
      toast.error("Failed to unban user");
    }
  };

  const handleVerify = async () => {
    try {
      await api.verifyUser(userId, "student");
      toast.success("User verified successfully");
      fetchUser();
    } catch (error) {
      toast.error("Failed to verify user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">User not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
            <p className="text-sm text-gray-500">User ID: {user.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {user.status === "banned" ? (
            <button
              onClick={handleUnban}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Unban User
            </button>
          ) : (
            <>
              {!user.verified && (
                <button
                  onClick={handleVerify}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Verify</span>
                </button>
              )}
              <button
                onClick={() => setShowMuteModal(true)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center space-x-2"
              >
                <VolumeX className="w-4 h-4" />
                <span>Mute</span>
              </button>
              <button
                onClick={() => setShowBanModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
              >
                <Ban className="w-4 h-4" />
                <span>Ban</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Profile Information</h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : (
            <div className="flex space-x-2">
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditData(user);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            {editing ? (
              <input
                type="text"
                value={editData.name || ""}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone
            </label>
            <p className="text-gray-900">****{user.phone_hash?.slice(-4)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            {editing ? (
              <input
                type="email"
                value={editData.email || ""}
                onChange={(e) =>
                  setEditData({ ...editData, email: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.email || "-"}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City
            </label>
            {editing ? (
              <input
                type="text"
                value={editData.city || ""}
                onChange={(e) =>
                  setEditData({ ...editData, city: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.city || "-"}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Institution
            </label>
            <p className="text-gray-900">{user.institution || "-"}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <span
              className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                user.status === "active"
                  ? "bg-green-100 text-green-800"
                  : user.status === "muted"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {user.status}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verified
            </label>
            {user.verified ? (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span>Verified</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-gray-400">
                <Clock className="w-5 h-5" />
                <span>Unverified</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Joined
            </label>
            <p className="text-gray-900">
              {new Date(user.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Mute Modal */}
      {showMuteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Mute User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration
                </label>
                <select
                  value={muteData.duration}
                  onChange={(e) =>
                    setMuteData({ ...muteData, duration: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <textarea
                  value={muteData.reason}
                  onChange={(e) =>
                    setMuteData({ ...muteData, reason: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="Enter reason for muting..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowMuteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMute}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-red-600">
              Ban User
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This action will permanently ban the user from the platform. All
              sessions will be revoked.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Required)
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="Enter reason for banning..."
              />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={!banReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
