import { FeedPostDto, GroupDto, NotificationDto, SessionUser } from "@/src/lib/api";

export function asArray<T = any>(payload: unknown, key?: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (key && Array.isArray((payload as any)?.[key])) return (payload as any)[key] as T[];
  return [];
}

export function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function normalizeUser(row: any): SessionUser {
  return {
    ...row,
    id: row?.id || row?.userId || "",
    name: row?.name || row?.displayName || row?.display_name,
    avatarUrl: row?.avatarUrl || row?.avatar_url || row?.avatar,
    city: row?.city,
    course: row?.course,
    bio: row?.bio,
    handle: row?.handle,
    verified: Boolean(row?.verified),
  };
}

export function normalizePost(row: any): FeedPostDto & {
  image?: string;
  likes: number;
  comments: number;
  reposts: number;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
    avatarUrl?: string | null;
    verified?: boolean;
    badge?: string;
    institution?: string;
  };
} {
  const author = row?.author || row?.user || {};
  const counts = row?.counts || {};

  return {
    ...row,
    id: row?.id,
    content: row?.content || row?.title || "",
    image: row?.image || row?.imageUrl || row?.mediaUrl || row?.media_url,
    imageUrl: row?.imageUrl || row?.image || row?.media_url,
    mediaUrl: row?.mediaUrl || row?.media_url,
    createdAt: formatWhen(row?.createdAt || row?.created_at || row?.published_at),
    pinned: Boolean(row?.pinned),
    announcement: Boolean(row?.announcement || row?.type === "announcement" || row?.postType === "announcement"),
    liked: Boolean(row?.liked || row?.userReaction),
    bookmarked: Boolean(row?.bookmarked || row?.saved),
    likes: Number(row?.likes ?? counts.reactions ?? row?.reactionCount ?? 0),
    comments: Number(row?.comments ?? counts.comments ?? row?.commentCount ?? 0),
    reposts: Number(row?.reposts ?? counts.reposts ?? row?.repostCount ?? 0),
    author: {
      id: author?.id || row?.authorId || row?.author_id || "",
      name: author?.name || author?.displayName || "User",
      avatar: author?.avatar || author?.avatarUrl || author?.avatar_url || null,
      avatarUrl: author?.avatarUrl || author?.avatar || author?.avatar_url || null,
      verified: Boolean(author?.verified),
      badge: author?.badge || author?.accountType || author?.account_type,
      institution: author?.institution || author?.institutionName || "",
    },
  };
}

export function normalizeGroup(row: any): GroupDto & {
  image?: string | null;
  institutionName: string;
  title: string;
  members: number;
  muted?: boolean;
  pinned?: boolean;
  verified?: boolean;
} {
  const institution =
    typeof row?.institution === "string"
      ? row.institution
      : row?.institution?.name || row?.institutionName || row?.city || "";
  const memberCount = Number(row?.memberCount ?? row?.member_count ?? row?.members ?? 0);

  return {
    ...row,
    id: row?.id,
    name: row?.name || row?.title || "Untitled group",
    title: row?.title || row?.name || "Untitled group",
    description: row?.description || "",
    avatarUrl: row?.avatarUrl || row?.avatar_url || row?.image || null,
    image: row?.image || row?.avatarUrl || row?.avatar_url || null,
    city: row?.city || "",
    institution,
    institutionName: institution,
    category: row?.category || "General",
    visibility: row?.visibility || "public",
    official: Boolean(row?.official || row?.verified),
    verified: Boolean(row?.verified || row?.official),
    memberCount,
    members: memberCount,
    unread: Number(row?.unread || 0),
    lastMessage: row?.lastMessage || row?.last_message || row?.description || "",
    lastMessageAt: formatWhen(row?.lastMessageAt || row?.last_message_at || row?.updatedAt || row?.updated_at || row?.createdAt || row?.created_at),
    role: row?.role,
    muted: Boolean(row?.muted),
    pinned: Boolean(row?.pinned),
  };
}

export function normalizeNotification(row: any): NotificationDto & {
  avatar?: string | null;
  targetId?: string;
  targetType?: string;
} {
  const data = row?.data || {};
  const read = typeof row?.read === "boolean" ? row.read : Boolean(row?.readAt || row?.read_at);

  return {
    ...row,
    id: row?.id,
    type: row?.type || data.type || "post",
    title: row?.title || "Notification",
    body: row?.body || row?.message || "",
    data,
    read,
    createdAt: formatWhen(row?.createdAt || row?.created_at),
    avatar: row?.avatar || data.avatarUrl || data.avatar_url || null,
    targetId: data.postId || data.post_id || data.groupId || data.group_id || data.userId || data.user_id,
    targetType: data.targetType || data.target_type || row?.type,
  };
}
