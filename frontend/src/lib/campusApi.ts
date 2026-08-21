import { API_BASE_URL, getAccessToken } from "./api";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type Options = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
};

export class CampusApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
    this.name = "CampusApiError";
  }
}

function qs(query?: Options["query"]) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function campusRequest<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method || "GET";
  const token = await getAccessToken();
  if (!token) throw new CampusApiError("Please sign in again.", 401);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
  const attempts = method === "GET" ? 2 : 1;
  let lastError: unknown;

  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(`${API_BASE_URL}${path}${qs(options.query)}`, {
          method,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const text = await response.text();
        const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : undefined;
        if (!response.ok) {
          const detail = typeof data?.detail === "string" ? data.detail : data?.message;
          throw new CampusApiError(detail || `Request failed (${response.status})`, response.status);
        }
        return data as T;
      } catch (error) {
        lastError = error;
        if (error instanceof CampusApiError && error.status < 500) throw error;
        if (attempt === attempts - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
  } finally {
    clearTimeout(timeout);
  }
  throw lastError instanceof Error ? lastError : new CampusApiError("Request failed");
}

export const campusApi = {
  student: {
    hub: () => campusRequest<any>("/campus/hub"),
    search: (q: string) => campusRequest<any>("/campus/search", { query: { q } }),
    trending: () => campusRequest<any>("/campus/trending"),
    searchHistory: () => campusRequest<any[]>("/campus/search/history"),
    clearSearchHistory: () => campusRequest<any>("/campus/search/history", { method: "DELETE" }),
    events: () => campusRequest<any[]>("/campus/events"),
    rsvp: (eventId: string, status: "going" | "interested" | "not_going" | "waitlist", guests = 0) =>
      campusRequest<any>(`/campus/events/${eventId}/rsvp`, { method: "POST", body: { status, guests } }),
    marketplace: () => campusRequest<any[]>("/campus/marketplace"),
    createMarketplace: (payload: any) => campusRequest<any>("/campus/marketplace", { method: "POST", body: payload }),
    lostFound: () => campusRequest<any[]>("/campus/lost-found"),
    createLostFound: (payload: any) => campusRequest<any>("/campus/lost-found", { method: "POST", body: payload }),
    opportunities: () => campusRequest<any[]>("/campus/opportunities"),
    places: () => campusRequest<any[]>("/campus/places"),
    digitalId: () => campusRequest<any>("/campus/digital-id"),
    emergency: () => campusRequest<any[]>("/campus/emergency"),
    alumni: () => campusRequest<any[]>("/campus/alumni"),
    saveAlumni: (payload: any) => campusRequest<any>("/campus/alumni/me", { method: "POST", body: payload }),
    feedback: (payload: { category?: string; subject: string; message: string; rating?: number }) =>
      campusRequest<any>("/campus/feedback", { method: "POST", body: payload }),
    activity: () => campusRequest<any[]>("/campus/activity"),
    changelog: () => campusRequest<any[]>("/campus/changelog"),
    invite: (code: string) => campusRequest<any>(`/campus/invites/${encodeURIComponent(code)}`),
    acceptInvite: (code: string) => campusRequest<any>(`/campus/invites/${encodeURIComponent(code)}/accept`, { method: "POST" }),
    reaction: (postId: string, reaction?: string) => campusRequest<any>(`/campus/posts/${postId}/reaction`, { method: "POST", body: { reaction: reaction || null } }),
    reactions: (postId: string) => campusRequest<any>(`/campus/posts/${postId}/reactions`),
    poll: (postId: string) => campusRequest<any>(`/campus/posts/${postId}/poll`),
    votePoll: (pollId: string, optionIds: string[]) => campusRequest<any>(`/campus/polls/${pollId}/vote`, { method: "POST", body: { optionIds } }),
    linkPreview: (url: string) => campusRequest<any>("/campus/link-preview", { query: { url } }),
    muteGroup: (groupId: string, muted: boolean) => campusRequest<any>(`/campus/groups/${groupId}/mute`, { method: "POST", query: { muted } }),
    archiveGroup: (groupId: string, archived: boolean) => campusRequest<any>(`/campus/groups/${groupId}/archive`, { method: "POST", query: { archived } }),
  },
  institution: {
    overview: () => campusRequest<any>("/campus/institution/overview"),
    studentApprovals: (status = "pending", q = "") => campusRequest<any[]>("/campus/institution/student-approvals", { query: { status, q } }),
    decideStudent: (id: string, status: "approved" | "rejected" | "needs_info", message = "") =>
      campusRequest<any>(`/campus/institution/student-approvals/${id}/decision`, { method: "POST", body: { status, message } }),
    departments: () => campusRequest<any[]>("/campus/institution/departments"),
    createDepartment: (payload: any) => campusRequest<any>("/campus/institution/departments", { method: "POST", body: payload }),
    updateDepartment: (id: string, payload: any) => campusRequest<any>(`/campus/institution/departments/${id}`, { method: "PATCH", body: payload }),
    roles: () => campusRequest<any[]>("/campus/institution/roles"),
    createRole: (payload: any) => campusRequest<any>("/campus/institution/roles", { method: "POST", body: payload }),
    updateRole: (id: string, payload: any) => campusRequest<any>(`/campus/institution/roles/${id}`, { method: "PATCH", body: payload }),
    staff: () => campusRequest<any[]>("/campus/institution/staff"),
    createStaff: (payload: any) => campusRequest<any>("/campus/institution/staff", { method: "POST", body: payload }),
    updateStaff: (id: string, payload: any) => campusRequest<any>(`/campus/institution/staff/${id}`, { method: "PATCH", body: payload }),
    events: () => campusRequest<any[]>("/campus/institution/events"),
    createEvent: (payload: any) => campusRequest<any>("/campus/institution/events", { method: "POST", body: payload }),
    updateEvent: (id: string, payload: any) => campusRequest<any>(`/campus/institution/events/${id}`, { method: "PATCH", body: payload }),
    announcements: () => campusRequest<any[]>("/campus/institution/announcements"),
    createAnnouncement: (payload: any) => campusRequest<any>("/campus/institution/announcements", { method: "POST", body: payload }),
    broadcasts: () => campusRequest<any[]>("/campus/institution/broadcasts"),
    createBroadcast: (payload: any) => campusRequest<any>("/campus/institution/broadcasts", { method: "POST", body: payload }),
    sendBroadcast: (id: string) => campusRequest<any>(`/campus/institution/broadcasts/${id}/send`, { method: "POST" }),
    moderation: (status = "open") => campusRequest<any>("/campus/institution/moderation", { query: { status } }),
    scanModeration: (limit = 50) => campusRequest<any>("/campus/institution/moderation/scan", { method: "POST", query: { limit } }),
    moderate: (id: string, status: "reviewed" | "dismissed" | "actioned") => campusRequest<any>(`/campus/institution/moderation/${id}/decision`, { method: "POST", query: { status } }),
    analytics: () => campusRequest<any>("/campus/institution/analytics"),
    verifications: (status = "pending") => campusRequest<any[]>("/campus/institution/verifications", { query: { status } }),
    decideVerification: (id: string, status: "approved" | "rejected" | "needs_info", message = "") => campusRequest<any>(`/campus/institution/verifications/${id}/decision`, { method: "POST", body: { status, message } }),
    storage: () => campusRequest<any>("/campus/institution/storage"),
    exportCsv: () => campusRequest<Response>("/campus/institution/export.csv"),
    backups: () => campusRequest<any[]>("/campus/institution/backups"),
    createBackup: (label: string) => campusRequest<any>("/campus/institution/backups", { method: "POST", query: { label } }),
    restoreBackup: (id: string) => campusRequest<any>(`/campus/institution/backups/${id}/restore`, { method: "POST", query: { confirm: true } }),
    webhooks: () => campusRequest<any[]>("/campus/institution/webhooks"),
    createWebhook: (payload: any) => campusRequest<any>("/campus/institution/webhooks", { method: "POST", body: payload }),
    integrations: () => campusRequest<any[]>("/campus/institution/integrations"),
    createIntegration: (payload: any) => campusRequest<any>("/campus/institution/integrations", { method: "POST", body: payload }),
    invites: () => campusRequest<any[]>("/campus/institution/invites"),
    createInvite: (payload: any) => campusRequest<any>("/campus/institution/invites", { method: "POST", body: payload }),
    opportunities: (payload: any) => campusRequest<any>("/campus/institution/opportunities", { method: "POST", body: payload }),
    createPlace: (payload: any) => campusRequest<any>("/campus/institution/places", { method: "POST", body: payload }),
    attendance: () => campusRequest<any[]>("/campus/institution/attendance"),
    createAttendance: (payload: any) => campusRequest<any>("/campus/institution/attendance", { method: "POST", body: payload }),
    issueDigitalId: (payload: any) => campusRequest<any>("/campus/institution/digital-id", { method: "POST", body: payload }),
    sendEmergency: (payload: any) => campusRequest<any>("/campus/institution/emergency", { method: "POST", body: payload }),
    createPoll: (payload: any) => campusRequest<any>("/campus/institution/polls", { method: "POST", body: payload }),
  },
  qrUrl: (code: string) => `${API_BASE_URL}/campus/invites/${encodeURIComponent(code)}/qr`,
};
