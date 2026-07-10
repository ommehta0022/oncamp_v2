// I18n Stub
export const i18n = {
  t: (key: string) => key,
  locale: "en",
  setLocale: (l: string) => { i18n.locale = l; },
};

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
  targetType: "post" | "user" | "group" | "message";
  targetId: string;
  reason: string;
  details?: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

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
    let token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && options.auth !== false) {
    // Attempt token refresh
    try {
      const refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
        
        if (refreshRes.ok) {
          const { accessToken, refreshToken: newRefresh } = await refreshRes.json();
          await saveSession(accessToken, newRefresh);
          
          // Retry original request
          headers.Authorization = `Bearer ${accessToken}`;
          const retryRes = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });
          
          if (retryRes.status === 204) return undefined as T;
          const retryText = await retryRes.text();
          return (retryText ? JSON.parse(retryText) : null) as T;
        }
      }
    } catch (e) {
      // Ignore refresh errors and fall through to handle original 401
    }
    
    // Clear session on persistent 401
    await clearSession();
    throw new Error("Authentication failed");
  }

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
  postType?: string;
  userReaction?: string;
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
    search: (query: string) => request<SessionUser[]>(`/users/search?q=${encodeURIComponent(query)}`),
    posts: (userId: string) => request<FeedPostDto[]>(`/users/${userId}/posts`),
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
    searchMessages: (groupId: string, query: string) => request<MessageDto[]>(`/groups/${groupId}/messages/search?q=${encodeURIComponent(query)}`),
  },
  institutions: {
    register: (body: unknown) => request("/institutions/register", { method: "POST", body }),  // FIXED: Now requires auth
    dashboard: () => request("/institutions/me/dashboard"),
    analytics: () => request("/institutions/me/analytics"),
    updateMe: (body: unknown) => request("/institutions/me", { method: "PATCH", body }),
    admins: () => request("/institutions/me/admins"),
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
  posts: {
    get: (postId: string) => request(`/posts/${postId}`),
    edit: (postId: string, body: unknown) => request(`/posts/${postId}`, { method: "PATCH", body }),
    delete: (postId: string) => request(`/posts/${postId}`, { method: "DELETE" }),
    pin: (postId: string) => request(`/posts/${postId}/pin`, { method: "POST" }),
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

// Real-time hook stubs
import { useEffect } from "react";

export function useRealtimeMessages(groupId: string, onNewMessage: (msg: any) => void) {
  useEffect(() => {
    if (!groupId) return;
    // const channel = supabase.channel(`messages:${groupId}`).on('postgres_changes', ...).subscribe();
    // return () => supabase.removeChannel(channel);
  }, [groupId, onNewMessage]);
}

export function useRealtimeNotifications(userId: string, onNewNotification: (notif: any) => void) {
  useEffect(() => {
    if (!userId) return;
    // const channel = supabase.channel(`notifications:${userId}`).on('postgres_changes', ...).subscribe();
    // return () => supabase.removeChannel(channel);
  }, [userId, onNewNotification]);
}

export function useRealtimeFeed(onNewPost: (post: any) => void) {
  useEffect(() => {
    // const channel = supabase.channel('public:posts').on('postgres_changes', ...).subscribe();
    // return () => supabase.removeChannel(channel);
  }, [onNewPost]);
}
