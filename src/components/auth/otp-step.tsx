"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Loader2, Mail, MessageSquareText, PencilLine, RotateCw } from "lucide-react";
import { OtpInput } from "@/components/ui/otp-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCountdown } from "./use-countdown";

/** Reusable OTP verification step (login + both registration steps). */
export function OtpStep({
  sentTo,
  resendIn,
  onVerify,
  onResend,
  onBack,
  cta = "Verify & continue",
}: {
  sentTo: string;
  resendIn: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<number | void>;
  onBack: () => void;
  cta?: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useCountdown(resendIn);
  const [total, setTotal] = useState(resendIn || 45);
  const [resend, setResend] = useState<"idle" | "sending" | "sent">("idle");
  const isEmail = sentTo.includes("@");

  const submit = async (c = code) => {
    if (c.length !== 6 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onVerify(c);
    } catch (e) {
      setErr((e as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const doResend = async () => {
    setErr(null);
    setResend("sending");
    try {
      const s = await onResend();
      const n = typeof s === "number" ? s : 45;
      setCode("");
      setTotal(n);
      setLeft(n);
      setResend("sent");
      setTimeout(() => setResend("idle"), 2600);
    } catch (e) {
      setErr((e as Error).message);
      setResend("idle");
    }
  };

  // countdown ring
  const R = 9;
  const C = 2 * Math.PI * R;
  const frac = total > 0 ? left / total : 0;

  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())} className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-gradient-to-br from-sky-50 to-white p-3.5">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0057ff] text-white shadow-[0_10px_24px_-10px_rgba(0,87,255,.8)]">
          {isEmail ? <Mail className="h-5 w-5" /> : <MessageSquareText className="h-5 w-5" />}
          <AnimatePresence>
            {resend === "sending" && (
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, repeat: Infinity }} className="absolute inset-0 rounded-xl ring-2 ring-[#0057ff]/40" />
            )}
          </AnimatePresence>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-muted">{isEmail ? "Code sent by email to" : "Code sent by SMS to"}</div>
          <div className="truncate text-sm font-extrabold text-ink">{sentTo}</div>
        </div>
        <button type="button" onClick={onBack} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-[#0057ff] hover:bg-sky-100">
          <PencilLine className="h-3.5 w-3.5" /> Change
        </button>
      </div>

      <OtpInput value={code} onChange={setCode} onComplete={(c) => submit(c)} disabled={busy || resend === "sending"} error={!!err} />
      <AnimatePresence>
        {err && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {err}
          </motion.p>
        )}
      </AnimatePresence>
      <Button type="submit" className="w-full" size="lg" loading={busy} disabled={code.length !== 6}>
        {cta}
      </Button>

      <div className="flex min-h-10 items-center justify-center text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {resend === "sending" ? (
            <motion.span key="sending" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 font-bold text-[#0057ff]">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending a new code…
            </motion.span>
          ) : resend === "sent" ? (
            <motion.span key="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 font-bold text-emerald-700">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3" />
              </motion.span>
              New code sent to {sentTo}
            </motion.span>
          ) : left > 0 ? (
            <motion.span key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-muted">
              <svg viewBox="0 0 24 24" className="h-6 w-6 -rotate-90" aria-hidden>
                <circle cx="12" cy="12" r={R} fill="none" stroke="#e7e9f2" strokeWidth="2.5" />
                <circle cx="12" cy="12" r={R} fill="none" stroke="#0057ff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              </svg>
              Resend code in <b className="tabular-nums text-ink">0:{String(left).padStart(2, "0")}</b>
            </motion.span>
          ) : (
            <motion.button
              key="resend"
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={doResend}
              className={cn("group flex items-center gap-2 rounded-full border border-brand/30 bg-orange-50 px-4 py-2 font-bold text-brand transition hover:bg-brand hover:text-white")}
            >
              <RotateCw className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180" /> Resend code
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center text-xs leading-relaxed text-muted">
        {isEmail ? "Didn't get it? Check your spam folder." : "SMS can take up to a minute. Didn't get it? Resend, or log in with your email instead."}
      </p>
      <button type="button" onClick={onBack} className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Use a different email or number
      </button>
    </form>
  );
}
