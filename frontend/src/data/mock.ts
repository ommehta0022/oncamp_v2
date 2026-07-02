// Mock data for OnCampus app - realistic institutional/campus content

export type User = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  institution: string;
  city: string;
  bio: string;
  role?: string;
  verified?: boolean;
  badge?: "student" | "admin" | "official" | "faculty";
};

export type Group = {
  id: string;
  name: string;
  description: string;
  image: string;
  institution: string;
  city: string;
  category: string;
  visibility: "public" | "private" | "official";
  members: number;
  memberLimit: number;
  createdBy: string;
  createdAt: string;
  unread?: number;
  lastMessage?: string;
  lastMessageAt?: string;
  pinned?: boolean;
  muted?: boolean;
  verified?: boolean;
  role?: "owner" | "admin" | "moderator" | "member";
};

export type Message = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  replyTo?: { id: string; senderName: string; content: string };
  pinned?: boolean;
  own?: boolean;
  status?: "sent" | "delivered" | "read";
  type?: "text" | "system" | "image";
  mediaUrl?: string;
};

export type FeedPost = {
  id: string;
  author: User;
  group?: { id: string; name: string };
  content: string;
  image?: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  liked?: boolean;
  bookmarked?: boolean;
  pinned?: boolean;
  announcement?: boolean;
};

export type Notification = {
  id: string;
  type: "mention" | "join" | "announcement" | "reply" | "approved" | "post";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  avatar?: string;
};

const AV = (n: number) =>
  [
    "https://images.unsplash.com/photo-1633112639964-f8c9d360dc75?w=200&q=80",
    "https://images.unsplash.com/photo-1619431667975-e93b820cde63?w=200&q=80",
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
    "https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80",
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80",
    "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&q=80",
  ][n % 10];

export const currentUser: User = {
  id: "u_me",
  name: "Aarav Sharma",
  handle: "@aarav.s",
  avatar: AV(0),
  institution: "IIT Bombay",
  city: "Mumbai",
  bio: "CSE '26 · Robotics Club · Building things that move.",
  verified: true,
  badge: "student",
};

export const users: User[] = [
  currentUser,
  { id: "u1", name: "Priya Nair", handle: "@priya.n", avatar: AV(1), institution: "IIT Bombay", city: "Mumbai", bio: "Mechanical '25", badge: "student", verified: true },
  { id: "u2", name: "Dr. Ramesh Iyer", handle: "@r.iyer", avatar: AV(2), institution: "IIT Bombay", city: "Mumbai", bio: "Professor, CSE Dept.", badge: "faculty", verified: true },
  { id: "u3", name: "Ananya Kapoor", handle: "@ananya", avatar: AV(3), institution: "IIT Bombay", city: "Mumbai", bio: "Design '24", badge: "student" },
  { id: "u4", name: "Kabir Mehta", handle: "@kabir.m", avatar: AV(4), institution: "IIT Bombay", city: "Mumbai", bio: "Physics '25", badge: "student" },
  { id: "u5", name: "Zara Fernandes", handle: "@zara.f", avatar: AV(5), institution: "St. Xavier's", city: "Mumbai", bio: "Literature", badge: "student" },
  { id: "u6", name: "Rohan Verma", handle: "@rohan.v", avatar: AV(6), institution: "IIT Bombay", city: "Mumbai", bio: "Robotics Club Lead", badge: "admin", verified: true },
  { id: "u7", name: "Meera Krishnan", handle: "@meera.k", avatar: AV(7), institution: "IIT Bombay", city: "Mumbai", bio: "AI Research", badge: "student", verified: true },
  { id: "u8", name: "Arjun Singh", handle: "@arjun.s", avatar: AV(8), institution: "IIT Bombay", city: "Mumbai", bio: "ECE '26", badge: "student" },
  { id: "u9", name: "IIT Bombay Official", handle: "@iitb", avatar: "https://images.unsplash.com/photo-1562774053-701939374585?w=200&q=80", institution: "IIT Bombay", city: "Mumbai", bio: "Official channel", badge: "official", verified: true },
];

const COVER = [
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=800&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80",
  "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
];

export const categories = [
  "All", "Official", "Batch", "Clubs", "Study", "Events", "Sports", "Tech", "Arts", "Career",
];

export const groups: Group[] = [
  {
    id: "g1", name: "CSE Batch of 2026", description: "Official batch group for Computer Science and Engineering, class of 2026. Notes, placements, life.",
    image: COVER[0], institution: "IIT Bombay", city: "Mumbai", category: "Batch",
    visibility: "private", members: 248, memberLimit: 300, createdBy: "u2", createdAt: "2023-08-01",
    unread: 12, lastMessage: "Priya: Anyone attending the placement session tomorrow?", lastMessageAt: "2m", pinned: true, verified: true, role: "member",
  },
  {
    id: "g2", name: "IITB Robotics Club", description: "Where wheels meet code. Building next-gen robots since 2001.",
    image: COVER[1], institution: "IIT Bombay", city: "Mumbai", category: "Clubs",
    visibility: "public", members: 512, memberLimit: 1000, createdBy: "u6", createdAt: "2022-01-15",
    unread: 3, lastMessage: "Rohan: New arm prototype v3 shipped! 🎉", lastMessageAt: "18m", verified: true, role: "admin",
  },
  {
    id: "g3", name: "Campus Announcements", description: "Official announcements from IIT Bombay administration.",
    image: COVER[2], institution: "IIT Bombay", city: "Mumbai", category: "Official",
    visibility: "official", members: 8420, memberLimit: 10000, createdBy: "u9", createdAt: "2020-01-01",
    unread: 1, lastMessage: "Semester exam schedule released", lastMessageAt: "1h", verified: true, role: "member", muted: true,
  },
  {
    id: "g4", name: "Mood Indigo Volunteers", description: "Volunteer coordination for Mood Indigo 2026 — Asia's largest college cultural fest.",
    image: COVER[3], institution: "IIT Bombay", city: "Mumbai", category: "Events",
    visibility: "public", members: 380, memberLimit: 500, createdBy: "u3", createdAt: "2024-11-01",
    unread: 0, lastMessage: "Ananya: Logistics meet moved to 6 PM Friday", lastMessageAt: "3h", role: "member",
  },
  {
    id: "g5", name: "Placement Prep 2026", description: "DSA, systems design, aptitude — daily practice and mocks.",
    image: COVER[4], institution: "IIT Bombay", city: "Mumbai", category: "Study",
    visibility: "private", members: 156, memberLimit: 200, createdBy: "u7", createdAt: "2024-06-10",
    unread: 24, lastMessage: "Meera: Sharing today's Leetcode contest sheet", lastMessageAt: "5h", role: "member",
  },
  {
    id: "g6", name: "IITB Photography", description: "Frames from campus and beyond. Weekly themed challenges.",
    image: COVER[5], institution: "IIT Bombay", city: "Mumbai", category: "Arts",
    visibility: "public", members: 224, memberLimit: 500, createdBy: "u5", createdAt: "2023-09-01",
    unread: 0, lastMessage: "Zara: Golden hour submissions closing tonight", lastMessageAt: "Yesterday", role: "member",
  },
  {
    id: "g7", name: "Basketball League", description: "Inter-hostel basketball league updates and coordination.",
    image: COVER[6], institution: "IIT Bombay", city: "Mumbai", category: "Sports",
    visibility: "public", members: 92, memberLimit: 150, createdBy: "u8", createdAt: "2024-02-01",
    unread: 0, lastMessage: "Arjun: H3 vs H8 tonight, 8 PM", lastMessageAt: "Yesterday", role: "member",
  },
  {
    id: "g8", name: "AI/ML Study Circle", description: "Papers, projects, and PyTorch. Deep dives every Sunday.",
    image: COVER[7], institution: "IIT Bombay", city: "Mumbai", category: "Tech",
    visibility: "public", members: 340, memberLimit: 500, createdBy: "u7", createdAt: "2023-11-15",
    unread: 0, lastMessage: "Meera: Transformers explained — Sunday 5 PM", lastMessageAt: "2d", role: "member",
  },
];

// Discover-only public groups
export const discoverGroups: Group[] = [
  ...groups.filter((g) => g.visibility !== "private" || g.category === "Official"),
  {
    id: "g9", name: "St. Xavier's Debate Society", description: "Where words duel with grace. Weekly parliamentary debates.",
    image: COVER[3], institution: "St. Xavier's", city: "Mumbai", category: "Clubs",
    visibility: "public", members: 128, memberLimit: 300, createdBy: "u5", createdAt: "2023-01-01",
  },
  {
    id: "g10", name: "Mumbai Campus Careers", description: "Cross-college job board and referral network.",
    image: COVER[4], institution: "Cross-institution", city: "Mumbai", category: "Career",
    visibility: "public", members: 2140, memberLimit: 5000, createdBy: "u2", createdAt: "2022-05-01", verified: true,
  },
];

export const messagesByGroup: Record<string, Message[]> = {
  g2: [
    { id: "m1", groupId: "g2", senderId: "u6", senderName: "Rohan Verma", senderAvatar: AV(6), content: "Team, quick sync — the arm prototype v3 shipped this morning 🎉", createdAt: "10:12 AM", pinned: true },
    { id: "m2", groupId: "g2", senderId: "u4", senderName: "Kabir Mehta", senderAvatar: AV(4), content: "Congrats! Torque numbers?", createdAt: "10:14 AM" },
    { id: "m3", groupId: "g2", senderId: "u6", senderName: "Rohan Verma", senderAvatar: AV(6), content: "Peak 42 Nm at the shoulder joint. Way over spec.", createdAt: "10:15 AM" },
    { id: "m4", groupId: "g2", senderId: "u_me", senderName: "Aarav Sharma", senderAvatar: AV(0), content: "That's insane. Any thermal issues under continuous load?", createdAt: "10:17 AM", own: true, status: "read" },
    { id: "m5", groupId: "g2", senderId: "u6", senderName: "Rohan Verma", senderAvatar: AV(6), content: "None so far. New passive heatsink design is holding.", createdAt: "10:20 AM", replyTo: { id: "m4", senderName: "Aarav Sharma", content: "That's insane. Any thermal issues under continuous load?" } },
    { id: "m6", groupId: "g2", senderId: "u7", senderName: "Meera Krishnan", senderAvatar: AV(7), content: "Can we demo at open house next Friday?", createdAt: "10:24 AM" },
    { id: "m7", groupId: "g2", senderId: "u6", senderName: "Rohan Verma", senderAvatar: AV(6), content: "Yes — locking it in. @Aarav can you handle the control demo?", createdAt: "10:26 AM" },
    { id: "m8", groupId: "g2", senderId: "u_me", senderName: "Aarav Sharma", senderAvatar: AV(0), content: "On it. Will have the pick-and-place routine ready by Wednesday.", createdAt: "10:28 AM", own: true, status: "delivered" },
    { id: "m9", groupId: "g2", senderId: "u3", senderName: "Ananya Kapoor", senderAvatar: AV(3), content: "I'll design the demo posters!", createdAt: "10:31 AM" },
  ],
  g1: [
    { id: "n1", groupId: "g1", senderId: "u1", senderName: "Priya Nair", senderAvatar: AV(1), content: "Anyone attending the placement prep session tomorrow?", createdAt: "9:42 AM" },
    { id: "n2", groupId: "g1", senderId: "u8", senderName: "Arjun Singh", senderAvatar: AV(8), content: "I'll be there. TA said it's on system design.", createdAt: "9:44 AM" },
    { id: "n3", groupId: "g1", senderId: "u_me", senderName: "Aarav Sharma", senderAvatar: AV(0), content: "Count me in.", createdAt: "9:45 AM", own: true, status: "read" },
  ],
};

export const feed: FeedPost[] = [
  {
    id: "p1",
    author: users[9],
    group: { id: "g3", name: "Campus Announcements" },
    content: "The semester end examination schedule has been released. All students are advised to review the timetable and reach out to the academic office for any conflicts by 5 December.",
    createdAt: "2h",
    likes: 342, comments: 48, reposts: 22, announcement: true, pinned: true,
  },
  {
    id: "p2",
    author: users[6],
    group: { id: "g2", name: "IITB Robotics Club" },
    content: "Just shipped the arm prototype v3. 42 Nm torque, passive thermal, and 8 degrees of freedom. Demo at Open House next Friday — you don't want to miss this one.",
    image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80",
    createdAt: "5h",
    likes: 128, comments: 24, reposts: 8, liked: true,
  },
  {
    id: "p3",
    author: users[2],
    content: "Reminder: Guest lecture by Dr. Sundaram on Quantum Computing this Thursday at 4 PM, LC 101. Open to all — do bring a notebook, there will be problem sets.",
    createdAt: "8h",
    likes: 210, comments: 12, reposts: 34,
  },
  {
    id: "p4",
    author: users[3],
    group: { id: "g4", name: "Mood Indigo Volunteers" },
    content: "Mood Indigo Volunteer sign-ups are open! We need coordinators for Design, Logistics, and Content. Link in bio, but seriously — join us. It'll change your semester.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80",
    createdAt: "1d",
    likes: 89, comments: 14, reposts: 5,
  },
  {
    id: "p5",
    author: users[7],
    content: "Sunday deep-dive on Transformers this week — from attention to production LLMs in 90 minutes. AI/ML Study Circle members priority, but bring a friend.",
    createdAt: "1d",
    likes: 156, comments: 21, reposts: 12, bookmarked: true,
  },
  {
    id: "p6",
    author: users[5],
    group: { id: "g6", name: "IITB Photography" },
    content: "Golden hour theme submissions close tonight at midnight. Frame the campus in your own light.",
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80",
    createdAt: "2d",
    likes: 74, comments: 8, reposts: 2,
  },
];

export const notifications: Notification[] = [
  { id: "n1", type: "mention", title: "Rohan mentioned you", body: "@Aarav can you handle the control demo?", createdAt: "10m", read: false, avatar: AV(6) },
  { id: "n2", type: "approved", title: "Join request approved", body: "Welcome to Placement Prep 2026", createdAt: "1h", read: false, avatar: COVER[4] },
  { id: "n3", type: "announcement", title: "Campus Announcements", body: "Semester exam schedule released", createdAt: "2h", read: false, avatar: COVER[2] },
  { id: "n4", type: "reply", title: "Priya replied", body: "See you at the session tomorrow", createdAt: "5h", read: true, avatar: AV(1) },
  { id: "n5", type: "post", title: "Ananya posted in Mood Indigo Volunteers", body: "Logistics meet moved to 6 PM Friday", createdAt: "6h", read: true, avatar: AV(3) },
  { id: "n6", type: "join", title: "Kabir joined CSE Batch of 2026", body: "Say hello to the new member", createdAt: "1d", read: true, avatar: AV(4) },
];

export const joinRequests = [
  { id: "r1", userId: "u4", name: "Kabir Mehta", avatar: AV(4), bio: "Physics '25 · Interested in robotics", requestedAt: "2h" },
  { id: "r2", userId: "u5", name: "Zara Fernandes", avatar: AV(5), bio: "Literature, St. Xavier's", requestedAt: "5h" },
  { id: "r3", userId: "u8", name: "Arjun Singh", avatar: AV(8), bio: "ECE '26 · Built line-following bot last sem", requestedAt: "1d" },
];

export const savedPosts = [feed[1], feed[4]];

export const blockedUsers: User[] = [];

export const onboardingSlides = [
  {
    title: "Your campus, in one feed",
    subtitle: "Announcements, clubs, and classmates — all in one place.",
    image: "https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80",
  },
  {
    title: "Discover groups worth joining",
    subtitle: "From batch chats to research circles — find your people.",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&q=80",
  },
  {
    title: "Communicate the campus way",
    subtitle: "Group-first messaging. No noise. No spam. Just what matters.",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80",
  },
];

export function getGroup(id: string) {
  return [...groups, ...discoverGroups].find((g) => g.id === id);
}
