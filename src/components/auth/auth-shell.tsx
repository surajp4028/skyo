"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Lock, ShieldCheck, TrainFront } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { Spotlight } from "@/components/ui/spotlight";
import { useSite } from "@/lib/client/providers";
import { IMAGES, img } from "@/lib/utils";

export function AuthShell({ children, image = IMAGES.keralaBoat, quote }: { children: ReactNode; image?: string; quote?: string }) {
  const site = useSite();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <Image src={img(image, 1600)} alt="" fill priority sizes="50vw" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
        <Spotlight className="-top-40 left-0" fill="#ff8a3d" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <Logo dark />
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-8 w-72 rounded-2xl border border-white/15 bg-white/10 p-4 text-white backdrop-blur-xl animate-float">
              <div className="flex items-center gap-2 text-xs font-bold text-mint"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> 94% chance of confirmation</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold"><TrainFront className="h-4 w-4 text-brand-2" /> WL 12 → likely CNF by chart prep</div>
            </motion.div>
            <TextGenerateEffect words={quote || "Every journey deserves a calm start. Log in once — we'll remember you."} className="max-w-lg font-display text-4xl leading-tight text-white xl:text-5xl" />
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/70">
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur"><Lock className="h-3.5 w-3.5" /> AES-256 encrypted</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur"><ShieldCheck className="h-3.5 w-3.5" /> DPDP compliant</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur"><BadgeCheck className="h-3.5 w-3.5" /> No passwords to leak</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="relative flex flex-col bg-white">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_60%)]" />
        <div className="relative flex items-center justify-between p-6 lg:hidden"><Logo /></div>
        <div className="relative flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
        <p className="relative px-6 pb-6 text-center text-xs text-muted">
          Need help? {site.support_email} · {site.support_phone}
        </p>
      </main>
    </div>
  );
}

export function StepHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
      {sub && <p className="mt-2 text-[15px] text-muted">{sub}</p>}
    </div>
  );
}
