"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AtSign, Briefcase, Eye, EyeOff, KeyRound, Mail, Phone, Plane, ShieldCheck, UserRound, Zap } from "lucide-react";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { api, errMsg } from "@/lib/client/api";
import { useAuth, useSite, type Me } from "@/lib/client/providers";
import { OtpStep } from "./otp-step";
import { StepHeader } from "./auth-shell";
import { safeNext } from "./use-countdown";

type Mode = "traveller" | "agent";

export function LoginPanel() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("as") === "agent" ? "agent" : "traveller");
  return (
    <div>
      <AnimatedTabs
        className="mb-8 w-full rounded-full bg-surface p-1"
        tabClassName="flex-1 justify-center"
        layoutId="login-mode"
        value={mode}
        onChange={setMode}
        tabs={[
          { value: "traveller", label: "Traveller", icon: <Plane className="h-4 w-4" /> },
          { value: "agent", label: "Agent login", icon: <Briefcase className="h-4 w-4" /> },
        ]}
      />
      <AnimatePresence mode="wait">
        <motion.div key={mode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
          {mode === "traveller" ? <TravellerLogin /> : <AgentLogin />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TravellerLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser, user } = useAuth();
  const site = useSite();
  const [step, setStep] = useState<"id" | "otp" | "name">("id");
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ challengeId: string; sentTo: string; resendIn: number } | null>(null);
  const [name, setName] = useState("");

  const isPhone = /^[\d\s+-]+$/.test(identifier) && identifier.replace(/\D/g, "").length >= 3;
  const next = safeNext(params.get("next"));

  useEffect(() => {
    if (user && step === "id") router.replace(next);
  }, [user, step, next, router]);

  const send = async () => {
    const r = await api<{ challengeId: string; sentTo: string; resendIn: number }>("/api/auth/otp/send", { body: { identifier } });
    setChallenge(r);
    return r.resendIn;
  };

  return step === "id" ? (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await send();
          setStep("otp");
        } catch (e) {
          setErr(errMsg(e));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-5"
    >
      <StepHeader eyebrow="Log in or sign up" title={`Welcome to ${site.site_name}`} sub="Enter your mobile number or email — we'll send a one-time code. No password needed." />
      <Field
        label="Email or mobile number"
        name="identifier"
        autoFocus
        autoComplete="username"
        inputMode={isPhone ? "tel" : "email"}
        prefix={isPhone ? "+91" : undefined}
        icon={isPhone ? <Phone className="h-4 w-4" /> : <AtSign className="h-4 w-4" />}
        placeholder="you@example.com or 98XXXXXXXX"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value.slice(0, 190))}
        error={err || undefined}
      />
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={identifier.trim().length < 5}>
        {busy ? "Sending code…" : isPhone ? "Send OTP by SMS" : identifier.includes("@") ? "Send OTP by email" : "Get OTP"}
      </Button>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-muted">
        {[
          [ShieldCheck, "Secure OTP"],
          [Zap, "Instant login"],
          [KeyRound, "No password"],
        ].map(([Icon, t]) => {
          const I = Icon as typeof ShieldCheck;
          return (
            <span key={t as string} className="flex items-center justify-center gap-1.5 rounded-xl bg-surface px-2 py-2">
              <I className="h-3.5 w-3.5 text-[#0057ff]" /> {t as string}
            </span>
          );
        })}
      </div>
      <p className="text-center text-xs leading-relaxed text-muted">
        By continuing you agree to our <Link href="/terms" className="font-semibold text-ink underline">Terms</Link> and{" "}
        <Link href="/privacy" className="font-semibold text-ink underline">Privacy Policy</Link>. New here? An account is created automatically.
      </p>
      <div className="relative py-2 text-center text-xs font-semibold uppercase tracking-widest text-muted before:absolute before:left-0 before:top-1/2 before:h-px before:w-full before:bg-line">
        <span className="relative bg-white px-3">or</span>
      </div>
      <Link href="/register" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-bold text-ink transition hover:border-ink/30">
        <UserRound className="h-4 w-4" /> Create a full account (email + mobile)
      </Link>
    </form>
  ) : step === "otp" && challenge ? (
    <div>
      <StepHeader eyebrow="Almost there" title="Enter the 6-digit code" />
      <OtpStep
        sentTo={challenge.sentTo}
        resendIn={challenge.resendIn}
        onBack={() => setStep("id")}
        onResend={send}
        onVerify={async (code) => {
          try {
            const r = await api<{ user: Me; isNew: boolean }>("/api/auth/otp/verify", { body: { challengeId: challenge.challengeId, code } });
            setUser(r.user);
            if (!r.user.name) setStep("name");
            else {
              toast.success(`Welcome back, ${r.user.name.split(" ")[0]}!`);
              router.replace(next);
            }
          } catch (e) {
            throw new Error(errMsg(e));
          }
        }}
      />
    </div>
  ) : (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = await api<{ user: Me }>("/api/account/profile", { method: "PATCH", body: { name } });
          setUser(r.user);
          toast.success("You're all set!");
          router.replace(next);
        } catch (e) {
          setErr(errMsg(e));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-5"
    >
      <StepHeader title="You're in! 🎉" sub="What should we call you? This appears on your tickets." />
      <Field label="Full name (as on ID)" name="name" autoFocus autoComplete="name" icon={<UserRound className="h-4 w-4" />} value={name} onChange={(e) => setName(e.target.value)} error={err || undefined} />
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={name.trim().length < 2}>
        Save & continue
      </Button>
      <button type="button" onClick={() => router.replace(next)} className="w-full text-center text-sm font-semibold text-muted hover:text-ink">
        Skip for now
      </button>
    </form>
  );
}

function AgentLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/admin/auth/login", { body: { email, password } });
          window.location.replace("/admin");
        } catch (e) {
          setErr(errMsg(e));
          setPassword("");
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-5"
    >
      <StepHeader title="Agent console" sub="For admins & staff. Your session ends when you close the browser or after 30 minutes of inactivity." />
      <Field label="Work email" name="email" type="email" autoComplete="username" icon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
      <div className="relative">
        <Field label="Password" name="password" type={show ? "text" : "password"} autoComplete="current-password" icon={<KeyRound className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-[38px] p-1.5 text-muted" aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{err}</p>}
      <Button type="submit" variant="dark" size="lg" className="w-full" loading={busy} disabled={!email || !password}>
        Sign in to console
      </Button>
      <p className="text-center text-xs text-muted">Access is monitored and logged. Unauthorised access is prohibited.</p>
    </form>
  );
}
