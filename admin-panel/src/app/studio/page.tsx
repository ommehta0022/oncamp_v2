"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";
import InstitutionStudioShell from "@/components/InstitutionStudioShell";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

export default function StudioDashboard() {
  const [bundle, setBundle] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [nextBundle, nextAnalytics, nextApprovals] = await Promise.all([
        institutionStudioApi.bundle(),
        institutionStudioApi.analytics().catch(() => ({})),
        institutionStudioApi.studentApprovals("pending").catch(() => []),
      ]);
      setBundle(nextBundle); setAnalytics(nextAnalytics); setApprovals(Array.isArray(nextApprovals) ? nextApprovals : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const institution = bundle?.institution || {};
  const stats = useMemo(() => [
    { label: "Followers", value: institution.followersCount || 0, icon: Users, accent: "blue" },
    { label: "Campus Groups", value: bundle?.groups?.length || 0, icon: UsersRound, accent: "violet" },
    { label: "Upcoming Events", value: bundle?.events?.length || 0, icon: CalendarDays, accent: "orange" },
    { label: "Opportunities", value: bundle?.opportunities?.length || 0, icon: Sparkles, accent: "emerald" },
    { label: "Pending Students", value: approvals.length, icon: ShieldCheck, accent: "amber" },
    { label: "Gallery Assets", value: bundle?.gallery?.length || 0, icon: ImageIcon, accent: "cyan" },
  ], [bundle, institution, approvals]);

  return <InstitutionStudioShell>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-sm font-bold uppercase tracking-[.15em] text-blue-600">Institution Studio</div><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{institution.name || "Campus Dashboard"}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Manage the complete student-facing campus experience and institution operations from one workspace.</p></div><div className="flex flex-wrap gap-2"><Link href="/studio/profile" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50">Edit public profile</Link><button onClick={() => void institutionStudioApi.publish().then(load)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700">Publish profile</button></div></div>

      {loading ? <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{stats.map((item) => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl bg-${item.accent}-50 text-${item.accent}-600`}><Icon className="h-5 w-5" /></div><span className="text-xs font-semibold text-emerald-600">Live</span></div><div className="mt-4 text-2xl font-black tracking-tight">{Number(item.value || 0).toLocaleString()}</div><div className="mt-1 text-xs font-medium text-slate-500">{item.label}</div></div>; })}</div>

        <div className="grid gap-5 2xl:grid-cols-[1.5fr_.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Campus Pulse</h2><p className="mt-1 text-xs text-slate-500">Current student-facing activity</p></div><Activity className="h-5 w-5 text-blue-600" /></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Pulse icon={CalendarDays} label="Events" value={`${bundle?.events?.length || 0} upcoming`} href="/studio/operations#events" /><Pulse icon={Megaphone} label="Announcements" value={`${bundle?.announcements?.length || 0} published`} href="/studio/content" /><Pulse icon={UsersRound} label="Groups" value={`${bundle?.groups?.length || 0} communities`} href="/studio/operations#groups" /><Pulse icon={Sparkles} label="Opportunities" value={`${bundle?.opportunities?.length || 0} active`} href="/studio/operations#events" /></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Upcoming events</h3><Link href="/studio/operations#events" className="text-xs font-bold text-blue-600">Manage</Link></div><div className="mt-3 space-y-3">{(bundle?.events || []).slice(0,4).map((event:any) => <div key={event.id} className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-xs font-black text-blue-700">{new Date(event.start_at).getDate()}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{event.title}</div><div className="mt-0.5 truncate text-xs text-slate-500">{event.location || new Date(event.start_at).toLocaleString()}</div></div></div>)}{!bundle?.events?.length ? <Empty text="No upcoming events" /> : null}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Pending student approvals</h3><Link href="/studio/operations#people" className="text-xs font-bold text-blue-600">Review</Link></div><div className="mt-3 space-y-3">{approvals.slice(0,4).map((item:any) => <div key={item.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{item.name || item.user?.display_name || item.user_id || "Student"}</div><div className="truncate text-xs text-slate-500">{item.department || item.program || item.status || "Pending verification"}</div></div><span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700">Pending</span></div>)}{!approvals.length ? <Empty text="Approval queue is clear" /> : null}</div></div></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Live Profile Preview</h2><p className="mt-1 text-xs text-slate-500">How students discover your campus</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LIVE</span></div><div className="mx-auto mt-5 max-w-[280px] overflow-hidden rounded-[2rem] border-[8px] border-slate-900 bg-white shadow-xl"><div className="h-32 bg-slate-100">{institution.coverUrl ? <img src={institution.coverUrl} alt="Campus cover" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-blue-100 to-indigo-100"><Building2 className="h-8 w-8 text-blue-600" /></div>}</div><div className="relative px-4 pb-5"><div className="-mt-8 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-blue-600">{institution.logoUrl ? <img src={institution.logoUrl} alt="Institution logo" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-white"><Building2 className="h-6 w-6" /></div>}</div><div className="mt-3 flex items-center gap-1"><div className="font-black">{institution.name || "Institution"}</div>{institution.verified ? <CheckCircle2 className="h-4 w-4 fill-blue-600 text-white" /> : null}</div><div className="mt-1 text-xs text-slate-500">{institution.tagline || institution.shortDescription || "Your campus story starts here."}</div><div className="mt-3 flex gap-4 text-xs"><b>{institution.followersCount || 0}</b><span className="text-slate-500">followers</span><b>{bundle?.groups?.length || 0}</b><span className="text-slate-500">groups</span></div><div className="mt-4 h-9 rounded-xl bg-blue-600 text-center text-xs font-bold leading-9 text-white">Follow</div></div></div></section>
        </div>

        <div className="grid gap-5 xl:grid-cols-3"><QuickPanel title="Content & Publishing" icon={FileText} items={[['Announcements', bundle?.announcements?.length || 0], ['Profile versions', bundle?.versions?.length || 0], ['Programs', bundle?.programs?.length || 0]]} href="/studio/content" /><QuickPanel title="Campus Structure" icon={Building2} items={[['Departments', bundle?.departments?.length || 0], ['Groups', bundle?.groups?.length || 0], ['Staff highlights', bundle?.staffHighlights?.length || 0]]} href="/studio/operations" /><QuickPanel title="Governance" icon={ShieldCheck} items={[['Storage assets', bundle?.mediaAssets?.length || 0], ['Moderation', analytics?.moderationOpen || analytics?.openReports || 0], ['Profile completeness', profileCompleteness(institution, bundle) + '%']]} href="/studio/governance" /></div>
      </>}
    </div>
  </InstitutionStudioShell>;
}

function Pulse({ icon: Icon, label, value, href }: any) { return <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div><div className="mt-3 text-sm font-bold">{label}</div><div className="mt-1 text-xs text-slate-500">{value}</div></Link>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-xs text-slate-400">{text}</div>; }
function QuickPanel({ title, icon: Icon, items, href }: any) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></div><h3 className="font-black">{title}</h3></div><Link href={href} className="text-xs font-bold text-blue-600">Manage</Link></div><div className="mt-4 divide-y divide-slate-100">{items.map(([name,value]:any) => <div key={name} className="flex items-center justify-between py-3 text-sm"><span className="text-slate-600">{name}</span><b>{value}</b></div>)}</div></section>; }
function profileCompleteness(institution:any,bundle:any) { const checks = [institution?.logoUrl,institution?.coverUrl,institution?.description,institution?.website,institution?.tagline,bundle?.story?.length,bundle?.gallery?.length,bundle?.departments?.length,bundle?.programs?.length,bundle?.groups?.length]; return Math.round((checks.filter(Boolean).length/checks.length)*100); }
