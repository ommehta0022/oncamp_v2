"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Globe2,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  UploadCloud,
} from "lucide-react";
import InstitutionStudioShell from "@/components/InstitutionStudioShell";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

const defaultProfile = { tagline: "", shortDescription: "", description: "", website: "", phone: "", city: "", state: "", country: "", establishedYear: "" };
const defaultStory = { year: new Date().getFullYear(), title: "", description: "", imageUrl: "", icon: "ribbon-outline", sortOrder: 0, published: true };
const defaultProgram = { name: "", degreeType: "", duration: "", description: "", eligibility: "", intake: "", feesText: "", brochureUrl: "", applicationUrl: "", status: "published", sortOrder: 0 };
const defaultAchievement = { category: "institution", title: "", description: "", date: "", imageUrl: "", featured: false, published: true, sortOrder: 0 };

export default function ProfileStudioPage() {
  const [bundle, setBundle] = useState<any>(null);
  const [profile, setProfile] = useState<any>(defaultProfile);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [storyDraft, setStoryDraft] = useState<any>(defaultStory);
  const [programDraft, setProgramDraft] = useState<any>(defaultProgram);
  const [achievementDraft, setAchievementDraft] = useState<any>(defaultAchievement);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryCategory, setGalleryCategory] = useState("campus");

  async function load() {
    setBusy(true);
    try {
      const data = await institutionStudioApi.bundle();
      setBundle(data);
      const i = data?.institution || {};
      setProfile({
        tagline: i.tagline || "",
        shortDescription: i.shortDescription || "",
        description: i.description || "",
        website: i.website || "",
        phone: i.phone || "",
        city: i.city || "",
        state: i.state || "",
        country: i.country || "",
        establishedYear: i.establishedYear || "",
        accreditation: i.accreditation || [],
        rankings: i.rankings || [],
        publicStats: i.publicStats || {},
        socialLinks: i.socialLinks || {},
        publicConfig: i.publicConfig || {},
      });
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load Institution Studio."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  async function saveProfile(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setNotice("");
    try {
      await institutionStudioApi.updateProfile({ ...profile, establishedYear: profile.establishedYear ? Number(profile.establishedYear) : null });
      setNotice("Profile draft saved."); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save profile."); }
    finally { setBusy(false); }
  }

  async function uploadPublicMedia(file: File, target: "logo" | "cover" | "gallery") {
    setBusy(true); setNotice("");
    try {
      const uploaded = await institutionStudioApi.uploadMedia(file);
      if (target === "gallery") {
        await institutionStudioApi.createGallery({ kind: file.type.startsWith("video/") ? "video" : "image", category: galleryCategory, url: uploaded.url, caption: galleryCaption || null, altText: galleryCaption || `${bundle?.institution?.name || "Institution"} campus media`, sortOrder: bundle?.gallery?.length || 0, featured: false, published: true });
      } else {
        // Identity media is persisted through the existing institution profile endpoint.
        await institutionStudioApi.updateIdentity({ [target === "logo" ? "logoUrl" : "coverUrl"]: uploaded.url });
      }
      setNotice(`${target === "gallery" ? "Gallery media" : target === "logo" ? "Logo" : "Cover"} updated.`); await load();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); }
  }

  const institution = bundle?.institution || {};

  return <InstitutionStudioShell>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><div className="text-sm font-bold uppercase tracking-[.15em] text-blue-600">Public campus experience</div><h1 className="mt-2 text-3xl font-black tracking-tight">Profile & Campus Story</h1><p className="mt-2 text-sm text-slate-500">Edit exactly what students see in Discover and the full institution profile.</p></div><div className="flex gap-2"><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"><RefreshCcw className="h-4 w-4" />Refresh</button><button disabled={busy} onClick={() => void saveProfile()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold"><Save className="h-4 w-4" />Save Draft</button><button disabled={busy} onClick={() => void institutionStudioApi.publish().then(() => { setNotice("Published successfully."); return load(); })} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20"><Eye className="h-4 w-4" />Publish</button></div></div>
      {notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div> : null}

      <div className="grid gap-5 2xl:grid-cols-[1.45fr_.55fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-black">Institution Profile</h2><p className="mt-1 text-xs text-slate-500">Identity, public description, links and statistics.</p></div><Building2 className="h-5 w-5 text-blue-600" /></div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="space-y-4"><MediaPicker title="Logo" image={institution.logoUrl} ratio="square" onFile={(file) => void uploadPublicMedia(file, "logo")} /><MediaPicker title="Cover image / video" image={institution.coverUrl} ratio="cover" onFile={(file) => void uploadPublicMedia(file, "cover")} /></div>
              <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2"><Field label="Tagline" value={profile.tagline} onChange={(v) => setProfile({ ...profile, tagline: v })} placeholder="Inspiring minds. Building futures." /><Field label="Established year" type="number" value={profile.establishedYear} onChange={(v) => setProfile({ ...profile, establishedYear: v })} /><Field label="City" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} /><Field label="State" value={profile.state} onChange={(v) => setProfile({ ...profile, state: v })} /><Field label="Country" value={profile.country} onChange={(v) => setProfile({ ...profile, country: v })} /><Field label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} /><Field label="Website" value={profile.website} onChange={(v) => setProfile({ ...profile, website: v })} className="sm:col-span-2" /><TextArea label="Short description" value={profile.shortDescription} onChange={(v) => setProfile({ ...profile, shortDescription: v })} rows={3} className="sm:col-span-2" /><TextArea label="Full institution description" value={profile.description} onChange={(v) => setProfile({ ...profile, description: v })} rows={7} className="sm:col-span-2" /></form>
            </div>
          </section>

          <CrudSection icon={Clock3} title="Campus Story" subtitle="Create a visual timeline of your institution history." count={bundle?.story?.length || 0}>
            <div className="grid gap-3 lg:grid-cols-2">{(bundle?.story || []).map((item:any) => <ItemCard key={item.id} title={`${item.year || ""} ${item.title}`.trim()} subtitle={item.description} media={item.image_url} onDelete={() => void institutionStudioApi.deleteStory(item.id).then(load)} />)}</div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4"><Field label="Year" type="number" value={storyDraft.year} onChange={(v) => setStoryDraft({ ...storyDraft, year: Number(v) })} /><Field label="Milestone title" value={storyDraft.title} onChange={(v) => setStoryDraft({ ...storyDraft, title: v })} className="md:col-span-2" /><Field label="Order" type="number" value={storyDraft.sortOrder} onChange={(v) => setStoryDraft({ ...storyDraft, sortOrder: Number(v) })} /><TextArea label="Description" value={storyDraft.description} onChange={(v) => setStoryDraft({ ...storyDraft, description: v })} rows={3} className="md:col-span-3" /><button disabled={!storyDraft.title || busy} onClick={() => void institutionStudioApi.createStory(storyDraft).then(() => { setStoryDraft(defaultStory); return load(); })} className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Add milestone</button></div>
          </CrudSection>

          <CrudSection icon={ImageIcon} title="Campus Gallery" subtitle="Photos and videos used across the student profile." count={bundle?.gallery?.length || 0}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(bundle?.gallery || []).map((item:any) => <div key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><div className="aspect-[16/10] bg-slate-100">{item.kind === "image" ? <img src={item.url} alt={item.alt_text || item.caption || "Campus media"} className="h-full w-full object-cover" /> : <video src={item.url} controls className="h-full w-full object-cover" />}</div><div className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{item.caption || item.category || "Campus media"}</div><div className="text-[11px] text-slate-500">{item.category} · {item.kind}</div></div><button onClick={() => void institutionStudioApi.deleteGallery(item.id).then(load)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]"><Field label="Category" value={galleryCategory} onChange={setGalleryCategory} placeholder="campus, library, sports…" /><Field label="Caption / alt text" value={galleryCaption} onChange={setGalleryCaption} /><label className="self-end"><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadPublicMedia(file, "gallery"); e.currentTarget.value = ""; }} /><span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white"><UploadCloud className="h-4 w-4" />Upload media</span></label></div>
          </CrudSection>

          <CrudSection icon={BookOpen} title="Programs & Courses" subtitle="Programs shown in the Campus and About areas." count={bundle?.programs?.length || 0}>
            <div className="grid gap-3 md:grid-cols-2">{(bundle?.programs || []).map((item:any) => <ItemCard key={item.id} title={item.name} subtitle={[item.degree_type,item.duration,item.description].filter(Boolean).join(" · ")} onDelete={() => void institutionStudioApi.deleteProgram(item.id).then(load)} />)}</div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4"><Field label="Program name" value={programDraft.name} onChange={(v) => setProgramDraft({ ...programDraft, name: v })} className="md:col-span-2" /><Field label="Degree type" value={programDraft.degreeType} onChange={(v) => setProgramDraft({ ...programDraft, degreeType: v })} /><Field label="Duration" value={programDraft.duration} onChange={(v) => setProgramDraft({ ...programDraft, duration: v })} /><TextArea label="Description" value={programDraft.description} onChange={(v) => setProgramDraft({ ...programDraft, description: v })} rows={3} className="md:col-span-3" /><button disabled={!programDraft.name || busy} onClick={() => void institutionStudioApi.createProgram({ ...programDraft, intake: programDraft.intake ? Number(programDraft.intake) : null }).then(() => { setProgramDraft(defaultProgram); return load(); })} className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Add program</button></div>
          </CrudSection>

          <CrudSection icon={Trophy} title="Achievements & Highlights" subtitle="Rankings, awards, research, sports and student achievements." count={bundle?.achievements?.length || 0}>
            <div className="grid gap-3 md:grid-cols-2">{(bundle?.achievements || []).map((item:any) => <ItemCard key={item.id} title={item.title} subtitle={[item.category,item.date,item.description].filter(Boolean).join(" · ")} media={item.image_url} onDelete={() => void institutionStudioApi.deleteAchievement(item.id).then(load)} />)}</div>
            <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-4"><Field label="Category" value={achievementDraft.category} onChange={(v) => setAchievementDraft({ ...achievementDraft, category: v })} /><Field label="Title" value={achievementDraft.title} onChange={(v) => setAchievementDraft({ ...achievementDraft, title: v })} className="md:col-span-2" /><Field label="Date / year" value={achievementDraft.date} onChange={(v) => setAchievementDraft({ ...achievementDraft, date: v })} /><TextArea label="Description" value={achievementDraft.description} onChange={(v) => setAchievementDraft({ ...achievementDraft, description: v })} rows={3} className="md:col-span-3" /><button disabled={!achievementDraft.title || busy} onClick={() => void institutionStudioApi.createAchievement(achievementDraft).then(() => { setAchievementDraft(defaultAchievement); return load(); })} className="self-end rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">Add highlight</button></div>
          </CrudSection>
        </div>

        <aside className="space-y-5 2xl:sticky 2xl:top-24 2xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-black">Live Student Preview</h2><p className="mt-1 text-xs text-slate-500">Discover profile</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LIVE</span></div><div className="mx-auto mt-5 max-w-[310px] overflow-hidden rounded-[2rem] border-[9px] border-slate-900 bg-white shadow-xl"><div className="h-36 bg-gradient-to-br from-blue-100 to-indigo-100">{institution.coverUrl ? <img src={institution.coverUrl} alt="Cover preview" className="h-full w-full object-cover" /> : null}</div><div className="relative px-4 pb-5"><div className="-mt-9 grid h-18 w-18 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-blue-600 text-white">{institution.logoUrl ? <img src={institution.logoUrl} alt="Logo preview" className="h-full w-full object-cover" /> : <Building2 className="h-7 w-7" />}</div><div className="mt-3 flex items-center gap-1"><b>{institution.name || "Your institution"}</b>{institution.verified ? <CheckCircle2 className="h-4 w-4 fill-blue-600 text-white" /> : null}</div><div className="mt-1 text-xs text-slate-500">{profile.tagline || "Your campus tagline"}</div><div className="mt-3 flex gap-3 text-[11px]"><b>{institution.followersCount || 0}</b><span className="text-slate-500">Followers</span><b>{bundle?.groups?.length || 0}</b><span className="text-slate-500">Groups</span></div><button className="mt-4 h-9 w-full rounded-xl bg-blue-600 text-xs font-bold text-white">Follow</button><div className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">{profile.shortDescription || profile.description || "Add a short institution description."}</div></div></div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Profile Versions</h2><div className="mt-4 space-y-2">{(bundle?.versions || []).slice(0,8).map((version:any) => <div key={version.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><div><div className="text-sm font-bold">Version {version.version}</div><div className="mt-0.5 text-[11px] text-slate-500">{version.created_at ? new Date(version.created_at).toLocaleString() : version.status}</div></div><button onClick={() => void institutionStudioApi.restoreVersion(version.id).then(load)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold">Restore</button></div>)}{!bundle?.versions?.length ? <div className="text-sm text-slate-400">Publish once to create your first version.</div> : null}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black">Campus Pulse Sections</h2><p className="mt-1 text-xs text-slate-500">Choose what students see on Home.</p><div className="mt-4 space-y-3">{["events","announcements","groups","opportunities","departments","achievements","programs"].map((key,index) => <SectionToggle key={key} label={key[0].toUpperCase()+key.slice(1)} initial={bundle?.sections?.find((s:any) => s.section_key===key)?.enabled ?? true} onChange={(enabled) => void institutionStudioApi.updateSection(key,{ title:null, enabled, sortOrder:index, config:{} }).then(load)} />)}</div></section>
        </aside>
      </div>
    </div>
  </InstitutionStudioShell>;
}

function MediaPicker({ title, image, ratio, onFile }: { title: string; image?: string; ratio: "square" | "cover"; onFile: (file: File) => void }) { return <div><div className="mb-2 text-sm font-bold text-slate-700">{title}</div><label className={`group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 ${ratio === "square" ? "aspect-square max-w-36" : "aspect-[16/7]"}`}>{image ? <img src={image} alt={title} className="h-full w-full object-cover" /> : <div className="text-center"><UploadCloud className="mx-auto h-6 w-6 text-slate-400" /><span className="mt-2 block text-xs text-slate-500">Upload {title.toLowerCase()}</span></div>}<div className="absolute inset-0 grid place-items-center bg-slate-950/45 opacity-0 transition group-hover:opacity-100"><span className="rounded-lg bg-white px-3 py-2 text-xs font-bold">Change</span></div><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); e.currentTarget.value=""; }} /></label></div>; }
function Field({ label, value, onChange, type="text", placeholder, className="" }: any) { return <label className={className}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>; }
function TextArea({ label, value, onChange, rows=4, className="" }: any) { return <label className={className}><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span><textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50" /></label>; }
function CrudSection({ icon: Icon, title, subtitle, count, children }: any) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-5 w-5" /></div><div><h2 className="font-black">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{subtitle}</p></div></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{count}</span></div><div className="mt-5">{children}</div></section>; }
function ItemCard({ title, subtitle, media, onDelete }: any) { return <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">{media ? <img src={media} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Sparkles className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{title}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{subtitle || "No description"}</div></div><button onClick={onDelete} className="h-9 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>; }
function SectionToggle({ label, initial, onChange }: any) { const [enabled,setEnabled]=useState(Boolean(initial)); useEffect(()=>setEnabled(Boolean(initial)),[initial]); return <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">{label}</span><button onClick={() => { const next=!enabled; setEnabled(next); onChange(next); }} className={`relative h-6 w-11 rounded-full transition ${enabled?"bg-blue-600":"bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled?"left-6":"left-1"}`} /></button></div>; }
