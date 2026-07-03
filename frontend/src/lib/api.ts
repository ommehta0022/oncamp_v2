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
  accountType?: AccountRole;
  roles?: AccountRole[];
  verified?: boolean;
  canCreatePosts?: boolean;
  canCreateGroups?: boolean;
};

export type FeedPostDto = {
  id: string;
  title?: string;
  content: string;
  imageUrl?: string;
  mediaUrl?: string;
  createdAt: string;
  pinned?: boolean;
  announcement?: boolean;
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
      request<{ challengeId: string; expiresInSeconds: number; message: string }>("/auth/otp/start", {
        method: "POST",
        auth: false,
        body: { phone },
      }),
    verifyOtp: (challengeId: string, firebaseIdToken: string) =>
      request<{ accessToken: string; refreshToken: string; userId: string; isNewUser: boolean; user?: SessionUser }>("/auth/otp/verify", {
        method: "POST",
        auth: false,
        body: { challengeId, firebaseIdToken },
      }),
    verifyOtpDev: (phone: string, code: string) =>
      request<{ accessToken: string; refreshToken: string; userId: string; isNewUser: boolean; user?: SessionUser }>("/auth/otp/verify-dev", {
        method: "POST",
        auth: false,
        body: { phone, code },
      }),
    verifyFirebaseIdToken: (firebaseIdToken: string) =>
      request<{ accessToken: string; refreshToken: string; user: SessionUser }>("/auth/otp/verify", {
        method: "POST",
        auth: false,
        body: { firebaseIdToken, platform: Platform.OS },
      }),
    me: () => request<SessionUser>("/auth/me"),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
  },
  users: {
    me: () => request<SessionUser>("/users/me"),
    updateMe: (body: Partial<SessionUser>) => request<SessionUser>("/users/me", { method: "PATCH", body }),
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
    joinRequests: (groupId: string) => request(`/groups/${groupId}/join-requests`),
    approveJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/approve`, { method: "POST" }),
    rejectJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/reject`, { method: "POST" }),
  },
  institutions: {
    register: (body: unknown) => request("/institutions/register", { method: "POST", auth: false, body }),
    dashboard: () => request("/institutions/me/dashboard"),
  },
  notifications: {
    list: () => request("/notifications"),
    registerDevice: (pushToken: string, platform = Platform.OS) =>
      request("/notifications/register-device", { method: "POST", body: { pushToken, platform } }),
  },
};
