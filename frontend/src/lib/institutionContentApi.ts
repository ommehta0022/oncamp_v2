import { API_BASE_URL, getAccessToken } from "@/src/lib/api";

export type InstitutionContentStatus =
  | "draft"
  | "pending"
  | "changes_requested"
  | "revised"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "partially_published"
  | "published"
  | "expired";

export type InstitutionDirectoryItem = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country?: string;
  logo_url?: string;
};

export type InstitutionContentRequest = {
  id: string;
  source_institution_id: string;
  target_institution_id: string;
  title: string;
  content: string;
  category: string;
  post_type: string;
  media_url?: string | null;
  media_type?: string | null;
  tags?: string[];
  requested_destination?: "recipient_choice" | "feed" | "groups";
  requested_group_ids?: string[];
  comments_enabled?: boolean;
  reactions_enabled?: boolean;
  pin_requested?: boolean;
  requested_publish_at?: string | null;
  expires_at?: string | null;
  status: InstitutionContentStatus;
  revision: number;
  latest_message?: string | null;
  created_at: string;
  updated_at: string;
  sourceInstitution?: InstitutionDirectoryItem;
  targetInstitution?: InstitutionDirectoryItem;
  side?: "source" | "target";
  events?: InstitutionContentEvent[];
  publications?: InstitutionContentPublication[];
};

export type InstitutionContentEvent = {
  id: string;
  request_id: string;
  actor_user_id: string;
  actor_institution_id: string;
  event_type: string;
  message?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type InstitutionContentPublication = {
  id: string;
  destination_type: "feed" | "group";
  destination_key: string;
  group_id?: string | null;
  post_id: string;
  created_at: string;
};

export type PublishDestination = { type: "feed" | "group"; groupId?: string };

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 30000): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new Error("Please sign in again.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let data: any = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = null; }
    }
    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : data?.message;
      throw new Error(detail || `Request failed (${response.status}).`);
    }
    return data as T;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("The request took too long. Please try again.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const institutionContentApi = {
  overview: () => call<{ inboxPending: number; sentPending: number; approvedReady: number; drafts: number }>("/institutions/me/content/overview"),
  directory: (q = "") => call<InstitutionDirectoryItem[]>(`/institutions/me/content/directory${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  requests: (box: "inbox" | "sent", status = "all") => call<InstitutionContentRequest[]>(`/institutions/me/content/requests?box=${box}&status=${encodeURIComponent(status)}`),
  request: (id: string) => call<InstitutionContentRequest>(`/institutions/me/content/requests/${encodeURIComponent(id)}`),
  createRequest: (body: Record<string, unknown>) => call<InstitutionContentRequest>("/institutions/me/content/requests", json("POST", body)),
  message: (id: string, message: string) => call(`/institutions/me/content/requests/${encodeURIComponent(id)}/message`, json("POST", { message })),
  requestChanges: (id: string, message: string) => call(`/institutions/me/content/requests/${encodeURIComponent(id)}/request-changes`, json("POST", { message })),
  revise: (id: string, body: Record<string, unknown>) => call<InstitutionContentRequest>(`/institutions/me/content/requests/${encodeURIComponent(id)}/revise`, json("POST", body)),
  approve: (id: string, message = "Approved") => call<InstitutionContentRequest>(`/institutions/me/content/requests/${encodeURIComponent(id)}/approve`, json("POST", { message })),
  reject: (id: string, message: string) => call<InstitutionContentRequest>(`/institutions/me/content/requests/${encodeURIComponent(id)}/reject`, json("POST", { message })),
  withdraw: (id: string, message = "Request withdrawn") => call<InstitutionContentRequest>(`/institutions/me/content/requests/${encodeURIComponent(id)}/withdraw`, json("POST", { message })),
  publish: (id: string, destinations: PublishDestination[], scheduledAt?: string, complete = true) => call(`/institutions/me/content/requests/${encodeURIComponent(id)}/publish`, json("POST", { destinations, scheduledAt, complete })),
  createPost: (body: Record<string, unknown>) => call<{ posts: any[]; count: number }>("/institutions/me/content/posts", json("POST", body)),
  drafts: () => call<any[]>("/institutions/me/content/drafts"),
  saveDraft: (body: Record<string, unknown>) => call<any>("/institutions/me/content/drafts", json("POST", body)),
  deleteDraft: (id: string) => call(`/institutions/me/content/drafts/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
