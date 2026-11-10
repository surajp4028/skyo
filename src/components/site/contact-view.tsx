"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Headphones, Mail, MessageSquareText, Phone, Scale, Send, UserRound } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Spotlight } from "@/components/ui/spotlight";
import { useAuth, useSite } from "@/lib/client/providers";
import { api, ClientApiError, errMsg } from "@/lib/client/api";
import { cn } from "@/lib/utils";

const TOPICS = [
  ["booking", "Booking help"],
  ["refund", "Refunds"],
  ["account", "My account"],
  ["partnership", "Partnership"],
  ["grievance", "Grievance"],
  ["other", "Something else"],
] as const;

export function ContactView() {
  const site = useSite();
  const { user } = useAuth();
  const [topic, setTopic] = useState<(typeof TOPICS)[number][0]>("booking");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone?.replace(/^\+91\s*/, "") || "");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <>
      <section className="relative -mt-20 overflow-hidden pb-32 pt-36">
        <div className="absolute inset-0 sky-fade" />
        <div className="absolute -right-16 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9),transparent_62%)]" />
        <Spotlight className="-top-40 left-0 md:left-60" fill="white" />
        <div className="relative mx-auto max-w-4xl px-5 text-center text-white">
          <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">We&apos;re here to help</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">Questions about a trip, a refund or your account? Write to us — a real person replies.</p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-20 grid max-w-6xl gap-5 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          {[
            { icon: Mail, t: "Email us", v: site.support_email, href: `mailto:${site.support_email}`, tone: "from-brand to-brand-2" },
            { icon: Phone, t: "Call us", v: site.support_phone, href: `tel:${site.support_phone.replace(/\s/g, "")}`, tone: "from-sky-500 to-indigo-500" },
            { icon: Clock3, t: "Response time", v: "Within 24 hours, every day", tone: "from-emerald-500 to-teal-400" },
            { icon: Scale, t: "Grievance officer", v: "Acknowledged in 24h · resolved within 15 days", href: "/privacy#grievance", tone: "from-violet-500 to-fuchsia-500" },
          ].map((c, i) => (
            <motion.a
              key={c.t}
              href={c.href}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              whileHover={{ y: -3 }}
              className={cn("group flex items-center gap-4 rounded-3xl border border-line bg-white p-5 shadow-soft", !c.href && "pointer-events-none")}
            >
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.tone} text-white shadow-lg`}><c.icon className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">{c.t}</div>
                <div className="truncate font-extrabold text-ink">{c.v}</div>
              </div>
            </motion.a>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="relative overflow-hidden rounded-[28px] border border-line bg-white p-6 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.35)] md:p-8">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 text-mint"><CheckCircle2 className="h-9 w-9" /></motion.span>
                <h2 className="mt-5 text-2xl font-extrabold">Message received</h2>
                <p className="mt-2 text-muted">Your reference number is</p>
                <div className="mt-2 rounded-2xl bg-ink px-5 py-2 font-mono text-xl font-extrabold tracking-wider text-white">{done}</div>
                <p className="mt-4 max-w-sm text-sm text-muted">We&apos;ll reply to <b className="text-ink">{email}</b> within 24 hours. Keep the reference handy.</p>
                <button onClick={() => (setDone(null), setMessage(""))} className="mt-6 text-sm font-bold text-brand hover:underline">Send another message</button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                exit={{ opacity: 0 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setErr(null);
                  try {
                    const r = await api<{ ref: string }>("/api/contact", { body: { name, email, phone: phone || "", topic, message, website } });
                    setDone(r.ref);
                  } catch (e) {
                    setErr({ field: e instanceof ClientApiError ? e.info.field : undefined, msg: errMsg(e) });
                    toast.error(errMsg(e));
                  } finally {
                    setBusy(false);
                  }
                }}
                className="space-y-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><MessageSquareText className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-xl font-extrabold">Send us a message</h2>
                    <p className="text-sm text-muted">Fields marked * are required.</p>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">What&apos;s it about? *</div>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setTopic(k)} className={cn("relative rounded-full px-3.5 py-1.5 text-xs font-bold transition", topic === k ? "text-white" : "bg-surface text-ink/65 hover:text-ink")}>
                        {topic === k && <motion.span layoutId="contact-topic" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
                        <span className="relative">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name *" name="name" autoComplete="name" icon={<UserRound className="h-4 w-4" />} value={name} onChange={(e) => setName(e.target.value.slice(0, 100))} error={err?.field === "name" ? err.msg : undefined} />
                  <Field label="Email *" name="email" type="email" autoComplete="email" icon={<Mail className="h-4 w-4" />} value={email} onChange={(e) => setEmail(e.target.value.slice(0, 190))} error={err?.field === "email" ? err.msg : undefined} />
                </div>
                <Field label="Mobile (optional)" name="phone" type="tel" inputMode="numeric" prefix="+91" icon={<Phone className="h-4 w-4" />} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} error={err?.field === "phone" ? err.msg : undefined} />
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Message *</label>
                  <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} rows={5} placeholder="Tell us what happened — include your SKYO ID or booking reference if you have one." className={cn("w-full resize-none rounded-xl border-2 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10", err?.field === "message" ? "border-red-300" : "border-line")} />
                  <div className="mt-1 flex justify-between text-xs text-muted"><span>{err?.field === "message" ? <span className="text-red-600">{err.msg}</span> : "Please don't share card numbers or passwords."}</span><span>{message.length}/2000</span></div>
                </div>
                <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!name || !email || message.trim().length < 10}>
                  <Send className="h-4 w-4" /> Send message
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted"><Headphones className="h-3.5 w-3.5" /> Your message is stored encrypted and only seen by our support team.</p>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
    </>
  );
}
