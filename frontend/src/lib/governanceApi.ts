import { API_BASE_URL, getAccessToken } from "./api";

export type InstitutionRole = {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  is_system?: boolean;
};

export type AuditEntry = {
  id: string;
  user_id?: string | null;
  event_type: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

async function request<T>(path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : `Request failed (${response.status})`);
  return data as T;
}

function publicBackendOrigin() {
  return API_BASE_URL.replace(/\/v1\/?$/, "");
}

export const governanceApi = {
  roles: () => request<InstitutionRole[]>("/campus/institution/roles"),
  createRole: (payload: { name: string; description?: string | null; permissions: string[] }) =>
    request<InstitutionRole>("/campus/institution/roles", { method: "POST", body: payload }),
  updateRole: (id: string, payload: { name: string; description?: string | null; permissions: string[] }) =>
    request<InstitutionRole>(`/campus/institution/roles/${encodeURIComponent(id)}`, { method: "PATCH", body: payload }),
  auditLogs: (limit = 150) => request<AuditEntry[]>(`/campus/institution/audit-logs?limit=${Math.max(1, Math.min(500, limit))}`),
  exportLink: async (dataset: "students" | "staff" | "events" | "analytics", format: "csv" | "pdf") => {
    const result = await request<{ url: string; expiresAt: string; dataset: string; format: string }>(
      `/campus/institution/export-link?dataset=${dataset}&format=${format}`,
      { method: "POST" },
    );
    return { ...result, url: `${publicBackendOrigin()}${result.url}` };
  },
};
