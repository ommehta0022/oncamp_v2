import { FeedPostDto, GroupDto, NotificationDto, SessionUser } from "@/src/lib/api";

export function asArray<T>(value: T[] | { items?: T[]; groups?: T[]; posts?: T[]; feed?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.items || value.groups || value.posts || value.feed || [];
}

export function formatWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const elapsed = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return "Just now";
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}m`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}h`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}d`;
  return date.toLocaleDateString();
}

export function normalizeUser(user: SessionUser | any) {
  const institution = typeof user?.institution === "string" ? user.institution : user?.institution?.name;
  return {
    ...user,
    id: user?.id || user?.userId || "",
    name: user?.name || "OnCampus user",
    avatar: user?.avatar || user?.avatarUrl || user?.avatar_url || null,
    avatarUrl: user?.avatarUrl || user?.avatar || user?.avatar_url || null,
    verified: Boolean(user?.verified),
    institution: institution || user?.city || "",
    badge: user?.badge || (user?.accountType === "institution_admin" || user?.account_type === "institution_admin" ? "official" : undefined),
  };
}

export function normalizePost(post: FeedPostDto | any) {
  const author = normalizeUser(post?.author || post?.user || {});
  const counts = post?.counts || {};
  return {
    ...post,
    id: String(post?.id || ""),
    content: post?.content || "",
    author,
    image: post?.image || post?.mediaUrl || post?.imageUrl || null,
    mediaUrl: post?.mediaUrl || post?.imageUrl || post?.image || null,
    likes: Number(post?.likes ?? post?.reactions ?? counts.reactions ?? 0),
    comments: Number(post?.comments ?? counts.comments ?? 0),
    reposts: Number(post?.reposts ?? counts.reposts ?? 0),
    liked: Boolean(post?.liked || post?.userReaction),
    bookmarked: Boolean(post?.bookmarked || post?.saved),
    createdAt: formatWhen(post?.createdAt || post?.created_at || post?.publishedAt),
  };
}

export function normalizeGroup(group: GroupDto | any) {
  const institution = typeof group?.institution === "string" ? group.institution : group?.institution?.name;
  const memberCount = Number(group?.memberCount ?? group?.members ?? group?.member_count ?? 0);
  const official = Boolean(group?.official ?? group?.verified ?? group?.isOfficial);
  return {
    ...group,
    id: String(group?.id || ""),
    name: group?.name || group?.title || "Group",
    title: group?.title || group?.name || "Group",
    image: group?.image || group?.avatarUrl || group?.avatar_url || null,
    avatarUrl: group?.avatarUrl || group?.image || group?.avatar_url || null,
    members: memberCount,
    memberCount,
    membersText: `${memberCount.toLocaleString()} members`,
    category: group?.category || "Community",
    city: group?.city || institution || "",
    institution: institution || group?.institutionName || "",
    verified: official,
    official,
    visibility: group?.visibility || "public",
    unread: Number(group?.unread || 0),
    pinned: Boolean(group?.pinned),
    muted: Boolean(group?.muted || group?.mutedAt || group?.muted_at),
    lastMessage: group?.lastMessage || group?.last_message || group?.description || "",
    lastMessageAt: formatWhen(group?.lastMessageAt || group?.last_message_at),
  };
}

export function normalizeNotification(notification: NotificationDto | any) {
  return {
    ...notification,
    id: String(notification?.id || ""),
    title: notification?.title || "Notification",
    body: notification?.body || notification?.message || "",
    avatar: notification?.avatar || notification?.actor?.avatarUrl || notification?.data?.avatarUrl || null,
    read: Boolean(notification?.read ?? notification?.read_at),
    createdAt: formatWhen(notification?.createdAt || notification?.created_at),
  };
}
