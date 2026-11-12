"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Lock, Plane, ShieldCheck, TrainFront } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { CloudShader } from "@/components/ui/cloud-shader";
import { useSite } from "@/lib/client/providers";

export function AuthShell({ children, quote }: { children: ReactNode; image?: string; quote?: string }) {
  const site = useSite();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        {/* Aceternity Cloud Shader sky + window-seat wing — same sky as the rest of SKYO */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#3f8ef0] to-[#0646c8]" />
        <motion.div aria-hidden className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4 }}>
          <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
            <CloudShader speed={1} count={5} skyTopColor="#0646c8" skyBottomColor="#3f8ef0" className="absolute inset-0" />
          </div>
        </motion.div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_30%_65%,rgba(3,25,80,0.45),transparent_75%)]" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-4 -right-6 w-[78%]"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image src="/images/plane-wing.png" alt="" width={2200} height={1227} priority className="h-auto w-full -scale-x-100 opacity-95" />
        </motion.div>
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Logo dark />
          <div className="relative">
            {/* floating travel cards */}
            <motion.div initial={{ opacity: 0, y: 20, rotate: -4 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ delay: 0.3 }} className="absolute -top-56 right-4 w-60 animate-float rounded-2xl border border-white/25 bg-white/15 p-4 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/70"><span>Boarding pass</span><Plane className="h-3.5 w-3.5" /></div>
              <div className="mt-2 flex items-end justify-between"><span className="text-2xl font-extrabold">DEL</span><span className="mb-2 mx-2 flex-1 border-t-2 border-dashed border-white/30" /><span className="text-2xl font-extrabold">GOI</span></div>
              <div className="mt-2 text-[11px] text-white/75">Seat 14A · Gate 23 · On time</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 3 }} transition={{ delay: 0.5 }} className="mb-8 w-72 animate-float rounded-2xl border border-white/25 bg-white/15 p-4 text-white shadow-2xl backdrop-blur-xl [animation-delay:1.4s]">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> 81% chance of confirmation</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold"><TrainFront className="h-4 w-4 text-amber-300" /> 12952 Rajdhani · 3A · GNWL 36</div>
            </motion.div>
            <TextGenerateEffect words={quote || "Every journey deserves a calm start. Log in once — we'll remember you."} className="max-w-lg font-display text-4xl leading-tight text-white xl:text-5xl" />
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/85">
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur"><Lock className="h-3.5 w-3.5" /> AES-256 · AWS KMS</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur"><ShieldCheck className="h-3.5 w-3.5" /> DPDP compliant</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur"><BadgeCheck className="h-3.5 w-3.5" /> No passwords to leak</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="relative flex flex-col overflow-hidden bg-surface">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sky/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="relative flex items-center justify-between p-6 lg:hidden"><Logo /></div>
        <div className="relative flex flex-1 items-center justify-center px-5 py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 24 }} className="relative w-full max-w-[460px] overflow-hidden rounded-[32px] border border-white bg-white/95 p-7 shadow-[0_40px_100px_-40px_rgba(10,15,31,0.45)] ring-1 ring-black/[0.03] backdrop-blur-xl sm:p-9">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#0057ff] via-brand to-brand-2" />
            {children}
          </motion.div>
        </div>
        <p className="relative px-6 pb-6 text-center text-xs text-muted">
          Need help? <a href="/contact" className="font-semibold text-ink hover:underline">Contact us</a> · {site.support_email}
        </p>
      </main>
    </div>
  );
}

export function StepHeader({ title, sub, eyebrow }: { title: string; sub?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7">
      {eyebrow && <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand">{eyebrow}</div>}
      <h1 className="text-[28px] font-lux font-bold leading-tight tracking-[-0.01em] text-ink sm:text-3xl">{title}</h1>
      {sub && <p className="mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}
