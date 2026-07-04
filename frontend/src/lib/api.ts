import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "oncampus.access_token";
const REFRESH_TOKEN_KEY = "oncampus.refresh_token";
const DEVICE_ID_KEY = "oncampus.device_id";

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra?.apiBaseUrl ||
  "http://localhost:4000/v1";

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = uuid();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

async function getSecureItem(key: string) {
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key: string, value: string) {
  if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key: string) {
  if (Platform.OS === "web") return AsyncStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}

export async function saveSession(accessToken: string, refreshToken: string) {
  await Promise.all([
    setSecureItem(ACCESS_TOKEN_KEY, accessToken),
    setSecureItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearSession() {
  await Promise.all([
    deleteSecureItem(ACCESS_TOKEN_KEY),
    deleteSecureItem(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem("oncampus.authed"),
  ]);
}

export async function getAccessToken() {
  return getSecureItem(ACCESS_TOKEN_KEY);
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method || "GET";
  const deviceId = await getDeviceId();
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-device-id": deviceId,
    ...options.headers,
  };

  if (options.auth !== false) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : data?.detail?.message;
    const message = detail || data?.message || data?.error?.message || `API request failed: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export type AccountRole =
  | "normal_user"
  | "institution_admin"
  | "group_owner"
  | "group_admin"
  | "moderator"
  | "platform_admin";

export type SessionUser = {
  id: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  city?: string;
  course?: string;
  bio?: string;
  handle?: string;
  accountType?: AccountRole;
  roles?: AccountRole[];
  verified?: boolean;
  canCreatePosts?: boolean;
  canCreateGroups?: boolean;
  profileCompleted?: boolean;
  onboardingSkipped?: Record<string, boolean>;
  defaultAvatarKey?: string;
};

export type StartOtpResponse = {
  challengeId?: string;
  expiresInSeconds?: number;
  message?: string;
  success?: boolean;
  devMode?: boolean;
  devCode?: string | null;
};

export type AuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  isNewUser: boolean;
  user?: SessionUser;
};

function normalizeAuthSession(data: {
  accessToken: string;
  refreshToken: string;
  userId?: string;
  isNewUser?: boolean;
  user?: SessionUser;
}): AuthSessionResponse {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.userId || data.user?.id || "",
    isNewUser: Boolean(data.isNewUser),
    user: data.user,
  };
}

export type FeedPostDto = {
  id: string;
  title?: string;
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
  createdAt: string;
  pinned?: boolean;
  announcement?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  author?: {
    id: string;
    name?: string;
    avatarUrl?: string;
    verified?: boolean;
    badge?: string;
    institution?: string;
  };
  group?: { id: string; name: string };
  counts?: { reactions?: number; comments?: number; reposts?: number };
};

export type GroupDto = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  image?: string;
  city?: string;
  institution?: { id?: string; name?: string } | string;
  category: string;
  visibility: "public" | "private";
  official?: boolean;
  memberCount?: number;
  unread?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  role?: AccountRole | "owner" | "admin" | "member";
};

export const api = {
  platform: {
    settings: () =>
      request<{
        appName: string;
        supportEmail?: string;
        maintenanceMode: boolean;
        maintenanceMessage?: string;
        registrationEnabled?: boolean;
        groupCreationEnabled?: boolean;
        pushNotificationsEnabled?: boolean;
        emailNotificationsEnabled?: boolean;
      }>("/platform/settings", { auth: false }),
  },
  auth: {
    startOtp: (phone: string) =>
      request<StartOtpResponse>("/auth/otp/start", {
        method: "POST",
        auth: false,
        body: { phone },
      }),
    verifyOtp: async (challengeId: string, firebaseIdToken: string) =>
      normalizeAuthSession(
        await request<{
          accessToken: string;
          refreshToken: string;
          userId?: string;
          isNewUser?: boolean;
          user?: SessionUser;
        }>("/auth/otp/verify", {
          method: "POST",
          auth: false,
          body: { challengeId, firebaseIdToken, platform: Platform.OS },
        })
      ),
    verifyOtpDev: async (phone: string, code: string) => {
      try {
        return normalizeAuthSession(
          await request<{
            accessToken: string;
            refreshToken: string;
            userId?: string;
            isNewUser?: boolean;
            user?: SessionUser;
          }>("/auth/otp/verify-dev", {
            method: "POST",
            auth: false,
            body: { phone, code, platform: Platform.OS },
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const missingRoute =
          message.includes("404") ||
          message.includes("Not Found") ||
          message.includes("Cannot POST");
        if (!missingRoute) throw error;

        return normalizeAuthSession(
          await request<{
            accessToken: string;
            refreshToken: string;
            userId?: string;
            isNewUser?: boolean;
            user?: SessionUser;
          }>("/auth/otp/verify-code", {
            method: "POST",
            auth: false,
            body: { phone, code, platform: Platform.OS },
          })
        );
      }
    },
    verifyFirebaseIdToken: async (firebaseIdToken: string) =>
      normalizeAuthSession(
        await request<{
          accessToken: string;
          refreshToken: string;
          userId?: string;
          isNewUser?: boolean;
          user?: SessionUser;
        }>("/auth/otp/verify", {
          method: "POST",
          auth: false,
          body: { firebaseIdToken, platform: Platform.OS },
        })
      ),
    me: () => request<SessionUser>("/auth/me"),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },
  users: {
    me: () => request<SessionUser>("/users/me"),
    stats: () => request<{ groups: number; posts: number; followers: number; following: number }>("/users/me/stats"),
    updateMe: (body: Partial<SessionUser>) => request<SessionUser>("/users/me", { method: "PATCH", body }),
    settings: () => request("/users/me/settings"),
    updateSettings: (body: unknown) => request("/users/me/settings", { method: "PATCH", body }),
    notificationPreferences: () => request("/users/me/notification-preferences"),
    updateNotificationPreferences: (body: unknown) =>
      request("/users/me/notification-preferences", { method: "PATCH", body }),
  },
  feed: {
    list: () => request<{ feed?: FeedPostDto[]; posts?: FeedPostDto[] }>("/feed"),
    create: (body: unknown) => request<FeedPostDto>("/posts", { method: "POST", body }),
  },
  groups: {
    listMine: () => request<GroupDto[]>("/groups"),
    discover: (params = "") => request<{ groups?: GroupDto[] } | GroupDto[]>(`/discovery/groups${params}`),
    create: (body: unknown) => request<GroupDto>("/groups", { method: "POST", body }),
    get: (groupId: string) => request<GroupDto>(`/groups/${groupId}`),
    postRequest: (groupId: string, body: unknown) =>
      request(`/groups/${groupId}/post-requests`, { method: "POST", body }),
    postRequests: (groupId: string) => request(`/groups/${groupId}/post-requests`),
    approvePostRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/post-requests/${requestId}/approve`, { method: "POST" }),
    rejectPostRequest: (groupId: string, requestId: string, reason?: string) =>
      request(`/groups/${groupId}/post-requests/${requestId}/reject`, { method: "POST", body: { reason } }),
    join: (groupId: string) => request(`/groups/${groupId}/join`, { method: "POST" }),
    leave: (groupId: string) => request(`/groups/${groupId}/leave`, { method: "POST" }),
    messages: (groupId: string, limit = 50) => request(`/groups/${groupId}/messages?limit=${limit}`),
    sendMessage: (groupId: string, body: unknown) =>
      request(`/groups/${groupId}/messages`, { method: "POST", body }),
    members: (groupId: string) => request(`/groups/${groupId}/members`),
    joinRequests: (groupId: string) => request(`/groups/${groupId}/join-requests`),
    approveJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/approve`, { method: "POST" }),
    rejectJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/reject`, { method: "POST" }),
  },
  institutions: {
    register: (body: unknown) => request("/institutions/register", { method: "POST", body }),  // FIXED: Now requires auth
    dashboard: () => request("/institutions/me/dashboard"),
    analytics: () => request("/institutions/me/analytics"),
    updateMe: (body: unknown) => request("/institutions/me", { method: "PATCH", body }),
    admins: () => request("/institutions/me/admins"),
  },
  notifications: {
    list: () => request("/notifications"),
    markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
    markRead: (notificationId: string) => request(`/notifications/${notificationId}/read`, { method: "PATCH" }),
    registerDevice: (pushToken: string, platform = Platform.OS) =>
      request("/notifications/register-device", { method: "POST", body: { pushToken, platform } }),
  },
  posts: {
    get: (postId: string) => request(`/posts/${postId}`),
    comment: (postId: string, content: string) =>
      request(`/posts/${postId}/comments`, { method: "POST", body: { content } }),
    like: (postId: string) => request<{ liked: boolean; reactions: number }>(`/posts/${postId}/reaction`, { method: "POST" }),
    unlike: (postId: string) => request<{ liked: boolean; reactions: number }>(`/posts/${postId}/reaction`, { method: "DELETE" }),
  },
  saved: {
    list: () => request<FeedPostDto[]>("/saved-posts"),
    save: (postId: string) => request("/saved-posts", { method: "POST", body: { postId } }),
    remove: (postId: string) => request(`/saved-posts/${postId}`, { method: "DELETE" }),
  },
  blocked: {
    list: () => request<SessionUser[]>("/blocked-users"),
  },
  search: {
    query: (q: string) => request(`/search?q=${encodeURIComponent(q)}`),
  },
  uploadInstitutionLogo: async (formData: FormData) => {
    const token = await getAccessToken();
    const deviceId = await getDeviceId();
    const response = await fetch(`${API_BASE_URL}/upload/institution-logo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-device-id": deviceId,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Upload failed");
    }
    
    return response.json() as Promise<{ url: string; type: string }>;
  },
  uploadInstitutionDoc: async (formData: FormData) => {
    const token = await getAccessToken();
    const deviceId = await getDeviceId();
    const response = await fetch(`${API_BASE_URL}/upload/institution-doc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-device-id": deviceId,
      },
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Upload failed");
    }
    
    return response.json() as Promise<{ url: string; type: string }>;
  },
};
