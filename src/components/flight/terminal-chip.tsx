import { DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** Highlighted terminal pill — the one thing travellers must not miss. */
export function TerminalChip({ t, dark, right, className }: { t: string | null | undefined; dark?: boolean; right?: boolean; className?: string }) {
  return (
    <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide", dark ? "bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/30" : "bg-sky-50 text-[#0057ff] ring-1 ring-sky-200", right && "ml-auto", className)}>
      <DoorOpen className="h-3 w-3" /> Terminal {t || "TBA"}
    </span>
  );
}
