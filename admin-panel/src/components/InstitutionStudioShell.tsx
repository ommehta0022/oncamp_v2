"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { clearStudioSession, hasStudioSession, institutionStudioApi } from "@/lib/institutionStudioApi";

const navigation = [
  { key: "dashboard", name: "Dashboard", href: "/studio", icon: LayoutDashboard },
  { key: "profile", name: "Profile", href: "/studio/profile", icon: Building2 },
  { key: "content", name: "Content", href: "/studio/content", icon: FileText },
  { key: "groups", name: "Groups", href: "/studio/operations#groups", icon: UsersRound },
  { key: "departments", name: "Departments", href: "/studio/operations#groups", icon: Building2 },
  { key: "events", name: "Events", href: "/studio/operations#events", icon: CalendarDays },
  { key: "opportunities", name: "Opportunities", href: "/studio/operations#events", icon: GraduationCap },
  { key: "students", name: "Students", href: "/studio/operations#people", icon: Users },
  { key: "faculty", name: "Faculty", href: "/studio/operations#people", icon: GraduationCap },
  { key: "campus", name: "Campus", href: "/studio/operations#campus", icon: MapPin },
  { key: "analytics", name: "Analytics", href: "/studio/governance#analytics", icon: BarChart3 },
  { key: "moderation", name: "Moderation", href: "/studio/governance#moderation", icon: ShieldCheck },
  { key: "governance", name: "Governance", href: "/studio/governance", icon: ShieldCheck },
  { key: "integrations", name: "Integrations", href: "/studio/governance#integrations", icon: Settings },
];

export default function InstitutionStudioShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [institution, setInstitution] = useState<any>(null);
  const [hash, setHash] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    if (!hasStudioSession()) { router.replace("/studio/login"); return; }
    void institutionStudioApi.bundle()
      .then((data) => setInstitution(data?.institution || null))
      .catch(() => { clearStudioSession(); router.replace("/studio/login"); })
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
    setCreateOpen(false);
    setUserOpen(false);
    const sync = () => setHash(window.location.hash.replace("#", ""));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? navigation.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 8) : [];
  }, [query]);

  const activeKey = useMemo(() => {
    if (pathname === "/studio") return "dashboard";
    if (pathname.startsWith("/studio/profile")) return "profile";
    if (pathname.startsWith("/studio/content")) return "content";
    if (pathname.startsWith("/studio/operations")) {
      if (hash === "events") return "events";
      if (hash === "people") return "students";
      if (hash === "campus") return "campus";
      return "groups";
    }
    if (pathname.startsWith("/studio/governance")) {
      if (hash === "analytics") return "analytics";
      if (hash === "moderation") return "moderation";
      if (hash === "integrations") return "integrations";
      return "governance";
    }
    return "";
  }, [pathname, hash]);

  function signOut() { clearStudioSession(); router.replace("/studio/login"); }

  function clickFeedback(event: React.MouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest("button,a") as HTMLElement | null;
    if (!target) return;
    target.classList.add("studio-click-feedback");
    window.setTimeout(() => target.classList.remove("studio-click-feedback"), 180);
  }

  if (checking) return <div className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="mt-4 text-sm text-slate-500">Opening Institution Studio…</p></div></div>;

  const sidebar = <div className="flex h-full min-w-0 flex-col bg-[#061a33] text-white">
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
      <Link href="/studio" className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><div className="truncate text-lg font-black tracking-tight">OnCampus</div><div className="truncate text-[10px] font-semibold text-blue-200">Institution Studio</div></div></Link>
      <button aria-label="Close navigation" className="shrink-0 rounded-lg p-2 hover:bg-white/10 min-[1440px]:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
    </div>
    <div className="border-b border-white/10 p-3"><div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-xs font-bold">{institution?.name || "Institution"}</div><div className="truncate text-[10px] text-slate-400">{[institution?.type, institution?.city].filter(Boolean).join(" · ") || "Campus workspace"}</div></div><ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" /></div></div></div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-3">{navigation.map((item) => {
      const Icon = item.icon;
      const active = activeKey === item.key || (item.key === "departments" && activeKey === "groups") || (item.key === "opportunities" && activeKey === "events") || (item.key === "faculty" && activeKey === "students");
      return <Link key={item.key} href={item.href} onMouseEnter={() => { router.prefetch(item.href.split("#")[0]); void institutionStudioApi.prefetchBundle(); }} onClick={() => setMobileOpen(false)} className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 truncate">{item.name}</span></Link>;
    })}</nav>
    <div className="border-t border-white/10 p-3"><button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><LogOut className="h-4 w-4" />Sign out</button></div>
  </div>;

  return <div className="studio-responsive min-h-[100dvh] bg-[#f8fafc] text-slate-900" onClickCapture={clickFeedback}>
    {mobileOpen ? <div className="fixed inset-0 z-50 min-[1440px]:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[min(20rem,88vw)] max-w-full shadow-2xl">{sidebar}</aside></div> : null}
    <aside className="studio-sidebar-desktop fixed inset-y-0 left-0 z-40 hidden w-64">{sidebar}</aside>
    <div className="studio-main-offset min-w-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-16 min-w-0 items-center gap-2 px-3 py-2 sm:px-4 lg:px-5 xl:px-6">
          <button onClick={() => setMobileOpen(true)} className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 min-[1440px]:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <div className="hidden min-w-[190px] max-w-[260px] shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 lg:flex"><Building2 className="h-4 w-4 text-blue-600" /><span className="min-w-0 flex-1 truncate text-xs font-bold">{institution?.name || "Institution"}</span><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></div>
          <div className="relative mx-auto min-w-0 max-w-2xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students, content, groups, and more…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-12 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
            <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 sm:block">⌘ K</span>
            {searchResults.length ? <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{searchResults.map((item) => <Link key={item.key} href={item.href} onClick={() => setQuery("")} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><item.icon className="h-4 w-4" />{item.name}</Link>)}</div> : null}
          </div>
          <button aria-label="Notifications" title="Notifications are managed in the mobile app and institution broadcasts" className="hidden shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 sm:block"><Bell className="h-4 w-4" /></button>
          <div className="relative shrink-0">
            <button onClick={() => { setCreateOpen((v) => !v); setUserOpen(false); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3.5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Create</span><ChevronDown className="h-3.5 w-3.5" /></button>
            {createOpen ? <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><CreateLink href="/studio/content" label="Announcement / broadcast" icon={FileText} /><CreateLink href="/studio/operations#groups" label="Group / department" icon={UsersRound} /><CreateLink href="/studio/operations#events" label="Event / opportunity" icon={CalendarDays} /><CreateLink href="/studio/profile" label="Profile media / story" icon={Building2} /></div> : null}
          </div>
          <div className="relative shrink-0">
            <button onClick={() => { setUserOpen((v) => !v); setCreateOpen(false); }} className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 hover:bg-slate-50"><div className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-[10px] font-black text-white">A</div><div className="hidden text-left lg:block"><div className="text-xs font-bold">Admin</div><div className="text-[10px] text-slate-400">Institution administrator</div></div><ChevronDown className="h-3.5 w-3.5 text-slate-400" /></button>
            {userOpen ? <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"><Link href="/studio/profile" className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Institution profile</Link><button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sign out</button></div> : null}
          </div>
        </div>
      </header>
      <main className="min-w-0 p-3 sm:p-4 md:p-5 xl:p-6"><div className="studio-content-frame mx-auto w-full min-w-0 max-w-[1840px]">{children}</div></main>
    </div>
  </div>;
}

function CreateLink({ href, label, icon: Icon }: { href: string; label: string; icon: any }) {
  return <Link href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700"><Icon className="h-4 w-4" />{label}</Link>;
}
