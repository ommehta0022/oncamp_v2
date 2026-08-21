"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Megaphone,
  Save,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import InstitutionStudioShell from "@/components/InstitutionStudioShell";
import { StudioActionButton, StudioNotice, StudioRichEditor } from "@/components/StudioKit";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

const DRAFT_KEY = "oncampus_studio_content_working_draft_v2";
const blankAnnouncement = { title: "", body: "", priority: "normal", publishAt: "", expiresAt: "", targetType: "all", targetValue: "", coverUrl: "", push: true };
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
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "error">("info");

  async function load() {
    setBusy(true);
    try {
      const [b, a, br] = await Promise.all([
        institutionStudioApi.bundle(),
        institutionStudioApi.announcements().catch(() => []),
        institutionStudioApi.broadcasts().catch(() => []),
      ]);
      setBundle(b);
      setAnnouncements(Array.isArray(a) ? a : []);
      setBroadcasts(Array.isArray(br) ? br : []);
    } catch (e) {
      setNoticeTone("error");
      setNotice(e instanceof Error ? e.message : "Could not load Content Studio.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    void load();
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setDraft({ ...blankAnnouncement, ...JSON.parse(saved) });
    } catch { /* ignore invalid local draft */ }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage can be unavailable */ }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const scheduledCount = useMemo(() => announcements.filter((item) => item.status === "scheduled").length, [announcements]);
  const publishedCount = useMemo(() => announcements.filter((item) => item.status === "published").length, [announcements]);
  const draftsCount = useMemo(() => announcements.filter((item) => item.status === "draft").length, [announcements]);
  const institution = bundle?.institution || {};

  async function createAnnouncement(forceNow = false) {
    const title = draft.title.trim();
    const body = draft.body.trim();
    if (!title || !body) {
      setNoticeTone("error"); setNotice("Title and content are required."); return;
    }
    if (draft.targetType !== "all" && !draft.targetValue.trim()) {
      setNoticeTone("error"); setNotice(`Enter the ${draft.targetType} target.`); return;
    }
    const publishAt = forceNow ? null : (draft.publishAt ? new Date(draft.publishAt).toISOString() : null);
    if (!forceNow && publishAt && new Date(publishAt).getTime() <= Date.now()) {
      setNoticeTone("error"); setNotice("Scheduled publish time must be in the future."); return;
    }
    const expiresAt = draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null;
    if (expiresAt && publishAt && new Date(expiresAt) <= new Date(publishAt)) {
      setNoticeTone("error"); setNotice("Expiry must be after publish time."); return;
    }
    setNotice("");
    try {
      const created = await institutionStudioApi.createAnnouncement({
        title,
        body,
        priority: draft.priority,
        target: target(draft.targetType, draft.targetValue),
        publishAt,
        expiresAt,
      });
      if (created?.id && draft.coverUrl) {
        await institutionStudioApi.updateStudioAnnouncement(created.id, {
          coverUrl: draft.coverUrl,
          metadata: { editor: "studio-v2", hasCover: true, priority: draft.priority },
        });
      }
      if (draft.push) {
        const push = await institutionStudioApi.createBroadcast({
          title,
          body: body.slice(0, 1000),
          target: target(draft.targetType, draft.targetValue),
          channels: { inApp: true, push: true },
          scheduledAt: publishAt,
        });
        if (!publishAt && push?.id) await institutionStudioApi.sendBroadcast(push.id);
      }
      localStorage.removeItem(DRAFT_KEY);
      setDraft(blankAnnouncement);
      setNoticeTone("success");
      setNotice(publishAt ? "Announcement and notification scheduled successfully." : "Announcement published successfully.");
      await load();
    } catch (e) {
      setNoticeTone("error"); setNotice(e instanceof Error ? e.message : "Could not publish announcement.");
      throw e;
    }
  }

  async function createBroadcast() {
    if (!broadcast.title.trim() || !broadcast.body.trim()) {
      setNoticeTone("error"); setNotice("Broadcast title and message are required."); return;
    }
    if (broadcast.targetType !== "all" && !broadcast.targetValue.trim()) {
      setNoticeTone("error"); setNotice(`Enter the ${broadcast.targetType} target.`); return;
    }
    setNotice("");
    try {
      const created = await institutionStudioApi.createBroadcast({
        title: broadcast.title.trim(),
        body: broadcast.body.trim(),
        target: target(broadcast.targetType, broadcast.targetValue),
        channels: { inApp: Boolean(broadcast.inApp), push: Boolean(broadcast.push) },
        scheduledAt: broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toISOString() : null,
      });
      if (!broadcast.scheduledAt && created?.id) await institutionStudioApi.sendBroadcast(created.id);
      setBroadcast(blankBroadcast);
      setNoticeTone("success");
      setNotice(broadcast.scheduledAt ? "Broadcast scheduled." : "Broadcast sent.");
      await load();
    } catch (e) {
      setNoticeTone("error"); setNotice(e instanceof Error ? e.message : "Could not send broadcast.");
      throw e;
    }
  }

  function saveWorkingDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setNoticeTone("success"); setNotice("Working draft saved in this browser.");
  }

  return <InstitutionStudioShell>
    <div className="space-y-5">
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div><div className="text-sm font-bold uppercase tracking-[.15em] text-blue-600">Official publishing</div><h1 className="mt-2 text-3xl font-black tracking-tight">Content Studio & Announcement Scheduling</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Advanced institution-owned editor with templates, media, targeting, live student preview, scheduling and push delivery.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric label="Drafts" value={draftsCount} /><Metric label="Published" value={publishedCount} /><Metric label="Scheduled" value={scheduledCount} /><Metric label="Broadcasts" value={broadcasts.length} /></div>
      </div>
      <StudioNotice text={notice} tone={noticeTone} />
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><button onClick={() => setTab("announcement")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "announcement" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><FileText className="h-4 w-4" />Content editor</button><button onClick={() => setTab("broadcast")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${tab === "broadcast" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Megaphone className="h-4 w-4" />Broadcast center</button></div>

      {busy && !bundle ? <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : null}

      {tab === "announcement" ? <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.42fr)_minmax(320px,.58fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Compose official content</h2><p className="mt-1 text-xs text-slate-500">Use a template or build a custom post. Changes autosave locally while you type.</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Autosave on</span></div>
          <div className="mt-5"><StudioRichEditor title={draft.title} body={draft.body} onTitle={(v) => setDraft({ ...draft, title: v })} onBody={(v) => setDraft({ ...draft, body: v })} coverUrl={draft.coverUrl} onMedia={(url) => setDraft({ ...draft, coverUrl: url })} /></div>

          <div className="mt-5 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3">
            <Select label="Priority" value={draft.priority} onChange={(v: string) => setDraft({ ...draft, priority: v })} options={["low", "normal", "high", "critical"]} />
            <Select label="Audience" value={draft.targetType} onChange={(v: string) => setDraft({ ...draft, targetType: v })} options={["all", "department", "year"]} />
            {draft.targetType !== "all" ? <Field label={draft.targetType === "department" ? "Department" : "Year"} value={draft.targetValue} onChange={(v: string) => setDraft({ ...draft, targetValue: v })} /> : <div className="rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500"><b>Audience:</b> all verified students</div>}
            <Field label="Publish at (optional)" type="datetime-local" value={draft.publishAt} onChange={(v: string) => setDraft({ ...draft, publishAt: v })} />
            <Field label="Expires at (optional)" type="datetime-local" value={draft.expiresAt} onChange={(v: string) => setDraft({ ...draft, expiresAt: v })} />
            <Toggle label="Send push notification" checked={draft.push} onChange={(v: boolean) => setDraft({ ...draft, push: v })} />
          </div>

          <div className="studio-header-actions mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button onClick={saveWorkingDraft} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><Save className="h-4 w-4" />Save working draft</button>
            {draft.publishAt ? <StudioActionButton run={() => createAnnouncement(false)} className="border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" busyText="Scheduling…"><CalendarClock className="h-4 w-4" />Schedule</StudioActionButton> : null}
            <StudioActionButton run={() => createAnnouncement(true)} disabled={!draft.title.trim() || !draft.body.trim()} className="bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700" busyText="Publishing…"><Send className="h-4 w-4" />Publish now</StudioActionButton>
          </div>
        </section>

        <div className="space-y-5">
          <StudentPreview institution={institution} title={draft.title} body={draft.body} coverUrl={draft.coverUrl} publishAt={draft.publishAt} />
          <WorkflowCard announcements={announcements} />
        </div>
      </div> : <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><BellRing className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Broadcast notification</h2><p className="mt-1 text-xs text-slate-500">Immediate or scheduled in-app and push communication.</p></div></div><div className="mt-5 space-y-4"><Field label="Title" value={broadcast.title} onChange={(v: string) => setBroadcast({ ...broadcast, title: v })} /><TextArea label="Message" value={broadcast.body} onChange={(v: string) => setBroadcast({ ...broadcast, body: v })} rows={8} /><div className="grid gap-3 md:grid-cols-2"><Select label="Audience" value={broadcast.targetType} onChange={(v: string) => setBroadcast({ ...broadcast, targetType: v })} options={["all", "department", "year"]} />{broadcast.targetType !== "all" ? <Field label={broadcast.targetType === "department" ? "Department" : "Year"} value={broadcast.targetValue} onChange={(v: string) => setBroadcast({ ...broadcast, targetValue: v })} /> : <div />}</div><div className="grid gap-3 sm:grid-cols-2"><Toggle label="In-app notification" checked={broadcast.inApp} onChange={(v: boolean) => setBroadcast({ ...broadcast, inApp: v })} /><Toggle label="Push notification" checked={broadcast.push} onChange={(v: boolean) => setBroadcast({ ...broadcast, push: v })} /></div><Field label="Schedule (optional)" type="datetime-local" value={broadcast.scheduledAt} onChange={(v: string) => setBroadcast({ ...broadcast, scheduledAt: v })} /><StudioActionButton run={createBroadcast} disabled={!broadcast.title.trim() || !broadcast.body.trim()} className="w-full bg-blue-600 text-white hover:bg-blue-700" busyText={broadcast.scheduledAt ? "Scheduling…" : "Sending…"}><Megaphone className="h-4 w-4" />{broadcast.scheduledAt ? "Schedule broadcast" : "Send broadcast now"}</StudioActionButton></div></section>
        <ContentList title="Broadcast history" items={broadcasts} />
      </div>}

      <ContentList title="Published & scheduled content" items={announcements} wide />
    </div>
  </InstitutionStudioShell>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm"><div className="text-lg font-black">{value}</div><div className="text-[10px] font-semibold text-slate-500">{label}</div></div>; }
function Field({ label, value, onChange, type = "text", placeholder = "" }: any) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>; }
function TextArea({ label, value, onChange, rows = 4, placeholder = "" }: any) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>; }
function Select({ label, value, onChange, options }: any) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{options.map((option: string) => <option key={option} value={option}>{option.replace("_", " ")}</option>)}</select></label>; }
function Toggle({ label, checked, onChange }: any) { return <button type="button" onClick={() => onChange(!checked)} className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left"><span className="text-sm font-semibold text-slate-700">{label}</span><span className={`relative h-6 w-11 shrink-0 rounded-full ${checked ? "bg-blue-600" : "bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} /></span></button>; }

function StudentPreview({ institution, title, body, coverUrl, publishAt }: any) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><div><h2 className="font-black">Student preview</h2><p className="mt-1 text-xs text-slate-500">Mobile announcement card</p></div><span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><Smartphone className="h-3.5 w-3.5" />LIVE STYLE</span></div><div className="mx-auto mt-4 max-w-sm overflow-hidden rounded-[28px] border-[7px] border-slate-900 bg-white shadow-xl">{coverUrl ? <img src={coverUrl} alt="Announcement cover" className="h-40 w-full object-cover" /> : null}<div className="p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-blue-600 text-white">{institution?.logoUrl ? <img src={institution.logoUrl} alt="" className="h-full w-full object-cover" /> : <Megaphone className="h-5 w-5" />}</div><div><div className="text-sm font-bold">{institution?.name || "Institution"}</div><div className="text-[10px] text-slate-400">Official announcement · {publishAt ? "scheduled" : "now"}</div></div></div><div className="mt-4 text-base font-black">{title || "Your announcement title"}</div><div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{body || "Your official announcement will appear here exactly as students will read it."}</div><div className="mt-4 flex gap-5 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-500"><span>♡ React</span><span>◯ Comment</span><span>↗ Share</span></div></div></div></section>;
}

function WorkflowCard({ announcements }: { announcements: any[] }) {
  const rows = [
    ["Published", announcements.filter((a) => a.status === "published").length, "text-emerald-700 bg-emerald-50"],
    ["Scheduled", announcements.filter((a) => a.status === "scheduled").length, "text-blue-700 bg-blue-50"],
    ["Draft / pending", announcements.filter((a) => a.status === "draft").length, "text-amber-700 bg-amber-50"],
  ];
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-600" /><h2 className="font-black">Content workflow</h2></div><div className="mt-4 space-y-2">{rows.map(([label, value, cls]: any) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold text-slate-600">{label}</span><span className={`rounded-full px-2 py-1 text-xs font-black ${cls}`}>{value}</span></div>)}</div><div className="mt-4 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800"><Clock3 className="h-4 w-4 shrink-0" />Scheduled content is published by the backend scheduler, not by the browser.</div></section>;
}

function ContentList({ title, items, wide = false }: any) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${wide ? "w-full" : ""}`}><h2 className="font-black">{title}</h2><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{items.slice(0, 18).map((item: any) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.title}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</div>{item.cover_url ? <img src={item.cover_url} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" /> : null}</div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "sent" || item.status === "published" ? "bg-emerald-50 text-emerald-700" : item.status === "scheduled" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{item.status || "pending"}</span></div></div>)}{!items.length ? <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Nothing here yet.</div> : null}</div></section>;
}
