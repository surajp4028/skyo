"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AtSign, Check, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api, errMsg } from "@/lib/client/api";
import { useAuth, type Me } from "@/lib/client/providers";
import { OtpStep } from "./otp-step";
import { StepHeader } from "./auth-shell";
import { cn } from "@/lib/utils";

type Challenge = { challengeId: string; sentTo: string; resendIn: number };
const STEPS = ["Email", "Mobile", "Confirm"];

export function RegisterFlow() {
  const router = useRouter();
  const { setUser, user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailTicket, setEmailTicket] = useState("");
  const [phoneTicket, setPhoneTicket] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user && step === 0 && !challenge) router.replace("/account");
  }, [user, step, challenge, router]);

  const send = async (channel: "email" | "phone") => {
    const r = await api<Challenge>("/api/auth/register/send", { body: channel === "email" ? { channel, value: email, name } : { channel, value: phone, name } });
    setChallenge(r);
    return r.resendIn;
  };
  const verify = async (code: string) => {
    try {
      const r = await api<{ channel: "email" | "phone"; ticket: string }>("/api/auth/register/verify", { body: { challengeId: challenge!.challengeId, code } });
      if (r.channel === "email") {
        setEmailTicket(r.ticket);
        setStep(1);
      } else {
        setPhoneTicket(r.ticket);
        setStep(2);
      }
      setChallenge(null);
      toast.success(`${r.channel === "email" ? "Email" : "Mobile"} verified`);
    } catch (e) {
      throw new Error(errMsg(e));
    }
  };
  const run = (fn: () => Promise<unknown>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition", i < step ? "bg-mint text-white" : i === step ? "bg-ink text-white" : "bg-surface text-muted")}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("text-xs font-bold", i <= step ? "text-ink" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded", i < step ? "bg-mint" : "bg-line")} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={`${step}-${!!challenge}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
          {step === 0 && !challenge && (
            <form onSubmit={run(() => send("email"))} className="space-y-5">
              <StepHeader title="Create your account" sub="Start with your name and email. We'll verify it with a code." />
              <Field label="Full name (as on ID)" name="name" autoFocus autoComplete="name" icon={<UserRound className="h-4 w-4" />} value={name} onChange={(e) => setName(e.target.value.slice(0, 100))} placeholder="Aarav Mehta" />
              <Field label="Email address" name="email" type="email" autoComplete="email" icon={<AtSign className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value.slice(0, 190))} placeholder="you@example.com" error={err || undefined} />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={name.trim().length < 2 || !email.includes("@")}>
                Send email OTP
              </Button>
              <p className="text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-bold text-brand">Log in</Link></p>
            </form>
          )}
          {step === 1 && !challenge && (
            <form onSubmit={run(() => send("phone"))} className="space-y-5">
              <StepHeader title="Add your mobile" sub="Used for ticket SMS, PNR alerts and secure login." />
              <Field label="Mobile number" name="phone" type="tel" inputMode="numeric" autoFocus autoComplete="tel-national" prefix="+91" icon={<Phone className="h-4 w-4" />} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 10))} placeholder="98765 43210" error={err || undefined} />
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={phone.length !== 10}>
                Send SMS OTP
              </Button>
            </form>
          )}
          {challenge && (
            <div>
              <StepHeader title={step === 0 ? "Verify your email" : "Verify your mobile"} />
              <OtpStep sentTo={challenge.sentTo} resendIn={challenge.resendIn} onBack={() => setChallenge(null)} onResend={() => send(step === 0 ? "email" : "phone")} onVerify={verify} />
            </div>
          )}
          {step === 2 && (
            <form
              onSubmit={run(async () => {
                const r = await api<{ user: Me }>("/api/auth/register/complete", { body: { name, emailTicket, phoneTicket, consent } });
                setUser(r.user);
                toast.success(`Welcome aboard, ${name.split(" ")[0]}!`);
                router.replace("/");
              })}
              className="space-y-5"
            >
              <StepHeader title="Almost there" sub="Review your details and create your account." />
              <div className="divide-y divide-line rounded-2xl border border-line">
                {[["Name", name, UserRound], ["Email", email, AtSign], ["Mobile", `+91 ${phone}`, Phone]].map(([k, v, Icon]) => {
                  const I = Icon as typeof Phone;
                  return (
                    <div key={k as string} className="flex items-center gap-3 px-4 py-3.5">
                      <I className="h-4 w-4 text-muted" />
                      <div className="flex-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{k as string}</div>
                        <div className="text-sm font-semibold text-ink">{v as string}</div>
                      </div>
                      {k !== "Name" && <span className="flex items-center gap-1 rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-mint"><Check className="h-3 w-3" /> Verified</span>}
                    </div>
                  );
                })}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 text-sm leading-relaxed text-ink/80">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ff5a1f]" />
                <span>
                  I agree to the <Link href="/terms" className="font-semibold underline">Terms of Use</Link> and consent to processing of my data as per the{" "}
                  <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link> (DPDP Act, 2023). I can withdraw consent anytime.
                </span>
              </label>
              {err && <p className="text-sm font-medium text-red-600">{err}</p>}
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!consent}>
                <ShieldCheck className="h-4 w-4" /> Create my account
              </Button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
