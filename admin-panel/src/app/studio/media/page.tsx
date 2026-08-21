"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  FileImage,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Megaphone,
  Sparkles,
  UsersRound,
} from "lucide-react";
import InstitutionStudioShell from "@/components/InstitutionStudioShell";
import { StudioActionButton, StudioMediaUploader, StudioNotice } from "@/components/StudioKit";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

type TargetKind =
  | "profile-cover"
  | "profile-logo"
  | "gallery"
  | "group-avatar"
  | "department-logo"
  | "department-cover"
  | "event-cover"
  | "opportunity-cover"
  | "place-cover"
  | "announcement-cover";

const TARGETS: { value: TargetKind; label: string; icon: any; needsItem?: boolean }[] = [
  { value: "profile-cover", label: "Institution cover", icon: Building2 },
  { value: "profile-logo", label: "Institution logo", icon: Building2 },
  { value: "gallery", label: "Campus gallery", icon: ImageIcon },
  { value: "group-avatar", label: "Group avatar", icon: UsersRound, needsItem: true },
  { value: "department-logo", label: "Department logo", icon: Building2, needsItem: true },
  { value: "department-cover", label: "Department cover", icon: Building2, needsItem: true },
  { value: "event-cover", label: "Event cover", icon: CalendarDays, needsItem: true },
  { value: "opportunity-cover", label: "Opportunity cover", icon: Sparkles, needsItem: true },
  { value: "place-cover", label: "Campus place image", icon: MapPin, needsItem: true },
  { value: "announcement-cover", label: "Announcement cover", icon: Megaphone, needsItem: true },
];

export default function StudioMediaPage() {
  const [bundle, setBundle] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [asset, setAsset] = useState("");
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [targetKind, setTargetKind] = useState<TargetKind>("gallery");
  const [targetId, setTargetId] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "error">("info");

  async function load() {
    setLoading(true);
    try {
      const [b, g, d, e, o, p, a] = await Promise.all([
        institutionStudioApi.bundle(),
        institutionStudioApi.studioGroups().catch(() => []),
        institutionStudioApi.departments().catch(() => []),
        institutionStudioApi.events().catch(() => []),
        institutionStudioApi.studioOpportunities().catch(() => []),
        institutionStudioApi.studioPlaces().catch(() => []),
        institutionStudioApi.announcements().catch(() => []),
      ]);
      setBundle(b);
      setGroups(Array.isArray(g) ? g : []);
      setDepartments(Array.isArray(d) ? d : []);
      setEvents(Array.isArray(e) ? e : []);
      setOpportunities(Array.isArray(o) ? o : []);
      setPlaces(Array.isArray(p) ? p : []);
      setAnnouncements(Array.isArray(a) ? a : []);
    } catch (error) {
      setTone("error");
      setNotice(error instanceof Error ? error.message : "Could not load media workspace.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { setTargetId(""); }, [targetKind]);

  const targetItems = useMemo(() => {
    if (targetKind === "group-avatar") return groups.map((row) => ({ id: row.id, name: row.name }));
    if (targetKind === "department-logo" || targetKind === "department-cover") return departments.map((row) => ({ id: row.id, name: row.name }));
    if (targetKind === "event-cover") return events.map((row) => ({ id: row.id, name: row.title }));
    if (targetKind === "opportunity-cover") return opportunities.map((row) => ({ id: row.id, name: row.title }));
    if (targetKind === "place-cover") return places.map((row) => ({ id: row.id, name: row.name }));
    if (targetKind === "announcement-cover") return announcements.map((row) => ({ id: row.id, name: row.title }));
    return [];
  }, [targetKind, groups, departments, events, opportunities, places, announcements]);

  const selectedTarget = TARGETS.find((item) => item.value === targetKind)!;

  async function applyAsset() {
    if (!asset) {
      setTone("error"); setNotice("Upload or select a media asset first."); return;
    }
    if (selectedTarget.needsItem && !targetId) {
      setTone("error"); setNotice("Choose where this media should be used."); return;
    }
    setNotice("");
    try {
      if (targetKind === "profile-cover") await institutionStudioApi.updateIdentity({ coverUrl: asset });
      else if (targetKind === "profile-logo") await institutionStudioApi.updateIdentity({ logoUrl: asset });
      else if (targetKind === "gallery") {
        const kind = assetFile?.type.startsWith("video/") ? "video" : "image";
        await institutionStudioApi.createGallery({
          kind,
          category: "campus",
          url: asset,
          caption: caption.trim() || null,
          altText: caption.trim() || `${bundle?.institution?.name || "Institution"} campus media`,
          sortOrder: bundle?.gallery?.length || 0,
          featured: false,
          published: true,
        });
      } else if (targetKind === "group-avatar") await institutionStudioApi.updateStudioGroup(targetId, { avatarUrl: asset });
      else if (targetKind === "department-logo") await institutionStudioApi.updateStudioDepartment(targetId, { logoUrl: asset });
      else if (targetKind === "department-cover") await institutionStudioApi.updateStudioDepartment(targetId, { coverUrl: asset });
      else if (targetKind === "announcement-cover") await institutionStudioApi.updateStudioAnnouncement(targetId, { coverUrl: asset, metadata: { mediaAssignedFrom: "studio-media" } });
      else if (targetKind === "opportunity-cover") {
        const row = opportunities.find((item) => item.id === targetId);
        await institutionStudioApi.updateStudioOpportunity(targetId, { metadata: { ...(row?.metadata || {}), imageUrl: asset } });
      } else if (targetKind === "place-cover") {
        const row = places.find((item) => item.id === targetId);
        await institutionStudioApi.updateStudioPlace(targetId, { metadata: { ...(row?.metadata || {}), imageUrl: asset } });
      } else if (targetKind === "event-cover") {
        const row = events.find((item) => item.id === targetId);
        if (!row) throw new Error("Event not found.");
        await institutionStudioApi.updateEvent(targetId, {
          title: row.title,
          description: row.description || "",
          location: row.location || null,
          locationLat: row.location_lat ?? null,
          locationLng: row.location_lng ?? null,
          startAt: row.start_at,
          endAt: row.end_at,
          capacity: row.capacity ?? null,
          visibility: row.visibility || "public",
          status: row.status || "published",
          imageUrl: asset,
          rsvpEnabled: row.rsvp_enabled !== false,
        });
      }
      setTone("success");
      setNotice(`Media applied to ${selectedTarget.label.toLowerCase()} successfully.`);
      await load();
    } catch (error) {
      setTone("error");
      setNotice(error instanceof Error ? error.message : "Could not apply media.");
      throw error;
    }
  }

  const gallery = bundle?.gallery || [];
  return <InstitutionStudioShell>
    <div className="space-y-5">
      <div><div className="text-sm font-bold uppercase tracking-[.15em] text-blue-600">Media workspace</div><h1 className="mt-2 text-3xl font-black tracking-tight">Media Library & Image Assignment</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Upload once, then use the asset across institution profile, gallery, groups, departments, events, opportunities, campus places and announcements.</p></div>
      <StudioNotice text={notice} tone={tone} />
      {loading && !bundle ? <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div> : null}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileImage className="h-5 w-5" /></div><div><h2 className="font-black">Upload media</h2><p className="mt-1 text-xs text-slate-500">Images and short videos are stored in the institution public media bucket.</p></div></div>
          <div className="mt-5"><StudioMediaUploader value={asset} onUploaded={(url, file) => { setAsset(url); setAssetFile(file); setTone("success"); setNotice("Upload complete. Choose a destination and apply it."); }} /></div>
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Use this media for</span><select value={targetKind} onChange={(e) => setTargetKind(e.target.value as TargetKind)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500">{TARGETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            {selectedTarget.needsItem ? <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Select {selectedTarget.label.toLowerCase()}</span><select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"><option value="">Choose…</option>{targetItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
            {targetKind === "gallery" ? <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Caption / alt text</span><input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500" placeholder="Describe the campus media" /></label> : null}
            <StudioActionButton run={applyAsset} disabled={!asset || (selectedTarget.needsItem && !targetId)} className="w-full bg-blue-600 text-white hover:bg-blue-700" busyText="Applying…">Apply media</StudioActionButton>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Campus media library</h2><p className="mt-1 text-xs text-slate-500">Select an existing gallery asset to reuse it without uploading again.</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{gallery.length} assets</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{gallery.map((item: any) => <button key={item.id} onClick={() => { setAsset(item.url); setAssetFile(null); setCaption(item.caption || ""); setNotice("Existing asset selected. Choose a destination and apply it."); setTone("info"); }} className={`group overflow-hidden rounded-xl border text-left transition hover:border-blue-300 hover:shadow-md ${asset === item.url ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}><div className="aspect-[16/10] bg-slate-100">{item.kind === "video" ? <video src={item.url} preload="metadata" className="h-full w-full object-cover" /> : <img src={item.url} alt={item.alt_text || item.caption || "Campus media"} className="h-full w-full object-cover" />}</div><div className="p-3"><div className="truncate text-sm font-bold">{item.caption || item.category || "Campus asset"}</div><div className="mt-1 text-[11px] text-slate-500">{item.category || "campus"} · {item.kind || "image"}</div></div></button>)}{!gallery.length ? <div className="col-span-full rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Upload your first campus asset from the panel on the left.</div> : null}</div></section>
      </div>
    </div>
  </InstitutionStudioShell>;
}
