const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://oncampus-backend-production.up.railway.app";
const TOKEN_KEY = "institution_studio_token";
const REFRESH_KEY = "institution_studio_refresh";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

type CacheEntry = { value: any; expires: number };
const memoryCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<any>>();
const DEFAULT_GET_TTL = 15_000;

function token() {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

function cacheKey(path: string) {
  const t = token() || "anonymous";
  let hash = 2166136261;
  for (let i = 0; i < t.length; i += 1) { hash ^= t.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `${hash >>> 0}:${path}`;
}

export function invalidateStudioCache(prefix = "") {
  for (const key of Array.from(memoryCache.keys())) {
    if (!prefix || key.includes(prefix)) memoryCache.delete(key);
  }
}

async function request<T = any>(path: string, method: HttpMethod = "GET", body?: any, ttlMs = DEFAULT_GET_TTL): Promise<T> {
  const key = cacheKey(path);
  if (method === "GET") {
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;
  }

  const perform = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.includes("/studio/login")) {
          clearStudioSession();
          window.location.href = "/studio/login";
        }
        throw new Error(data?.detail || data?.message || `Request failed (${response.status})`);
      }
      if (method === "GET") memoryCache.set(key, { value: data, expires: Date.now() + ttlMs });
      else invalidateStudioCache();
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("The Studio request timed out. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  if (method !== "GET") return perform();
  const promise = perform().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export function hasStudioSession() { return Boolean(token()); }
export function clearStudioSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("institution_studio_user");
    memoryCache.clear();
    inFlight.clear();
  }
}

export async function studioOtpStart(phone: string) {
  return request<any>("/v1/auth/institution/otp/start", "POST", { identifier: phone });
}
export async function studioOtpVerify(phone: string, code: string) {
  const data = await request<any>("/v1/auth/institution/otp/verify", "POST", { identifier: phone, phone, code, platform: "web" });
  if (!data?.accessToken) throw new Error("Login did not return an access token.");
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.user) localStorage.setItem("institution_studio_user", JSON.stringify(data.user));
  try { await request("/v1/campus/institution/studio", "GET", undefined, 30_000); }
  catch (error) {
    clearStudioSession();
    throw new Error(error instanceof Error ? error.message : "This account is not an approved institution administrator.");
  }
  return data;
}

export const institutionStudioApi = {
  bundle: () => request<any>("/v1/campus/institution/studio", "GET", undefined, 30_000),
  prefetchBundle: () => request<any>("/v1/campus/institution/studio", "GET", undefined, 30_000).catch(() => null),
  updateIdentity: (payload: any) => request<any>("/v1/institutions/me", "PATCH", payload),
  updateProfile: (payload: any) => request<any>("/v1/campus/institution/studio/profile", "PATCH", payload),
  publish: () => request<any>("/v1/campus/institution/studio/publish", "POST"),
  versions: () => request<any[]>("/v1/campus/institution/studio/versions", "GET", undefined, 15_000),
  restoreVersion: (id: string) => request<any>(`/v1/campus/institution/studio/versions/${encodeURIComponent(id)}/restore`, "POST"),
  createStory: (payload: any) => request<any>("/v1/campus/institution/studio/story", "POST", payload),
  updateStory: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/story/${encodeURIComponent(id)}`, "PATCH", payload),
  deleteStory: (id: string) => request<any>(`/v1/campus/institution/studio/story/${encodeURIComponent(id)}`, "DELETE"),
  createGallery: (payload: any) => request<any>("/v1/campus/institution/studio/gallery", "POST", payload),
  updateGallery: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/gallery/${encodeURIComponent(id)}`, "PATCH", payload),
  deleteGallery: (id: string) => request<any>(`/v1/campus/institution/studio/gallery/${encodeURIComponent(id)}`, "DELETE"),
  updateSection: (key: string, payload: any) => request<any>(`/v1/campus/institution/studio/sections/${encodeURIComponent(key)}`, "PUT", payload),
  createProgram: (payload: any) => request<any>("/v1/campus/institution/studio/programs", "POST", payload),
  updateProgram: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/programs/${encodeURIComponent(id)}`, "PATCH", payload),
  deleteProgram: (id: string) => request<any>(`/v1/campus/institution/studio/programs/${encodeURIComponent(id)}`, "DELETE"),
  createAchievement: (payload: any) => request<any>("/v1/campus/institution/studio/achievements", "POST", payload),
  updateAchievement: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/achievements/${encodeURIComponent(id)}`, "PATCH", payload),
  deleteAchievement: (id: string) => request<any>(`/v1/campus/institution/studio/achievements/${encodeURIComponent(id)}`, "DELETE"),
  studentApprovals: (status = "pending") => request<any[]>(`/v1/campus/institution/student-approvals?status=${encodeURIComponent(status)}`, "GET", undefined, 10_000),
  decideStudent: (id: string, status: string, message = "") => request<any>(`/v1/campus/institution/student-approvals/${encodeURIComponent(id)}/decision`, "POST", { status, message }),
  departments: () => request<any[]>("/v1/campus/institution/departments", "GET", undefined, 30_000),
  createDepartment: (payload: any) => request<any>("/v1/campus/institution/departments", "POST", payload),
  updateDepartment: (id: string, payload: any) => request<any>(`/v1/campus/institution/departments/${encodeURIComponent(id)}`, "PATCH", payload),
  updateStudioDepartment: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/departments/${encodeURIComponent(id)}`, "PATCH", payload),
  staff: () => request<any[]>("/v1/campus/institution/staff", "GET", undefined, 20_000),
  createStaff: (payload: any) => request<any>("/v1/campus/institution/staff", "POST", payload),
  updateStaff: (id: string, payload: any) => request<any>(`/v1/campus/institution/staff/${encodeURIComponent(id)}`, "PATCH", payload),
  roles: () => request<any[]>("/v1/campus/institution/roles", "GET", undefined, 30_000),
  createRole: (payload: any) => request<any>("/v1/campus/institution/roles", "POST", payload),
  updateRole: (id: string, payload: any) => request<any>(`/v1/campus/institution/roles/${encodeURIComponent(id)}`, "PATCH", payload),
  events: () => request<any[]>("/v1/campus/institution/events", "GET", undefined, 15_000),
  createEvent: (payload: any) => request<any>("/v1/campus/institution/events", "POST", payload),
  updateEvent: (id: string, payload: any) => request<any>(`/v1/campus/institution/events/${encodeURIComponent(id)}`, "PATCH", payload),
  createGroup: (payload: any) => request<any>("/v1/groups", "POST", { ...payload, official: true }),
  updateGroup: (id: string, payload: any) => request<any>(`/v1/groups/${encodeURIComponent(id)}`, "PATCH", payload),
  studioGroups: () => request<any[]>("/v1/campus/institution/studio/groups", "GET", undefined, 15_000),
  updateStudioGroup: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/groups/${encodeURIComponent(id)}`, "PATCH", payload),
  studioOpportunities: () => request<any[]>("/v1/campus/institution/studio/opportunities", "GET", undefined, 15_000),
  updateStudioOpportunity: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/opportunities/${encodeURIComponent(id)}`, "PATCH", payload),
  archiveOpportunity: (id: string) => request<any>(`/v1/campus/institution/studio/opportunities/${encodeURIComponent(id)}`, "DELETE"),
  studioPlaces: () => request<any[]>("/v1/campus/institution/studio/places", "GET", undefined, 30_000),
  updateStudioPlace: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/places/${encodeURIComponent(id)}`, "PATCH", payload),
  deleteStudioPlace: (id: string) => request<any>(`/v1/campus/institution/studio/places/${encodeURIComponent(id)}`, "DELETE"),
  announcements: () => request<any[]>("/v1/campus/institution/announcements", "GET", undefined, 10_000),
  createAnnouncement: (payload: any) => request<any>("/v1/campus/institution/announcements", "POST", payload),
  updateStudioAnnouncement: (id: string, payload: any) => request<any>(`/v1/campus/institution/studio/announcements/${encodeURIComponent(id)}`, "PATCH", payload),
  broadcasts: () => request<any[]>("/v1/campus/institution/broadcasts", "GET", undefined, 10_000),
  createBroadcast: (payload: any) => request<any>("/v1/campus/institution/broadcasts", "POST", payload),
  sendBroadcast: (id: string) => request<any>(`/v1/campus/institution/broadcasts/${encodeURIComponent(id)}/send`, "POST"),
  analytics: () => request<any>("/v1/campus/institution/analytics", "GET", undefined, 20_000),
  moderation: (status = "open") => request<any>(`/v1/campus/institution/moderation?status=${encodeURIComponent(status)}`, "GET", undefined, 10_000),
  scanModeration: () => request<any>("/v1/campus/institution/moderation/scan", "POST"),
  moderate: (id: string, status: string) => request<any>(`/v1/campus/institution/moderation/${encodeURIComponent(id)}/decision?status=${encodeURIComponent(status)}`, "POST"),
  storage: () => request<any>("/v1/campus/institution/storage", "GET", undefined, 60_000),
  backups: () => request<any[]>("/v1/campus/institution/backups", "GET", undefined, 30_000),
  createBackup: (label: string) => request<any>(`/v1/campus/institution/backups?label=${encodeURIComponent(label)}`, "POST"),
  restoreBackup: (id: string) => request<any>(`/v1/campus/institution/backups/${encodeURIComponent(id)}/restore?confirm=true`, "POST"),
  webhooks: () => request<any[]>("/v1/campus/institution/webhooks", "GET", undefined, 30_000),
  createWebhook: (payload: any) => request<any>("/v1/campus/institution/webhooks", "POST", payload),
  integrations: () => request<any[]>("/v1/campus/institution/integrations", "GET", undefined, 30_000),
  createIntegration: (payload: any) => request<any>("/v1/campus/institution/integrations", "POST", payload),
  createOpportunity: (payload: any) => request<any>("/v1/campus/institution/opportunities", "POST", payload),
  createPlace: (payload: any) => request<any>("/v1/campus/institution/places", "POST", payload),
  uploadMedia(file: File, onProgress?: (percent: number) => void) {
    return new Promise<any>((resolve, reject) => {
      const form = new FormData();
      form.append("file", file);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}/v1/campus/institution/studio/media`);
      xhr.setRequestHeader("Accept", "application/json");
      const auth = token();
      if (auth) xhr.setRequestHeader("Authorization", `Bearer ${auth}`);
      xhr.timeout = 60_000;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Try a smaller file or faster connection."));
      xhr.onload = () => {
        let data: any = {};
        try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* no-op */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          invalidateStudioCache();
          resolve(data);
        } else reject(new Error(data?.detail || `Upload failed (${xhr.status})`));
      };
      xhr.send(form);
    });
  },
};
