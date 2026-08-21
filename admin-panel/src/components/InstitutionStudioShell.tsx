"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { clearStudioSession, hasStudioSession, institutionStudioApi } from "@/lib/institutionStudioApi";

const navigation = [
  { name: "Dashboard", href: "/studio", icon: LayoutDashboard },
  { name: "Profile & Story", href: "/studio/profile", icon: Building2 },
  { name: "Groups & Departments", href: "/studio/operations#groups", icon: UsersRound },
  { name: "Events & Opportunities", href: "/studio/operations#events", icon: CalendarDays },
  { name: "Content Studio", href: "/studio/content", icon: FileText },
  { name: "Students & Faculty", href: "/studio/operations#people", icon: GraduationCap },
  { name: "Analytics & Moderation", href: "/studio/governance#analytics", icon: BarChart3 },
  { name: "Governance & Integrations", href: "/studio/governance", icon: ShieldCheck },
];

export default function InstitutionStudioShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [institution, setInstitution] = useState<any>(null);

  useEffect(() => {
    if (!hasStudioSession()) {
      router.replace("/studio/login");
      return;
    }
    institutionStudioApi.bundle()
      .then((data) => setInstitution(data?.institution || null))
      .catch(() => {
        clearStudioSession();
        router.replace("/studio/login");
      })
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  if (checking) return <div className="grid min-h-[100dvh] place-items-center bg-slate-50 px-4"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="mt-4 text-sm text-slate-500">Opening Institution Studio…</p></div></div>;

  const sidebar = <div className="flex h-full min-w-0 flex-col bg-[#071A34] text-white">
    <div className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
      <Link href="/studio" className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-600"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><div className="truncate font-bold tracking-tight">OnCampus</div><div className="truncate text-[10px] text-blue-200">Institution Studio</div></div></Link>
      <button aria-label="Close navigation" className="shrink-0 rounded-lg p-2 hover:bg-white/10 xl:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
    </div>
    <div className="border-b border-white/10 px-4 py-4 sm:px-5"><div className="text-xs text-slate-400">Managing</div><div className="mt-1 line-clamp-2 break-words text-sm font-semibold">{institution?.name || "Institution"}</div><div className="mt-1 break-words text-xs text-blue-200">{[institution?.type, institution?.city].filter(Boolean).join(" · ")}</div></div>
    <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">{navigation.map((item) => {
      const Icon = item.icon;
      const route = item.href.split("#")[0];
      const active = item.href === "/studio" ? pathname === "/studio" : pathname?.startsWith(route);
      return <Link key={item.name} href={item.href} onClick={() => setMobileOpen(false)} className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4.5 w-4.5 shrink-0" /><span className="min-w-0 break-words">{item.name}</span></Link>;
    })}</nav>
    <div className="border-t border-white/10 p-3"><button onClick={() => { clearStudioSession(); router.replace("/studio/login"); }} className="flex w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10"><LogOut className="h-4 w-4 shrink-0" /><span>Sign out</span></button></div>
  </div>;

  return <div className="studio-responsive min-h-[100dvh] min-w-0 overflow-x-hidden bg-slate-50 text-slate-900">
    {mobileOpen ? <div className="fixed inset-0 z-50 xl:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[min(20rem,88vw)] max-w-full shadow-2xl">{sidebar}</aside></div> : null}
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 xl:block">{sidebar}</aside>
    <div className="min-w-0 xl:pl-64">
      <header className="sticky top-0 z-30 flex min-h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-4 md:px-5 xl:px-7">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button onClick={() => setMobileOpen(true)} className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-slate-100 xl:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button><div className="min-w-0"><div className="truncate text-sm font-semibold">{institution?.name || "Institution Studio"}</div><div className="truncate text-[11px] text-slate-500">Live campus management</div></div></div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2"><Link href="/studio/profile" className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:block">Edit public profile</Link><button onClick={() => { clearStudioSession(); router.replace("/studio/login"); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out"><LogOut className="h-5 w-5" /></button></div>
      </header>
      <main className="min-w-0 p-3 sm:p-4 md:p-5 xl:p-7"><div className="mx-auto w-full min-w-0 max-w-[1800px]">{children}</div></main>
    </div>
  </div>;
}
