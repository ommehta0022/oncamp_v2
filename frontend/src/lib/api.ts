import { supabase } from "./supabase";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { DeviceEventEmitter, Platform } from "react-native";

// Lightweight translation helper until a full localization catalog is added.
export const i18n = {
  t: (key: string) => key,
  locale: "en",
  setLocale: (l: string) => { i18n.locale = l; },
};

const ACCESS_TOKEN_KEY = "oncampus.access_token";
const REFRESH_TOKEN_KEY = "oncampus.refresh_token";
const DEVICE_ID_KEY = "oncampus.device_id";
const USER_CACHE_KEY = "oncampus.user";
const ROLE_CACHE_KEY = "oncampus.role";
export const SESSION_EXPIRED_EVENT = "onSessionExpired";

let sessionExpiredNoticeShown = false;

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
  suppressSessionExpiredModal?: boolean;
};

const DEFAULT_TIMEOUT_MS = 15000;

export type ApiErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    public readonly requestId?: string,
    public readonly fieldErrors?: Record<string, string>,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getUserErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (!(error instanceof Error)) return fallback;
  return error.message || fallback;
}

// DTO Interfaces
export interface MessageDto {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  type: "text" | "image" | "file";
  mediaUrl?: string;
  createdAt: string;
  clientMessageId?: string;
}

export interface CommentDto {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  targetType: "post" | "user" | "group" | "message" | "application";
  targetId: string;
  reason: string;
  details?: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

export type CreateReportDto = Pick<ReportDto, "targetType" | "targetId" | "reason" | "details">;

export interface JoinRequestDto {
  id: string;
  groupId: string;
  userId: string;
  user: SessionUser;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface PostRequestDto {
  id: string;
  groupId: string;
  postData: Record<string, any>;
  authorId: string;
  author: SessionUser;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface MemberDto {
  groupId: string;
  userId: string;
  role: "owner" | "admin" | "moderator" | "member";
  joinedAt: string;
  user: SessionUser;
}

export interface InstitutionDto {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  verified: boolean;
  createdAt: string;
}

export interface SearchResultDto {
  groups: GroupDto[];
  users: SessionUser[];
  posts: FeedPostDto[];
}


const extra = Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  extra?.apiBaseUrl ||
  "https://perpetual-motivation-production-be1a.up.railway.app/v1";

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
  sessionExpiredNoticeShown = false;
  await Promise.all([
    setSecureItem(ACCESS_TOKEN_KEY, accessToken),
    setSecureItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

function emitSessionExpiredOnce() {
  if (sessionExpiredNoticeShown) return;
  sessionExpiredNoticeShown = true;

  if (Platform.OS !== "web") {
    DeviceEventEmitter.emit(SESSION_EXPIRED_EVENT);
  } else if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export async function clearSession(forceShowModal = true) {
  await Promise.all([
    deleteSecureItem(ACCESS_TOKEN_KEY),
    deleteSecureItem(REFRESH_TOKEN_KEY),
    AsyncStorage.removeItem("oncampus.authed"),
    AsyncStorage.removeItem(USER_CACHE_KEY),
    AsyncStorage.removeItem(ROLE_CACHE_KEY),
  ]);
  if (forceShowModal) emitSessionExpiredOnce();
}

export async function getAccessToken() {
  return getSecureItem(ACCESS_TOKEN_KEY);
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN_ERROR";
}

function fallbackForStatus(status: number) {
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "The requested information is no longer available.";
  if (status === 409) return "This information changed. Refresh and try again.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again.";
  return "We could not complete this request. Please try again.";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The request took too long. Check your connection and try again.", "TIMEOUT", undefined, undefined, undefined, true);
    }
    throw new ApiError("You appear to be offline. Check your connection and try again.", "NETWORK_ERROR", undefined, undefined, undefined, true);
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : data?.detail?.message;
    const message = detail || data?.message || data?.error?.message || fallbackForStatus(response.status);
    const requestId = response.headers.get("x-request-id") || data?.requestId || data?.request_id;
    throw new ApiError(
      message,
      codeForStatus(response.status),
      response.status,
      requestId || undefined,
      data?.fieldErrors || data?.field_errors,
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }

  return data as T;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const session = await parseResponse<{ accessToken: string; refreshToken: string }>(response);
      await saveSession(session.accessToken, session.refreshToken);
      return session.accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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

  const token = options.auth === false ? null : await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const execute = () => fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }, options.timeoutMs);

  const maxAttempts = method === "GET" ? 2 : 1;
  let response: Response | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await execute();
      if (response.status < 500 || attempt === maxAttempts - 1) break;
    } catch (error) {
      if (!(error instanceof ApiError) || !error.retryable || attempt === maxAttempts - 1) throw error;
    }
  }

  if (!response) throw new ApiError("We could not complete this request. Please try again.", "UNKNOWN_ERROR");

  if (response.status === 401 && options.auth !== false) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      headers.Authorization = `Bearer ${nextToken}`;
      return parseResponse<T>(await execute());
    }
    await clearSession(!options.suppressSessionExpiredModal);
    throw new ApiError("Your session has expired. Please log in again.", "UNAUTHENTICATED", 401);
  }

  return parseResponse<T>(response);
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
  email?: string;
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
  mediaType?: "image" | "video" | "document" | string;
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
  postType?: string;
  visibility?: "public" | "group" | "institution" | string;
  scheduledAt?: string;
  expiresAt?: string;
  userReaction?: string;
};

export type GroupDto = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  image?: string;
  city?: string;
  institutionId?: string;
  institution?: { id?: string; name?: string } | string;
  category: string;
  visibility: "public" | "private";
  official?: boolean;
  memberCount?: number;
  unread?: number;
  pinned?: boolean;
  muted?: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  role?: AccountRole | "owner" | "admin" | "member";
  postingMode?: string;
  joinPolicy?: string;
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
    health: () => request("/health", { auth: false }),
    featureFlags: () => request<Record<string, boolean>>("/settings/features", { auth: false }),
  },
  auth: {
    startOtp: (phone: string, action?: 'login' | 'register') =>
      request<StartOtpResponse>("/auth/otp/start", {
        method: "POST",
        auth: false,
        body: { phone, action },
      }),
    startInstitutionOtp: (identifier: string) =>
      request<StartOtpResponse>("/auth/institution/otp/start", {
        method: "POST",
        auth: false,
        body: { identifier },
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
    verifyOtpDev: async (phone: string, code: string) =>
      normalizeAuthSession(
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
      ),
    verifyInstitutionOtpDev: async (identifier: string, code: string) =>
      normalizeAuthSession(
        await request<{
          accessToken: string;
          refreshToken: string;
          userId?: string;
          isNewUser?: boolean;
          user?: SessionUser;
        }>("/auth/institution/otp/verify", {
          method: "POST",
          auth: false,
          body: { identifier, code, platform: Platform.OS },
        })
      ),

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
    logout: () => request<void>("/auth/logout", { method: "POST", suppressSessionExpiredModal: true }),
  },
  users: {
    me: () => request<SessionUser>("/users/me"),
    deleteMe: () => request("/users/me", { method: "DELETE" }),
    stats: () => request<{ groups: number; posts: number; followers: number; following: number }>("/users/me/stats"),
    updateMe: (body: Partial<SessionUser>) => request<SessionUser>("/users/me", { method: "PATCH", body }),
    settings: () => request("/users/me/settings"),
    updateSettings: (body: unknown) => request("/users/me/settings", { method: "PATCH", body }),
    notificationPreferences: () => request("/users/me/notification-preferences"),
    updateNotificationPreferences: (body: unknown) =>
      request("/users/me/notification-preferences", { method: "PATCH", body }),
    get: (userId: string) => request<SessionUser>(`/users/${userId}`),
    follow: (userId: string) => request(`/users/${userId}/follow`, { method: "POST" }),
    unfollow: (userId: string) => request(`/users/${userId}/follow`, { method: "DELETE" }),
    followers: (userId: string) => request<SessionUser[]>(`/users/${userId}/followers`),
    following: (userId: string) => request<SessionUser[]>(`/users/${userId}/following`),
    block: (userId: string) => request(`/users/${userId}/block`, { method: "POST" }),
    unblock: (userId: string) => request(`/users/${userId}/block`, { method: "DELETE" }),
    search: (query: string) => request<SessionUser[]>(`/search/users?q=${encodeURIComponent(query)}`),
    posts: (userId: string) => request<FeedPostDto[]>(`/users/${userId}/posts`),
    myPostRequests: () => request<PostRequestDto[]>("/users/me/post-requests"),
  },
  feed: {
    list: (page = 1, limit = 20) => request<{ feed?: FeedPostDto[]; posts?: FeedPostDto[]; hasMore?: boolean; total?: number }>(`/feed?page=${page}&limit=${limit}`),
    create: (body: unknown) => request<FeedPostDto>("/posts", { method: "POST", body }),
  },
  groups: {
    listMine: () => request<GroupDto[]>("/groups"),
    discover: (params = "") => request<{ groups?: GroupDto[] } | GroupDto[]>(`/discovery/groups${params}`),
    create: (body: unknown) => request<GroupDto>("/groups", { method: "POST", body }),
    get: (groupId: string) => request<GroupDto>(`/groups/${groupId}`),
    update: (groupId: string, body: unknown) => request<GroupDto>(`/groups/${groupId}`, { method: "PATCH", body }),
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
    unreadCount: (groupId: string) => request<{ unread: number }>(`/groups/${groupId}/messages/unread`),
    markRead: (groupId: string) => request(`/groups/${groupId}/messages/read`, { method: "POST" }),
    deleteMessage: (messageId: string) => request(`/messages/${messageId}`, { method: "DELETE" }),
    pinMessage: (messageId: string, pinned: boolean) => request(`/messages/${messageId}/pin`, { method: "POST", body: { pinned } }),
    sendMessage: (groupId: string, body: unknown) =>
      request(`/groups/${groupId}/messages`, { method: "POST", body }),
    members: (groupId: string) => request(`/groups/${groupId}/members`),
    joinRequests: (groupId: string) => request(`/groups/${groupId}/join-requests`),
    approveJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/approve`, { method: "POST" }),
    rejectJoinRequest: (groupId: string, requestId: string) =>
      request(`/groups/${groupId}/join-requests/${requestId}/reject`, { method: "POST" }),
    removeMember: (groupId: string, userId: string) => request(`/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
    updateMemberRole: (groupId: string, userId: string, role: string) => request(`/groups/${groupId}/members/${userId}`, { method: "PATCH", body: { role } }),
    muteGroup: (groupId: string) => request(`/groups/${groupId}/mute`, { method: "POST" }),
    unmuteGroup: (groupId: string) => request(`/groups/${groupId}/mute`, { method: "DELETE" }),
    pinGroup: (groupId: string) => request(`/groups/${groupId}/pin`, { method: "POST" }),
    unpinGroup: (groupId: string) => request(`/groups/${groupId}/pin`, { method: "DELETE" }),
    transferOwnership: (groupId: string, userId: string) => request(`/groups/${groupId}/transfer`, { method: "POST", body: { userId } }),
    searchMessages: (groupId: string, query: string) => request<MessageDto[]>(`/groups/${groupId}/messages/search?q=${encodeURIComponent(query)}`),
  },
  institutions: {
    register: (body: unknown) => request("/institutions/register", { method: "POST", body }),  // FIXED: Now requires auth
    dashboard: () => request("/institutions/me/dashboard"),
    analytics: () => request("/institutions/me/analytics"),
    settings: () => request("/institutions/me/settings"),
    updateSettings: (body: unknown) => request("/institutions/me/settings", { method: "PATCH", body }),
    exportData: () => request("/institutions/me/export"),
    updateMe: (body: unknown) => request("/institutions/me", { method: "PATCH", body }),
    admins: () => request("/institutions/me/admins"),
    inviteAdmin: (body: unknown) => request("/institutions/me/admins", { method: "POST", body }),
    updateAdmin: (adminId: string, body: unknown) => request(`/institutions/me/admins/${adminId}`, { method: "PATCH", body }),
    removeAdmin: (adminId: string) => request(`/institutions/me/admins/${adminId}`, { method: "DELETE" }),
    postRequest: (institutionId: string, body: unknown) => request(`/institutions/${institutionId}/post-requests`, { method: "POST", body }),
    postRequests: (institutionId: string) => request<PostRequestDto[]>(`/institutions/${institutionId}/post-requests`),
    approvePostRequest: (institutionId: string, requestId: string, targetGroupId: string) => request(`/institutions/${institutionId}/post-requests/${requestId}/approve`, { method: "POST", body: { target_group_id: targetGroupId } }),
    rejectPostRequest: (institutionId: string, requestId: string, reason?: string) => request(`/institutions/${institutionId}/post-requests/${requestId}/reject`, { method: "POST", body: { reason } }),
  },
  notifications: {
    list: () => request<NotificationDto[]>("/notifications"),
    markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
    markRead: (notificationId: string) => request(`/notifications/${notificationId}/read`, { method: "PATCH" }),
    registerDevice: (pushToken: string, platform = Platform.OS) =>
      request("/notifications/register-device", { method: "POST", body: { pushToken, platform } }),
    unreadCount: () => request<{ unread: number }>("/notifications/unread"),
    delete: (notificationId: string) => request(`/notifications/${notificationId}`, { method: "DELETE" }),
    updatePreferences: (body: unknown) => request("/notifications/preferences", { method: "PATCH", body }),
  },
  admin: {
    dashboard: () => request("/admin/dashboard"),
    clearCache: () => request("/admin/system/cache/clear", { method: "POST" }),
    resolveReport: (reportId: string, action: string) => request(`/admin/reports/${reportId}/resolve`, { method: "POST", body: { action } }),
    banUser: (userId: string, reason: string) => request(`/admin/users/${userId}/ban`, { method: "POST", body: { reason } }),
    unbanUser: (userId: string) => request(`/admin/users/${userId}/unban`, { method: "POST" }),
  },
  posts: {
    get: (postId: string) => request<FeedPostDto>(`/posts/${postId}`),
    edit: (postId: string, body: unknown) => request<FeedPostDto>(`/posts/${postId}`, { method: "PATCH", body }),
    delete: (postId: string) => request(`/posts/${postId}`, { method: "DELETE" }),
    pin: (postId: string) => request(`/posts/${postId}/pin`, { method: "POST" }),
    unpin: (postId: string) => request(`/posts/${postId}/pin`, { method: "DELETE" }),
    comments: (postId: string, limit = 50) => request(`/posts/${postId}/comments?limit=${limit}`),
    comment: (postId: string, content: string) =>
      request(`/posts/${postId}/comments`, { method: "POST", body: { content } }),
    editComment: (commentId: string, content: string) =>
      request(`/comments/${commentId}`, { method: "PATCH", body: { content } }),
    deleteComment: (commentId: string) =>
      request(`/comments/${commentId}`, { method: "DELETE" }),
    like: (postId: string) => request<{ liked: boolean; reactions: number }>(`/posts/${postId}/reaction`, { method: "POST" }),
    unlike: (postId: string) => request<{ liked: boolean; reactions: number }>(`/posts/${postId}/reaction`, { method: "DELETE" }),
    react: (postId: string, type: string) => request<{ liked: boolean; reactions: number; userReaction: string }>(`/posts/${postId}/reaction`, { method: "POST", body: { type } }),
    repost: (postId: string) => request<FeedPostDto>(`/posts/${postId}/repost`, { method: "POST" }),
    share: (postId: string) => request<{ shared: boolean }>(`/posts/${postId}/share`, { method: "POST" }),
    trackView: (postId: string) => request<{ viewed: boolean }>(`/posts/${postId}/view`, { method: "POST" }),
    reportComment: (commentId: string, body: unknown) => request(`/reports/comment/${commentId}`, { method: "POST", body }),
  },
  reports: {
    create: (body: CreateReportDto) => request<{ success: boolean }>("/reports", { method: "POST", body }),
    reportPost: (id: string, body: unknown) => request(`/reports/post/${id}`, { method: "POST", body }),
    reportGroup: (id: string, body: unknown) => request(`/reports/group/${id}`, { method: "POST", body }),
    reportUser: (id: string, body: unknown) => request(`/reports/user/${id}`, { method: "POST", body }),
    reportMessage: (id: string, body: unknown) => request(`/reports/message/${id}`, { method: "POST", body }),
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
    query: (q: string) => request<SearchResultDto>(`/search?q=${encodeURIComponent(q)}`),
    groups: (q: string) => request<GroupDto[]>(`/search/groups?q=${encodeURIComponent(q)}`),
    users: (q: string) => request<SessionUser[]>(`/search/users?q=${encodeURIComponent(q)}`),
    posts: (q: string) => request<FeedPostDto[]>(`/search/posts?q=${encodeURIComponent(q)}`),
  },

  media: {
    upload: async (formData: FormData) => {
      const token = await getAccessToken();
      const deviceId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/upload/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-device-id": deviceId,
        },
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json() as Promise<{ url: string }>;
    },
    uploadAvatar: async (formData: FormData) => {
      const token = await getAccessToken();
      const deviceId = await getDeviceId();
      const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-device-id": deviceId,
        },
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      return response.json() as Promise<{ url: string }>;
    },
  },
  uploadInstitutionLogo: async (formData: FormData) => {
    const token = await getAccessToken();
    const deviceId = await getDeviceId();
    const headers: Record<string, string> = { "x-device-id": deviceId };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/upload/institution-logo`, {
      method: "POST",
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Upload failed");
    }
    
    return response.json() as Promise<{ url: string; type: string }>;
  },
  uploadInstitutionCover: async (formData: FormData) => {
    const token = await getAccessToken();
    const deviceId = await getDeviceId();
    const headers: Record<string, string> = { "x-device-id": deviceId };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/upload/institution-cover`, {
      method: "POST",
      headers,
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
    const headers: Record<string, string> = { "x-device-id": deviceId };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/upload/institution-doc`, {
      method: "POST",
      headers,
      body: formData,
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Upload failed");
    }
    
    return response.json() as Promise<{ url: string; type: string }>;
  },
};

export function useRealtimeMessages(groupId: string, onNewMessage: (msg: any) => void) {
  useEffect(() => {
    const client = supabase;
    if (!groupId || !client) return;
    const channel = client.channel(`public:messages:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${groupId}` }, (payload: any) => onNewMessage(payload.new))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [groupId, onNewMessage]);
}

export function useRealtimeNotifications(userId: string, onNewNotification: (notif: any) => void) {
  useEffect(() => {
    const client = supabase;
    if (!userId || !client) return;
    const channel = client.channel(`public:notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload: any) => onNewNotification(payload.new))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [userId, onNewNotification]);
}

export function useRealtimeFeed(onNewPost: (post: any) => void) {
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload: any) => onNewPost(payload.new))
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [onNewPost]);
}
