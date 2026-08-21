import { API_BASE_URL, getAccessToken } from "./api";
import { cache } from "./cache";

type Method = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

type Options = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  cacheTtlMs?: number;
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

function accountCacheScope(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function campusRequest<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method || "GET";
  const token = await getAccessToken();
  if (!token) throw new CampusApiError("Please sign in again.", 401);

  const query = qs(options.query);
  const cacheKey = method === "GET" && options.cacheTtlMs
    ? `campus_${accountCacheScope(token)}_${path}${query}`
    : null;
  const attempts = method === "GET" ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);
    try {
      const response = await fetch(`${API_BASE_URL}${path}${query}`, {
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
      if (cacheKey) await cache.set(cacheKey, data, options.cacheTtlMs);
      return data as T;
    } catch (error) {
      lastError = error;
      if (error instanceof CampusApiError && error.status > 0 && error.status < 500) throw error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (cacheKey) {
    const cached = await cache.get<T>(cacheKey);
    if (cached !== null) return cached;
  }
  if (lastError instanceof CampusApiError) throw lastError;
  if (lastError instanceof Error && lastError.name === "AbortError") throw new CampusApiError("The campus service timed out. Please try again.", 0);
  throw new CampusApiError(lastError instanceof Error ? lastError.message : "Request failed");
}

const MINUTE = 60_000;

export const campusApi = {
  student: {
    institutions: (filters: { q?: string; type?: string; city?: string; verified?: boolean; limit?: number; offset?: number } = {}) =>
      campusRequest<any>("/campus/directory/institutions", { query: filters, cacheTtlMs: 5 * MINUTE }),
    institutionProfile: (id: string) => campusRequest<any>(`/campus/directory/institutions/${encodeURIComponent(id)}`, { cacheTtlMs: 5 * MINUTE }),
    followInstitution: (id: string) => campusRequest<any>(`/campus/directory/institutions/${encodeURIComponent(id)}/follow`, { method: "POST" }),
    unfollowInstitution: (id: string) => campusRequest<any>(`/campus/directory/institutions/${encodeURIComponent(id)}/follow`, { method: "DELETE" }),
    hub: () => campusRequest<any>("/campus/hub", { cacheTtlMs: 5 * MINUTE }),
    search: (q: string) => campusRequest<any>("/campus/search", { query: { q }, cacheTtlMs: 2 * MINUTE }),
    trending: () => campusRequest<any>("/campus/trending", { cacheTtlMs: 5 * MINUTE }),
    searchHistory: () => campusRequest<any[]>("/campus/search/history", { cacheTtlMs: 10 * MINUTE }),
    clearSearchHistory: () => campusRequest<any>("/campus/search/history", { method: "DELETE" }),
    events: () => campusRequest<any[]>("/campus/events", { cacheTtlMs: 10 * MINUTE }),
    rsvp: (eventId: string, status: "going" | "interested" | "not_going" | "waitlist", guests = 0) =>
      campusRequest<any>(`/campus/events/${eventId}/rsvp`, { method: "POST", body: { status, guests } }),
    marketplace: () => campusRequest<any[]>("/campus/marketplace", { cacheTtlMs: 5 * MINUTE }),
    createMarketplace: (payload: any) => campusRequest<any>("/campus/marketplace", { method: "POST", body: payload }),
    lostFound: () => campusRequest<any[]>("/campus/lost-found", { cacheTtlMs: 5 * MINUTE }),
    createLostFound: (payload: any) => campusRequest<any>("/campus/lost-found", { method: "POST", body: payload }),
    opportunities: () => campusRequest<any[]>("/campus/opportunities", { cacheTtlMs: 10 * MINUTE }),
    places: () => campusRequest<any[]>("/campus/places", { cacheTtlMs: 60 * MINUTE }),
    digitalId: () => campusRequest<any>("/campus/digital-id"),
    emergency: () => campusRequest<any[]>("/campus/emergency"),
    alumni: () => campusRequest<any[]>("/campus/alumni", { cacheTtlMs: 10 * MINUTE }),
    saveAlumni: (payload: any) => campusRequest<any>("/campus/alumni/me", { method: "POST", body: payload }),
    feedback: (payload: { category?: string; subject: string; message: string; rating?: number }) =>
      campusRequest<any>("/campus/feedback", { method: "POST", body: payload }),
    activity: () => campusRequest<any[]>("/campus/activity", { cacheTtlMs: 5 * MINUTE }),
    changelog: () => campusRequest<any[]>("/campus/changelog", { cacheTtlMs: 60 * MINUTE }),
    invite: (code: string) => campusRequest<any>(`/campus/invites/${encodeURIComponent(code)}`),
    acceptInvite: (code: string) => campusRequest<any>(`/campus/invites/${encodeURIComponent(code)}/accept`, { method: "POST" }),
    reaction: (postId: string, reaction?: string) => campusRequest<any>(`/campus/posts/${postId}/reaction`, { method: "POST", body: { reaction: reaction || null } }),
    reactions: (postId: string) => campusRequest<any>(`/campus/posts/${postId}/reactions`),
    poll: (postId: string) => campusRequest<any>(`/campus/posts/${postId}/poll`),
    votePoll: (pollId: string, optionIds: string[]) => campusRequest<any>(`/campus/polls/${pollId}/vote`, { method: "POST", body: { optionIds } }),
    linkPreview: (url: string) => campusRequest<any>("/campus/link-preview", { query: { url }, cacheTtlMs: 60 * MINUTE }),
    muteGroup: (groupId: string, muted: boolean) => campusRequest<any>(`/campus/groups/${groupId}/mute`, { method: "POST", query: { muted } }),
    archiveGroup: (groupId: string, archived: boolean) => campusRequest<any>(`/campus/groups/${groupId}/archive`, { method: "POST", query: { archived } }),
  },
  institution: {
    studio: () => campusRequest<any>("/campus/institution/studio"),
    updateStudioProfile: (payload: any) => campusRequest<any>("/campus/institution/studio/profile", { method: "PATCH", body: payload }),
    publishStudio: () => campusRequest<any>("/campus/institution/studio/publish", { method: "POST" }),
    versions: () => campusRequest<any[]>("/campus/institution/studio/versions"),
    restoreVersion: (id: string) => campusRequest<any>(`/campus/institution/studio/versions/${id}/restore`, { method: "POST" }),
    createStory: (payload: any) => campusRequest<any>("/campus/institution/studio/story", { method: "POST", body: payload }),
    updateStory: (id: string, payload: any) => campusRequest<any>(`/campus/institution/studio/story/${id}`, { method: "PATCH", body: payload }),
    deleteStory: (id: string) => campusRequest<any>(`/campus/institution/studio/story/${id}`, { method: "DELETE" }),
    createGallery: (payload: any) => campusRequest<any>("/campus/institution/studio/gallery", { method: "POST", body: payload }),
    updateGallery: (id: string, payload: any) => campusRequest<any>(`/campus/institution/studio/gallery/${id}`, { method: "PATCH", body: payload }),
    deleteGallery: (id: string) => campusRequest<any>(`/campus/institution/studio/gallery/${id}`, { method: "DELETE" }),
    updateSection: (key: string, payload: any) => campusRequest<any>(`/campus/institution/studio/sections/${encodeURIComponent(key)}`, { method: "PUT", body: payload }),
    createProgram: (payload: any) => campusRequest<any>("/campus/institution/studio/programs", { method: "POST", body: payload }),
    updateProgram: (id: string, payload: any) => campusRequest<any>(`/campus/institution/studio/programs/${id}`, { method: "PATCH", body: payload }),
    deleteProgram: (id: string) => campusRequest<any>(`/campus/institution/studio/programs/${id}`, { method: "DELETE" }),
    createAchievement: (payload: any) => campusRequest<any>("/campus/institution/studio/achievements", { method: "POST", body: payload }),
    updateAchievement: (id: string, payload: any) => campusRequest<any>(`/campus/institution/studio/achievements/${id}`, { method: "PATCH", body: payload }),
    deleteAchievement: (id: string) => campusRequest<any>(`/campus/institution/studio/achievements/${id}`, { method: "DELETE" }),
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
