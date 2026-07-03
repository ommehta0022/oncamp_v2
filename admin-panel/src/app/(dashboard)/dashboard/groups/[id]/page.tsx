"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Edit2,
  Trash2,
  CheckCircle,
  Globe,
  Lock,
  Building2,
} from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const groupId = params.id as string;
  const [membersPage, setMembersPage] = useState(1);

  const { data: group, isLoading } = useQuery({
    queryKey: ["admin-group", groupId],
    queryFn: () => api.getGroup(groupId),
  });

  const { data: membersData } = useQuery({
    queryKey: ["admin-group-members", groupId, membersPage],
    queryFn: () => api.getGroupMembers(groupId, { page: membersPage, limit: 20 }),
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.verifyGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-group", groupId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reason: string) => api.deleteGroup(groupId, reason, false),
    onSuccess: () => {
      router.push("/dashboard/groups");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeGroupMember(groupId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-group-members", groupId],
      });
    },
  });

  const handleDelete = () => {
    const reason = prompt("Enter reason for deletion:");
    if (reason) {
      deleteMutation.mutate(reason);
    }
  };

  const handleRemoveMember = (userId: string, userName: string) => {
    if (confirm(`Remove ${userName} from this group?`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading group details...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Group not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/groups"
            className="text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Group Details</h1>
            <p className="text-gray-600 mt-1">
              Manage group settings and members
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {!group.is_official && (
            <button
              onClick={() => verifyMutation.mutate()}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Verify as Official</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Group</span>
          </button>
        </div>
      </div>

      {/* Group Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start space-x-6">
          {group.avatar_url ? (
            <img
              src={group.avatar_url}
              alt={group.name}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-semibold">
              {group.name?.[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-2xl font-bold text-gray-900">{group.name}</h2>
              {group.is_official && (
                <CheckCircle className="w-6 h-6 text-blue-500" />
              )}
            </div>
            <p className="text-gray-600 mt-2">{group.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-500">Visibility</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {group.visibility}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Category</p>
                <p className="text-lg font-semibold text-gray-900">
                  {group.category || "Uncategorized"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">City</p>
                <p className="text-lg font-semibold text-gray-900">
                  {group.city || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`inline-block px-3 py-1 text-sm font-medium rounded ${
                    group.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {group.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Members</p>
              <p className="text-2xl font-bold text-gray-900">
                {group.membersCount || 0}
              </p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-2xl font-bold text-gray-900">
                {group.messagesCount || 0}
              </p>
            </div>
            <MessageSquare className="w-10 h-10 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Join Policy</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {group.join_policy || "open"}
              </p>
            </div>
            {group.join_policy === "open" ? (
              <Globe className="w-10 h-10 text-green-500" />
            ) : (
              <Lock className="w-10 h-10 text-orange-500" />
            )}
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Members</h3>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {membersData?.data?.map((member: any) => (
                <tr key={member.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {member.users?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.users?.name || "Unknown"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.users?.email || member.user_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        member.role === "owner"
                          ? "bg-purple-100 text-purple-800"
                          : member.role === "admin"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {member.role !== "owner" && (
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.user_id,
                            member.users?.name || "this user"
                          )
                        }
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
