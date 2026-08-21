"use client";

import React, { useRef, useState } from "react";
import {
  Bold,
  Check,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Loader2,
  Quote,
  Redo2,
  Sparkles,
  Underline,
  UploadCloud,
} from "lucide-react";
import { institutionStudioApi } from "@/lib/institutionStudioApi";

export function StudioActionButton({
  run,
  children,
  className = "",
  disabled = false,
  busyText = "Working…",
}: {
  run: () => Promise<any>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  busyText?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "success">("idle");
  async function handle() {
    if (disabled || state === "busy") return;
    setState("busy");
    try {
      await run();
      setState("success");
      window.setTimeout(() => setState("idle"), 1100);
    } catch (error) {
      setState("idle");
      throw error;
    }
  }
  return (
    <button
      type="button"
      aria-busy={state === "busy"}
      disabled={disabled || state === "busy"}
      onClick={() => void handle()}
      className={`studio-action inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "success" ? <Check className="h-4 w-4" /> : null}
      {state === "busy" ? busyText : state === "success" ? "Done" : children}
    </button>
  );
}

export function StudioNotice({ text, tone = "info" }: { text?: string; tone?: "info" | "success" | "error" }) {
  if (!text) return null;
  const style = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  return <div role="status" className={`studio-notice rounded-xl border px-4 py-3 text-sm font-medium ${style}`}>{text}</div>;
}

export function StudioMediaUploader({
  value,
  onUploaded,
  label = "Upload image or video",
  accept = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime",
  maxMb = 50,
  compact = false,
}: {
  value?: string;
  onUploaded: (url: string, file: File) => void | Promise<void>;
  label?: string;
  accept?: string;
  maxMb?: number;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File must be ${maxMb} MB or smaller.`);
      return;
    }
    setError("");
    setBusy(true);
    setProgress(1);
    try {
      const result = await institutionStudioApi.uploadMedia(file, (p: number) => setProgress(Math.max(1, p)));
      await onUploaded(result.url, file);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <img src={value} alt="Uploaded media preview" className={`w-full object-cover ${compact ? "h-28" : "h-44"}`} />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files?.[0]); }}
        className={`group flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 ${compact ? "min-h-20 px-3 py-3" : "min-h-28 px-4 py-5"}`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
        <span className="text-left"><span className="block text-sm font-bold">{busy ? `Uploading ${progress}%` : label}</span><span className="block text-[11px] text-slate-400">Drag & drop or click · max {maxMb} MB</span></span>
      </button>
      <input ref={inputRef} className="hidden" type="file" accept={accept} onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      {busy ? <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div> : null}
      {error ? <div className="text-xs font-semibold text-red-600">{error}</div> : null}
    </div>
  );
}

const DEFAULT_TEMPLATES = [
  {
    name: "Campus announcement",
    title: "Important campus update",
    body: "Hello students,\n\nWe have an important campus update to share.\n\n• What is changing:\n• When it takes effect:\n• What you need to do:\n\nThank you,\nInstitution Administration",
  },
  {
    name: "Event promotion",
    title: "You’re invited: Campus event",
    body: "Join us for an upcoming campus event.\n\n📅 Date:\n🕒 Time:\n📍 Venue:\n\nWhat to expect:\n• Key sessions\n• Networking\n• Student activities\n\nWe look forward to seeing you there.",
  },
  {
    name: "Opportunity",
    title: "New opportunity for students",
    body: "A new student opportunity is now available.\n\n🎯 Opportunity:\n🏢 Organization:\n📍 Location:\n⏳ Deadline:\n\nEligibility:\n\nHow to apply:\n",
  },
  {
    name: "Emergency / urgent",
    title: "Urgent campus notice",
    body: "URGENT NOTICE\n\nPlease read the following information carefully.\n\nWhat happened:\n\nRequired action:\n\nNext update:\n",
  },
];

export function StudioRichEditor({
  title,
  body,
  onTitle,
  onBody,
  onMedia,
  coverUrl,
  maxLength = 12000,
}: {
  title: string;
  body: string;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onMedia?: (url: string, file: File) => void | Promise<void>;
  coverUrl?: string;
  maxLength?: number;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  function insert(before: string, after = "") {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const next = `${body.slice(0, start)}${before}${selected}${after}${body.slice(end)}`;
    onBody(next.slice(0, maxLength));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-black uppercase tracking-wide text-slate-500">Advanced editor</label>
        <button type="button" onClick={() => setShowTemplates((v) => !v)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"><Sparkles className="h-3.5 w-3.5" />Templates</button>
      </div>
      {showTemplates ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{DEFAULT_TEMPLATES.map((template) => <button key={template.name} type="button" onClick={() => { onTitle(template.title); onBody(template.body); setShowTemplates(false); }} className="rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50">{template.name}</button>)}</div> : null}
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Title</span><input value={title} maxLength={180} onChange={(e) => onTitle(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50" placeholder="Write a clear title" /></label>
      {onMedia ? <StudioMediaUploader value={coverUrl} onUploaded={onMedia} label={coverUrl ? "Replace cover media" : "Add cover media"} compact /> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 p-2">
          <ToolbarButton label="Bold" onClick={() => insert("**", "**")}><Bold className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => insert("_", "_")}><Italic className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => insert("__", "__")}><Underline className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Bulleted list" onClick={() => insert("\n• ")}><List className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Quote" onClick={() => insert("\n> ")}><Quote className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Link" onClick={() => insert("[", "](https://)")}><Link2 className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Image reference" onClick={() => insert("\n🖼️ ")}><ImageIcon className="h-4 w-4" /></ToolbarButton>
          <ToolbarButton label="Divider" onClick={() => insert("\n────────────\n")}><Redo2 className="h-4 w-4" /></ToolbarButton>
        </div>
        <textarea ref={area} value={body} maxLength={maxLength} onChange={(e) => onBody(e.target.value)} rows={14} className="w-full resize-y border-0 px-4 py-3 text-sm leading-6 outline-none" placeholder="Write the official content…" />
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400"><span>Formatting shortcuts and templates are saved as plain portable content.</span><span>{body.length.toLocaleString()} / {maxLength.toLocaleString()}</span></div>
      </div>
    </div>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-white hover:text-blue-700 hover:shadow-sm">{children}</button>;
}
