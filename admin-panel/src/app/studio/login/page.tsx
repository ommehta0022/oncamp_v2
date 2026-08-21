"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, KeyRound, Loader2, Phone, ShieldCheck } from "lucide-react";
import { hasStudioSession, studioOtpStart, studioOtpVerify } from "@/lib/institutionStudioApi";

export default function InstitutionStudioLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (hasStudioSession()) router.replace("/studio"); }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setBusy(true);
    try {
      if (step === "phone") {
        await studioOtpStart(phone.trim());
        setStep("code");
      } else {
        await studioOtpVerify(phone.trim(), code.trim());
        router.replace("/studio");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#06172E] p-4 text-slate-900 grid place-items-center">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden min-h-[650px] overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-[#071A34] p-12 text-white lg:block">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-2xl" />
        <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative z-10"><div className="inline-flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Building2 className="h-6 w-6" /></div><div><div className="text-xl font-bold">OnCampus</div><div className="text-xs text-blue-100">Institution Studio</div></div></div>
        <h1 className="mt-16 max-w-md text-4xl font-black leading-tight tracking-tight">Your complete digital campus, managed professionally.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">Control your public profile, campus story, groups, events, students, content, analytics, moderation and integrations from one secure workspace.</p>
        <div className="mt-12 space-y-5">{[
          [ShieldCheck, "Institution-scoped security and permissions"],
          [CheckCircle2, "Live student-facing preview and publishing"],
          [CheckCircle2, "Audit-ready governance, backups and integrations"],
        ].map(([Icon, text], index) => { const C = Icon as any; return <div key={index} className="flex items-center gap-3 text-sm text-blue-50"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><C className="h-4 w-4" /></div>{String(text)}</div>; })}</div></div>
      </section>
      <section className="flex min-h-[650px] flex-col justify-center p-7 sm:p-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden"><div className="inline-flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white"><Building2 className="h-5 w-5" /></div><div><div className="font-bold">OnCampus</div><div className="text-xs text-slate-500">Institution Studio</div></div></div></div>
          <div className="text-sm font-bold uppercase tracking-[.18em] text-blue-600">Secure institution access</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight">{step === "phone" ? "Sign in with your phone" : "Verify your OTP"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">{step === "phone" ? "Use the phone number linked to your approved institution administrator account." : `We sent a verification code to ${phone}.`}</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {step === "phone" ? <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50"><Phone className="h-5 w-5 text-slate-400" /><input required autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none" /></div></label> : <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">6-digit code</span><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50"><KeyRound className="h-5 w-5 text-slate-400" /><input required autoFocus inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="h-14 min-w-0 flex-1 bg-transparent text-xl font-bold tracking-[.35em] outline-none" /></div></label>}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <button disabled={busy || (step === "phone" ? phone.trim().length < 10 : code.length < 6)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{step === "phone" ? "Send OTP" : "Open Institution Studio"}<ArrowRight className="h-4 w-4" /></button>
            {step === "code" ? <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(""); }} className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-800">Use another phone number</button> : null}
          </form>
          <p className="mt-8 text-xs leading-5 text-slate-400">Only approved institution administrators can access this workspace. Student accounts are rejected automatically.</p>
        </div>
      </section>
    </div>
  </main>;
}
