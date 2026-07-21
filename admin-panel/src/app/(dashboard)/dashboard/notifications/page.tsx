"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Bell, Mail, MessageCircle, RefreshCw, Send, Smartphone, Users } from "lucide-react";

type ChannelKey = "inApp" | "push" | "email" | "whatsapp" | "telegram" | "linkedin";

const channelOptions: { key: ChannelKey; label: string; icon: any }[] = [
  { key: "inApp", label: "In-app", icon: Bell },
  { key: "push", label: "Push", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "linkedin", label: "LinkedIn", icon: Users },
];

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [channelsConfigured, setChannelsConfigured] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    type: "admin_broadcast",
    target: "all",
    userIds: "",
    channels: {
      inApp: true,
      push: true,
      email: false,
      whatsapp: false,
      telegram: false,
      linkedin: false,
    } as Record<ChannelKey, boolean>,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [notifications, allUsers] = await Promise.all([
        api.getAdminNotifications(100),
        api.getUsers({ limit: 1000 }),
      ]);
      setRecent(notifications?.data || []);
      setChannelsConfigured(notifications?.channels || {});
      setUsers(allUsers?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedUserIds = () =>
    form.userIds
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);

  const sendNotification = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    try {
      setSending(true);
      setResult(null);
      const response = await api.sendAdminNotification({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type.trim() || "admin_broadcast",
        target: form.target,
        userIds: form.target === "users" ? selectedUserIds() : [],
        channels: form.channels,
        data: { screen: "notifications" },
      });
      setResult(response);
      setForm((current) => ({ ...current, title: "", body: "" }));
      await loadData();
    } catch (error: any) {
      setResult({ success: false, error: error.response?.data?.detail || error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">Create real user notifications and review delivery status</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Create Notification</h2>
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Campus update"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Type</label>
                <input
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="admin_broadcast"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Message</label>
              <textarea
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Write the notification users will see in the mobile app."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Target</label>
                <select
                  value={form.target}
                  onChange={(event) => setForm({ ...form, target: event.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All users ({users.length})</option>
                  <option value="users">Selected user IDs</option>
                </select>
              </div>
              {form.target === "users" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">User IDs</label>
                  <textarea
                    value={form.userIds}
                    onChange={(event) => setForm({ ...form, userIds: event.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste comma or newline separated user IDs"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">Channels</label>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {channelOptions.map(({ key, label, icon: Icon }) => (
                  <label key={key} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Icon className="h-4 w-4 text-gray-500" />
                      {label}
                    </span>
                    <input
                      type="checkbox"
                      checked={form.channels[key]}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          channels: { ...form.channels, [key]: event.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={sendNotification}
                disabled={sending || !form.title.trim() || !form.body.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending..." : "Send Notification"}
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">Channel Status</h2>
          <div className="mt-4 space-y-3">
            {channelOptions.filter((item) => item.key !== "inApp").map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{label}</span>
                <span className={channelsConfigured[key] ? "text-green-600" : "text-gray-500"}>
                  {channelsConfigured[key] ? "Configured" : "Not configured"}
                </span>
              </div>
            ))}
          </div>

          {result && (
            <div className={`mt-6 rounded-lg p-4 text-sm ${result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {result.success ? (
                <div className="space-y-2">
                  <p className="font-semibold">Notification created for {result.targetedUsers} users.</p>
                  {Object.entries(result.delivery || {}).map(([channel, value]: any) => (
                    <p key={channel}>{channel}: {value.status}</p>
                  ))}
                </div>
              ) : (
                <p>{result.error}</p>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Notifications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Read</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {recent.length > 0 ? recent.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="mt-1 max-w-xl text-sm text-gray-500">{item.body}</p>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{item.userId}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{item.type}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{item.readAt ? "Read" : "Unread"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    {loading ? "Loading notifications..." : "No notifications found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
