export type InstitutionRecord = {
  id?: string;
  name?: string;
  domain?: string;
  city?: string;
  state?: string;
  country?: string;
  institution_type?: string;
  institutionType?: string;
  description?: string;
  website?: string;
  phone?: string;
  logo_url?: string;
  logoUrl?: string;
  cover_url?: string;
  coverUrl?: string;
  status?: string;
  verified_at?: string;
  verifiedAt?: string;
  verification_policy?: Record<string, any>;
  verificationPolicy?: Record<string, any>;
};

export type InstitutionDashboardData = {
  institution?: InstitutionRecord | null;
  role?: string | null;
  counts?: {
    posts?: number;
    groups?: number;
    members?: number;
    verificationRequests?: number;
    postRequests?: number;
  };
  recentPosts?: any[];
  groups?: any[];
  verificationRequests?: any[];
  pendingVerification?: boolean;
};

export type InstitutionAnalyticsData = {
  institution?: InstitutionRecord | null;
  counts?: {
    reach?: number;
    members?: number;
    groups?: number;
    posts?: number;
    engagements?: number;
    approvalRate?: number;
  };
  topGroups?: any[];
  topPosts?: any[];
};

export const DEFAULT_POLICY = {
  publicPage: true,
  autoApproveStudents: false,
  allowExternalRequests: true,
  membersCanCreateGroups: false,
  verifiedBadgeVisible: true,
  weeklyDigest: true,
  brandPalette: "Moss",
  rolePermissions: {
    owner: ["manage_profile", "manage_admins", "billing", "moderation", "analytics"],
    admin: ["manage_profile", "moderation", "analytics"],
    content_admin: ["moderation", "analytics"],
    moderator: ["moderation"],
  },
  contentFilters: [] as string[],
  slowMode: { enabled: false, seconds: 30 },
  pushChannels: { critical: true, reports: true, weeklyDigest: true },
  twoFactorRequired: false,
  billing: { plan: "free", paymentContactEmail: "", invoiceName: "", invoices: [] as any[] },
  danger: {} as Record<string, any>,
};

export type InstitutionPolicy = typeof DEFAULT_POLICY & Record<string, any>;

export type InstitutionSettingsData = {
  institution?: InstitutionRecord | null;
  request?: any;
  pendingVerification?: boolean;
  policy?: InstitutionPolicy;
  counts?: {
    posts?: number;
    groups?: number;
    members?: number;
    reports?: number;
  };
  activity?: any[];
  reports?: any[];
  bannedUsers?: any[];
  billing?: {
    plan?: string;
    status?: string;
    paymentContactEmail?: string;
    invoiceName?: string;
    invoices?: any[];
  };
};

export const BRAND_PALETTES = [
  { name: "Moss", primary: "#2E5C4E", secondary: "#E87A5D" },
  { name: "Ocean", primary: "#1F4B6E", secondary: "#F4A261" },
  { name: "Sunset", primary: "#C0392B", secondary: "#F1C40F" },
  { name: "Forest", primary: "#264653", secondary: "#2A9D8F" },
  { name: "Berry", primary: "#6A2C70", secondary: "#F08A5D" },
  { name: "Slate", primary: "#3D3D3D", secondary: "#E63946" },
];

export function getPolicy(institution?: InstitutionRecord | null) {
  return {
    ...DEFAULT_POLICY,
    ...(institution?.verification_policy || institution?.verificationPolicy || {}),
  };
}

export function getPalette(institution?: InstitutionRecord | null, selectedName?: string) {
  const name = selectedName || getPolicy(institution).brandPalette;
  return BRAND_PALETTES.find((palette) => palette.name === name) || BRAND_PALETTES[0];
}

export function getLogoUrl(institution?: InstitutionRecord | null) {
  return institution?.logo_url || institution?.logoUrl || "";
}

export function getCoverUrl(institution?: InstitutionRecord | null) {
  return institution?.cover_url || institution?.coverUrl || "";
}

export function getInstitutionName(institution?: InstitutionRecord | null, requests: any[] = []) {
  return institution?.name || requests[0]?.institution_name || "Institution pending setup";
}

export function getInstitutionSubtitle(institution?: InstitutionRecord | null) {
  const parts = [institution?.city, institution?.state, institution?.country].filter(Boolean);
  if (parts.length) return parts.join(" - ");
  return institution?.domain || "Complete institution details";
}

export function getInstitutionType(institution?: InstitutionRecord | null) {
  return institution?.institution_type || institution?.institutionType || "Institution";
}

export function isVerified(institution?: InstitutionRecord | null) {
  const status = String(institution?.status || "").toLowerCase();
  return Boolean(institution?.verified_at || institution?.verifiedAt || status === "approved" || status === "verified");
}

export function statusLabel(institution?: InstitutionRecord | null) {
  if (isVerified(institution)) return "VERIFIED";
  return String(institution?.status || "PENDING").toUpperCase();
}

export function formatNumber(value?: number | null) {
  return Number(value || 0).toLocaleString();
}

export function formatPercent(value?: number | null) {
  const number = Number(value || 0);
  return `${Math.round(number)}%`;
}

export function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatShortDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatAgo(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function normalizeRole(role?: string | null) {
  if (!role) return "Admin";
  return role
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function makeChartValues(total: number, groups: any[] = []) {
  const groupValues = groups.map((group) => Number(group.members || group.memberCount || 0)).filter((value) => value > 0);
  const seed = groupValues.length ? groupValues : [total || 1];
  const values = Array.from({ length: 12 }, (_, index) => {
    const base = seed[index % seed.length] || 1;
    const ramp = (index + 1) / 12;
    return Math.max(12, Math.min(100, Math.round((base / Math.max(...seed, 1)) * 70 + ramp * 30)));
  });
  values[values.length - 1] = Math.max(values[values.length - 1], 86);
  return values;
}
