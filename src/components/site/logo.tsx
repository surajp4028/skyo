"use client";
import Link from "next/link";
import { useSite } from "@/lib/client/providers";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} aria-hidden>
      <defs>
        <linearGradient id="lg-skyo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a1f" />
          <stop offset="1" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#0a0f1f" />
      <path d="M14 40c10-2 22-10 34-22-4 10-10 20-20 26 6-1 12-3 18-7-7 9-18 13-32 3z" fill="url(#lg-skyo)" />
    </svg>
  );
}

/** Brand name comes from Admin → Settings, so renaming updates every page. */
export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  const { site_name } = useSite();
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label={`${site_name} home`}>
      <LogoMark />
      <span className={cn("text-xl font-extrabold tracking-tight", dark ? "text-white" : "text-ink")}>{site_name}</span>
    </Link>
  );
}
