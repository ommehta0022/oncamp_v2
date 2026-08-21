"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { hasStudioSession, studioOtpStart, studioOtpVerify } from "@/lib/institutionStudioApi";

const countries = [
  { code: "IN", name: "India", dial: "+91", min: 10, max: 10, example: "98765 43210" },
  { code: "US", name: "United States", dial: "+1", min: 10, max: 10, example: "202 555 0123" },
  { code: "CA", name: "Canada", dial: "+1", min: 10, max: 10, example: "416 555 0123" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", min: 9, max: 9, example: "50 123 4567" },
  { code: "GB", name: "United Kingdom", dial: "+44", min: 9, max: 10, example: "7700 900123" },
  { code: "AU", name: "Australia", dial: "+61", min: 9, max: 9, example: "412 345 678" },
  { code: "NZ", name: "New Zealand", dial: "+64", min: 8, max: 10, example: "21 123 4567" },
  { code: "SG", name: "Singapore", dial: "+65", min: 8, max: 8, example: "8123 4567" },
  { code: "MY", name: "Malaysia", dial: "+60", min: 9, max: 10, example: "12 345 6789" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", min: 9, max: 9, example: "50 123 4567" },
  { code: "QA", name: "Qatar", dial: "+974", min: 8, max: 8, example: "3312 3456" },
  { code: "KW", name: "Kuwait", dial: "+965", min: 8, max: 8, example: "5001 2345" },
  { code: "OM", name: "Oman", dial: "+968", min: 8, max: 8, example: "9212 3456" },
  { code: "BH", name: "Bahrain", dial: "+973", min: 8, max: 8, example: "3600 1234" },
  { code: "DE", name: "Germany", dial: "+49", min: 10, max: 11, example: "1512 3456789" },
  { code: "FR", name: "France", dial: "+33", min: 9, max: 9, example: "6 12 34 56 78" },
  { code: "IT", name: "Italy", dial: "+39", min: 9, max: 10, example: "312 345 6789" },
  { code: "ES", name: "Spain", dial: "+34", min: 9, max: 9, example: "612 345 678" },
  { code: "NL", name: "Netherlands", dial: "+31", min: 9, max: 9, example: "6 12345678" },
  { code: "SE", name: "Sweden", dial: "+46", min: 9, max: 10, example: "70 123 45 67" },
  { code: "JP", name: "Japan", dial: "+81", min: 10, max: 10, example: "90 1234 5678" },
  { code: "KR", name: "South Korea", dial: "+82", min: 9, max: 10, example: "10 1234 5678" },
  { code: "ID", name: "Indonesia", dial: "+62", min: 9, max: 12, example: "812 3456 7890" },
  { code: "PH", name: "Philippines", dial: "+63", min: 10, max: 10, example: "917 123 4567" },
  { code: "ZA", name: "South Africa", dial: "+27", min: 9, max: 9, example: "82 123 4567" },
];

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhone(value: string) {
  if (value.length <= 7) return value;
  return `${value.slice(0, 4)} •••• ${value.slice(-4)}`;
}

export default function InstitutionStudioLogin() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState("IN");
  const [localNumber, setLocalNumber] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const country = useMemo(
    () => countries.find((item) => item.code === countryCode) || countries[0],
    [countryCode],
  );
  const cleanLocal = digits(localNumber);
  const phone = `${country.dial}${cleanLocal}`;
  const phoneValid = cleanLocal.length >= country.min && cleanLocal.length <= country.max && digits(phone).length <= 15;
  const codeValid = /^\d{6}$/.test(code);

  useEffect(() => {
    if (hasStudioSession()) router.replace("/studio");
  }, [router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function startOtp() {
    setTouched(true);
    if (!phoneValid) {
      setError(`Enter a valid ${country.name} phone number (${country.min}${country.max !== country.min ? `–${country.max}` : ""} digits).`);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await studioOtpStart(phone);
      setVerifiedPhone(data?.phone || phone);
      setDevMode(Boolean(data?.devMode));
      setCode("");
      setStep("code");
      setResendIn(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start institution login.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!codeValid) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await studioOtpVerify(verifiedPhone || phone, code);
      router.replace("/studio");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify institution login.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === "phone") await startOtp();
    else await verifyOtp();
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setError("");
    setBusy(true);
    try {
      const data = await studioOtpStart(verifiedPhone || phone);
      setVerifiedPhone(data?.phone || verifiedPhone || phone);
      setDevMode(Boolean(data?.devMode));
      setResendIn(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend OTP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#06172E] p-3 text-slate-900 sm:p-5 lg:p-7">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:min-h-[calc(100dvh-2.5rem)] sm:rounded-3xl xl:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-[#071A34] p-10 text-white xl:block 2xl:p-12">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-2xl" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="inline-flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><Building2 className="h-6 w-6" /></div>
              <div><div className="text-xl font-bold">OnCampus</div><div className="text-xs text-blue-100">Institution Studio</div></div>
            </div>
            <div className="my-auto py-12">
              <h1 className="max-w-lg text-4xl font-black leading-tight tracking-tight 2xl:text-5xl">Your complete digital campus, managed professionally.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-blue-100">Control your public profile, campus story, groups, events, students, content, analytics, moderation and integrations from one secure workspace.</p>
              <div className="mt-10 space-y-4">
                {[
                  [ShieldCheck, "Approved institution administrators only"],
                  [CheckCircle2, "Registered phone verification before access"],
                  [LockKeyhole, "Institution-scoped permissions and audit controls"],
                ].map(([Icon, text], index) => {
                  const C = Icon as any;
                  return <div key={index} className="flex items-center gap-3 text-sm text-blue-50"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10"><C className="h-4 w-4" /></div><span>{String(text)}</span></div>;
                })}
              </div>
            </div>
            <div className="text-xs leading-5 text-blue-200">Institution access is separated from student authentication.</div>
          </div>
        </section>

        <section className="flex min-h-[620px] min-w-0 flex-col justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-16 xl:min-h-[680px] xl:px-12 2xl:px-16">
          <div className="mx-auto w-full max-w-md min-w-0">
            <div className="mb-8 xl:hidden">
              <div className="inline-flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white"><Building2 className="h-5 w-5" /></div><div><div className="font-bold">OnCampus</div><div className="text-xs text-slate-500">Institution Studio</div></div></div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-blue-700"><ShieldCheck className="h-3.5 w-3.5" />Secure institution access</div>
            <h2 className="mt-4 text-[clamp(1.75rem,6vw,2.25rem)] font-black leading-tight tracking-tight text-slate-950">{step === "phone" ? "Sign in to Institution Studio" : "Verify your phone"}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {step === "phone"
                ? "Use only the phone number registered with your approved institution administrator account."
                : <>Enter the 6-digit OTP for <span className="font-bold text-slate-700">{maskPhone(verifiedPhone || phone)}</span>.</>}
            </p>

            <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
              {step === "phone" ? (
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Registered institution phone</span>
                  <div className={`grid min-w-0 grid-cols-[minmax(112px,auto)_1fr] overflow-hidden rounded-2xl border bg-slate-50 transition focus-within:ring-4 ${touched && !phoneValid ? "border-red-300 focus-within:border-red-400 focus-within:ring-red-50" : "border-slate-200 focus-within:border-blue-500 focus-within:ring-blue-50"}`}>
                    <div className="relative border-r border-slate-200 bg-white">
                      <select
                        aria-label="Country calling code"
                        value={countryCode}
                        onChange={(e) => { setCountryCode(e.target.value); setLocalNumber(""); setError(""); setTouched(false); }}
                        className="h-14 w-full min-w-0 appearance-none bg-transparent py-0 pl-3 pr-7 text-sm font-bold text-slate-700 outline-none"
                      >
                        {countries.map((item) => <option key={`${item.code}-${item.dial}`} value={item.code}>{item.code} {item.dial}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">▼</span>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 px-3">
                      <Phone className="h-5 w-5 shrink-0 text-slate-400" />
                      <input
                        required
                        autoFocus
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-invalid={touched && !phoneValid}
                        value={localNumber}
                        onBlur={() => setTouched(true)}
                        onChange={(e) => { const next = digits(e.target.value).slice(0, country.max); setLocalNumber(next); setError(""); }}
                        placeholder={country.example}
                        className="h-14 min-w-0 w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400"><span>{country.name} · {country.dial}</span><span>{cleanLocal.length}/{country.max} digits</span></div>
                </label>
              ) : (
                <label className="block min-w-0">
                  <span className="mb-2 block text-sm font-semibold text-slate-700">6-digit OTP</span>
                  <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50">
                    <KeyRound className="h-5 w-5 shrink-0 text-slate-400" />
                    <input
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => { setCode(digits(e.target.value).slice(0, 6)); setError(""); }}
                      placeholder="••••••"
                      className="h-14 min-w-0 w-full bg-transparent text-xl font-black tracking-[.28em] outline-none sm:text-2xl sm:tracking-[.4em]"
                    />
                  </div>
                  {devMode ? <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Development OTP: <b>123456</b></div> : null}
                </label>
              )}

              {error ? <div role="alert" aria-live="polite" className="break-words rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div> : null}

              <button
                disabled={busy || (step === "phone" ? !phoneValid : !codeValid)}
                className="flex h-14 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-center text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
              >
                {busy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : null}
                <span className="truncate">{step === "phone" ? "Send OTP" : "Open Institution Studio"}</span>
                {!busy ? <ArrowRight className="h-4 w-4 shrink-0" /> : null}
              </button>

              {step === "code" ? (
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" onClick={() => { setStep("phone"); setCode(""); setError(""); setDevMode(false); setResendIn(0); }} className="inline-flex items-center justify-center gap-1.5 font-semibold text-slate-500 hover:text-slate-800 sm:justify-start"><ArrowLeft className="h-4 w-4" />Change number</button>
                  <button type="button" disabled={busy || resendIn > 0} onClick={() => void resend()} className="font-bold text-blue-600 disabled:text-slate-400">{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}</button>
                </div>
              ) : null}
            </form>

            <div className="mt-8 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><span>Student accounts, unregistered numbers and non-approved institution accounts are rejected before Studio access is granted.</span></div>
          </div>
        </section>
      </div>
    </main>
  );
}
