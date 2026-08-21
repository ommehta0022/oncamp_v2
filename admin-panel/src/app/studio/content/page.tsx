"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  Megaphone,
  Send,
  Sparkles,
} from "lucide-react";
import InstitutionStudioShell from "@/components/InstitutionStudioShell";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

const blankAnnouncement = { title: "", body: "", priority: "normal", publishAt: "", expiresAt: "", targetType: "all", targetValue: "" };
const blankBroadcast = { title: "", body: "", targetType: "all", targetValue: "", push: true, inApp: true, scheduledAt: "" };

function target(type: string, value: string) {
  if (type === "all") return { type: "all" };
  if (type === "department") return { type: "department", department: value.trim() };
  if (type === "year") return { type: "year", year: value.trim() };
  return { type: "all" };
}

export default function StudioContentPage() {
  const [bundle, setBundle] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>(blankAnnouncement);
  const [broadcast, setBroadcast] = useState<any>(blankBroadcast);
  const [tab, setTab] = useState<"announcement" | "broadcast">("announcement");
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");

  async function load() {
    setBusy(true);
    try {
      const [b,a,br] = await Promise.all([
        institutionStudioApi.bundle(),
        institutionStudioApi.announcements().catch(() => []),
        institutionStudioApi.broadcasts().catch(() => []),
      ]);
      setBundle(b); setAnnouncements(a || []); setBroadcasts(br || []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load Content Studio."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  const scheduledCount = useMemo(() => announcements.filter((item) => item.status === "scheduled").length, [announcements]);
  const publishedCount = useMemo(() => announcements.filter((item) => item.status === "published").length, [announcements]);

  async function createAnnouncement() {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setBusy(true); setNotice("");
    try {
      await institutionStudioApi.createAnnouncement({
        title: draft.title.trim(), body: draft.body.trim(), priority: draft.priority,
        target: target(draft.targetType, draft.targetValue),
        publishAt: draft.publishAt ? new Date(draft.publishAt).toISOString() : null,
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
      });
      setDraft(blankAnnouncement); setNotice(draft.publishAt ? "Announcement scheduled." : "Announcement published."); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save announcement."); }
    finally { setBusy(false); }
  }

  async function createBroadcast() {
    if (!broadcast.title.trim() || !broadcast.body.trim()) return;
    setBusy(true); setNotice("");
    try {
      const created = await institutionStudioApi.createBroadcast({
        title: broadcast.title.trim(), body: broadcast.body.trim(), target: target(broadcast.targetType, broadcast.targetValue),
        channels: { inApp: Boolean(broadcast.inApp), push: Boolean(broadcast.push) },
        scheduledAt: broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toISOString() : null,
      });
      if (!broadcast.scheduledAt && created?.id) await institutionStudioApi.sendBroadcast(created.id);
      setBroadcast(blankBroadcast); setNotice(broadcast.scheduledAt ? "Broadcast scheduled." : "Broadcast sent."); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not send broadcast."); }
    finally { setBusy(false); }
  }

  return <InstitutionStudioShell>
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-sm font-bold uppercase tracking-[.15em] text-blue-600">Official publishing</div><h1 className="mt-2 text-3xl font-black tracking-tight">Content Studio</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Create institution-owned announcements and broadcasts. Students can read, react and share externally, but cannot publish institution content.</p></div><div className="grid grid-cols-3 gap-2"><Metric label="Published" value={publishedCount} /><Metric label="Scheduled" value={scheduledCount} /><Metric label="Broadcasts" value={broadcasts.length} /></div></div>
      {notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div> : null}
      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><button onClick={()=>setTab("announcement")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab==="announcement"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}><FileText className="h-4 w-4"/>Announcement</button><button onClick={()=>setTab("broadcast")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab==="broadcast"?"bg-blue-600 text-white":"text-slate-600 hover:bg-slate-50"}`}><Megaphone className="h-4 w-4"/>Broadcast</button></div>
      {busy && !bundle ? <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-600"/></div> : null}
      {tab === "announcement" ? <div className="grid gap-5 2xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Compose Announcement</h2><p className="mt-1 text-xs text-slate-500">Publish now or schedule for later.</p></div><Sparkles className="h-5 w-5 text-blue-600"/></div><div className="mt-5 space-y-4"><Field label="Title" value={draft.title} onChange={(v:any)=>setDraft({...draft,title:v})} placeholder="Campus update title"/><TextArea label="Content" value={draft.body} onChange={(v:any)=>setDraft({...draft,body:v})} rows={10} placeholder="Write the official announcement…"/><div className="grid gap-3 md:grid-cols-3"><Select label="Priority" value={draft.priority} onChange={(v:any)=>setDraft({...draft,priority:v})} options={["low","normal","high","critical"]}/><Select label="Audience" value={draft.targetType} onChange={(v:any)=>setDraft({...draft,targetType:v})} options={["all","department","year"]}/>{draft.targetType!=="all"?<Field label={draft.targetType==="department"?"Department":"Year"} value={draft.targetValue} onChange={(v:any)=>setDraft({...draft,targetValue:v})}/>:<div/>}</div><div className="grid gap-3 md:grid-cols-2"><Field label="Publish at (optional)" type="datetime-local" value={draft.publishAt} onChange={(v:any)=>setDraft({...draft,publishAt:v})}/><Field label="Expires at (optional)" type="datetime-local" value={draft.expiresAt} onChange={(v:any)=>setDraft({...draft,expiresAt:v})}/></div><button disabled={busy||!draft.title.trim()||!draft.body.trim()} onClick={()=>void createAnnouncement()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{draft.publishAt?<CalendarClock className="h-4 w-4"/>:<Send className="h-4 w-4"/>}{draft.publishAt?"Schedule announcement":"Publish announcement"}</button></div></section>
        <div className="space-y-5"><StudentPreview institution={bundle?.institution} title={draft.title} body={draft.body} /><ContentList title="Announcements" items={announcements} /></div>
      </div> : <div className="grid gap-5 2xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><BellRing className="h-5 w-5"/></div><div><h2 className="text-lg font-black">Broadcast Notification</h2><p className="mt-1 text-xs text-slate-500">Target all students or a specific department/year.</p></div></div><div className="mt-5 space-y-4"><Field label="Title" value={broadcast.title} onChange={(v:any)=>setBroadcast({...broadcast,title:v})}/><TextArea label="Message" value={broadcast.body} onChange={(v:any)=>setBroadcast({...broadcast,body:v})} rows={6}/><div className="grid gap-3 md:grid-cols-2"><Select label="Audience" value={broadcast.targetType} onChange={(v:any)=>setBroadcast({...broadcast,targetType:v})} options={["all","department","year"]}/>{broadcast.targetType!=="all"?<Field label={broadcast.targetType==="department"?"Department":"Year"} value={broadcast.targetValue} onChange={(v:any)=>setBroadcast({...broadcast,targetValue:v})}/>:<div/>}</div><div className="grid gap-3 sm:grid-cols-2"><Toggle label="In-app notification" checked={broadcast.inApp} onChange={(v:boolean)=>setBroadcast({...broadcast,inApp:v})}/><Toggle label="Push notification" checked={broadcast.push} onChange={(v:boolean)=>setBroadcast({...broadcast,push:v})}/></div><Field label="Schedule (optional)" type="datetime-local" value={broadcast.scheduledAt} onChange={(v:any)=>setBroadcast({...broadcast,scheduledAt:v})}/><button disabled={busy||!broadcast.title.trim()||!broadcast.body.trim()} onClick={()=>void createBroadcast()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Megaphone className="h-4 w-4"/>{broadcast.scheduledAt?"Schedule broadcast":"Send broadcast now"}</button></div></section>
        <ContentList title="Broadcast History" items={broadcasts} />
      </div>}
    </div>
  </InstitutionStudioShell>;
}

function Metric({label,value}:{label:string;value:number}){return <div className="min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"><div className="text-lg font-black">{value}</div><div className="text-[10px] font-semibold text-slate-500">{label}</div></div>}
function Field({label,value,onChange,type="text",placeholder=""}:any){return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input type={type} value={value??""} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"/></label>}
function TextArea({label,value,onChange,rows=4,placeholder=""}:any){return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><textarea rows={rows} value={value??""} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"/></label>}
function Select({label,value,onChange,options}:any){return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{options.map((option:string)=><option key={option} value={option}>{option.replace("_"," ")}</option>)}</select></label>}
function Toggle({label,checked,onChange}:any){return <button type="button" onClick={()=>onChange(!checked)} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left"><span className="text-sm font-semibold text-slate-700">{label}</span><span className={`relative h-6 w-11 rounded-full ${checked?"bg-blue-600":"bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow ${checked?"left-6":"left-1"}`}/></span></button>}
function StudentPreview({institution,title,body}:any){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-black">Student Preview</h2><span className="text-[10px] font-bold text-emerald-600">LIVE STYLE</span></div><div className="mx-auto mt-4 max-w-sm rounded-3xl border border-slate-200 p-4 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-blue-600 text-white">{institution?.logoUrl?<img src={institution.logoUrl} alt="" className="h-full w-full object-cover"/>:<Megaphone className="h-5 w-5"/>}</div><div><div className="text-sm font-bold">{institution?.name||"Institution"}</div><div className="text-[10px] text-slate-400">Official announcement · now</div></div></div><div className="mt-4 text-base font-black">{title||"Your announcement title"}</div><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{body||"Your official announcement will appear here exactly as students will read it."}</div></div></section>}
function ContentList({title,items}:any){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">{title}</h2><div className="mt-4 space-y-2">{items.slice(0,12).map((item:any)=><div key={item.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{item.title}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.body}</div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.status==="sent"||item.status==="published"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{item.status||"pending"}</span></div></div>)}{!items.length?<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Nothing published yet.</div>:null}</div></section>}
