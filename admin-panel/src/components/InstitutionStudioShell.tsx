"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronLeft,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
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
      .catch(() => router.replace("/studio/login"))
      .finally(() => setChecking(false));
  }, [router]);

  if (checking) return <div className="min-h-screen bg-slate-50 grid place-items-center"><div className="text-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 mx-auto" /><p className="mt-4 text-sm text-slate-500">Opening Institution Studio…</p></div></div>;

  const sidebar = <div className="flex h-full flex-col bg-[#071A34] text-white">
    <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
      <Link href="/studio" className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600"><Building2 className="h-5 w-5" /></div><div><div className="font-bold tracking-tight">OnCampus</div><div className="text-[10px] text-blue-200">Institution Studio</div></div></Link>
      <button className="lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
    </div>
    <div className="border-b border-white/10 px-5 py-4"><div className="text-xs text-slate-400">Managing</div><div className="mt-1 line-clamp-2 text-sm font-semibold">{institution?.name || "Institution"}</div><div className="mt-1 text-xs text-blue-200">{[institution?.type, institution?.city].filter(Boolean).join(" · ")}</div></div>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">{navigation.map((item) => { const Icon = item.icon; const active = item.href === "/studio" ? pathname === "/studio" : pathname?.startsWith(item.href.split("#")[0]); return <Link key={item.name} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4.5 w-4.5" />{item.name}</Link>; })}</nav>
    <div className="border-t border-white/10 p-3"><button onClick={() => { clearStudioSession(); router.replace("/studio/login"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10"><LogOut className="h-4 w-4" />Sign out</button></div>
  </div>;

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-72">{sidebar}</aside></div> : null}
    <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-7"><div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button><div><div className="text-sm font-semibold">{institution?.name || "Institution Studio"}</div><div className="text-[11px] text-slate-500">Live campus management</div></div></div><div className="flex items-center gap-2"><Link href="/studio/profile" className="hidden rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:block">Edit public profile</Link><button onClick={() => { clearStudioSession(); router.replace("/studio/login"); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out"><LogOut className="h-5 w-5" /></button></div></header>
      <main className="p-4 lg:p-7">{children}</main>
    </div>
  </div>;
}
