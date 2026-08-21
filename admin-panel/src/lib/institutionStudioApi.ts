const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://oncampus-backend-production.up.railway.app";
const TOKEN_KEY = "institution_studio_token";
const REFRESH_KEY = "institution_studio_refresh";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE" | "PUT";

function token() {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

async function request<T = any>(path: string, method: HttpMethod = "GET", body?: any): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
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
  return data as T;
}

export function hasStudioSession() { return Boolean(token()); }
export function clearStudioSession() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem("institution_studio_user");
  }
}

export async function studioOtpStart(phone: string) { return request<any>("/v1/auth/otp/start", "POST", { phone }); }
export async function studioOtpVerify(phone: string, code: string) {
  const data = await request<any>("/v1/auth/otp/verify-code", "POST", { phone, code });
  if (!data?.accessToken) throw new Error("Login did not return an access token.");
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.user) localStorage.setItem("institution_studio_user", JSON.stringify(data.user));
  try { await request("/v1/campus/institution/studio"); }
  catch (error) {
    clearStudioSession();
    throw new Error(error instanceof Error ? error.message : "This account is not an approved institution administrator.");
  }
  return data;
}

export const institutionStudioApi = {
  bundle: () => request<any>("/v1/campus/institution/studio"),
  updateIdentity: (payload: any) => request<any>("/v1/institutions/me", "PATCH", payload),
  updateProfile: (payload: any) => request<any>("/v1/campus/institution/studio/profile", "PATCH", payload),
  publish: () => request<any>("/v1/campus/institution/studio/publish", "POST"),
  versions: () => request<any[]>("/v1/campus/institution/studio/versions"),
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
  studentApprovals: (status = "pending") => request<any[]>(`/v1/campus/institution/student-approvals?status=${encodeURIComponent(status)}`),
  decideStudent: (id: string, status: string, message = "") => request<any>(`/v1/campus/institution/student-approvals/${encodeURIComponent(id)}/decision`, "POST", { status, message }),
  departments: () => request<any[]>("/v1/campus/institution/departments"),
  createDepartment: (payload: any) => request<any>("/v1/campus/institution/departments", "POST", payload),
  updateDepartment: (id: string, payload: any) => request<any>(`/v1/campus/institution/departments/${encodeURIComponent(id)}`, "PATCH", payload),
  staff: () => request<any[]>("/v1/campus/institution/staff"),
  createStaff: (payload: any) => request<any>("/v1/campus/institution/staff", "POST", payload),
  updateStaff: (id: string, payload: any) => request<any>(`/v1/campus/institution/staff/${encodeURIComponent(id)}`, "PATCH", payload),
  roles: () => request<any[]>("/v1/campus/institution/roles"),
  createRole: (payload: any) => request<any>("/v1/campus/institution/roles", "POST", payload),
  updateRole: (id: string, payload: any) => request<any>(`/v1/campus/institution/roles/${encodeURIComponent(id)}`, "PATCH", payload),
  events: () => request<any[]>("/v1/campus/institution/events"),
  createEvent: (payload: any) => request<any>("/v1/campus/institution/events", "POST", payload),
  updateEvent: (id: string, payload: any) => request<any>(`/v1/campus/institution/events/${encodeURIComponent(id)}`, "PATCH", payload),
  createGroup: (payload: any) => request<any>("/v1/groups", "POST", { ...payload, official: true }),
  updateGroup: (id: string, payload: any) => request<any>(`/v1/groups/${encodeURIComponent(id)}`, "PATCH", payload),
  announcements: () => request<any[]>("/v1/campus/institution/announcements"),
  createAnnouncement: (payload: any) => request<any>("/v1/campus/institution/announcements", "POST", payload),
  broadcasts: () => request<any[]>("/v1/campus/institution/broadcasts"),
  createBroadcast: (payload: any) => request<any>("/v1/campus/institution/broadcasts", "POST", payload),
  sendBroadcast: (id: string) => request<any>(`/v1/campus/institution/broadcasts/${encodeURIComponent(id)}/send`, "POST"),
  analytics: () => request<any>("/v1/campus/institution/analytics"),
  moderation: (status = "open") => request<any>(`/v1/campus/institution/moderation?status=${encodeURIComponent(status)}`),
  scanModeration: () => request<any>("/v1/campus/institution/moderation/scan", "POST"),
  moderate: (id: string, status: string) => request<any>(`/v1/campus/institution/moderation/${encodeURIComponent(id)}/decision?status=${encodeURIComponent(status)}`, "POST"),
  storage: () => request<any>("/v1/campus/institution/storage"),
  backups: () => request<any[]>("/v1/campus/institution/backups"),
  createBackup: (label: string) => request<any>(`/v1/campus/institution/backups?label=${encodeURIComponent(label)}`, "POST"),
  restoreBackup: (id: string) => request<any>(`/v1/campus/institution/backups/${encodeURIComponent(id)}/restore?confirm=true`, "POST"),
  webhooks: () => request<any[]>("/v1/campus/institution/webhooks"),
  createWebhook: (payload: any) => request<any>("/v1/campus/institution/webhooks", "POST", payload),
  integrations: () => request<any[]>("/v1/campus/institution/integrations"),
  createIntegration: (payload: any) => request<any>("/v1/campus/institution/integrations", "POST", payload),
  createOpportunity: (payload: any) => request<any>("/v1/campus/institution/opportunities", "POST", payload),
  createPlace: (payload: any) => request<any>("/v1/campus/institution/places", "POST", payload),
  async uploadMedia(file: File) {
    const form = new FormData(); form.append("file", file);
    const response = await fetch(`${API_URL}/v1/campus/institution/studio/media`, { method: "POST", headers: token() ? { Authorization: `Bearer ${token()}` } : {}, body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.detail || "Upload failed");
    return data;
  },
};
