"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Search } from "lucide-react";
import { StationInput } from "./station-input";
import { DatePicker } from "@/components/ui/date-picker";
import { parseStationInput } from "@/lib/train/stations";
import { QUOTAS } from "@/lib/train/format";
import { cn } from "@/lib/utils";

export type TrainQuery = { from: string; fromLabel: string; to: string; toLabel: string; date: string; quota: string };

/** Compact train search used on the results page header. */
export function TrainSearchBar({ initial, compact }: { initial: TrainQuery; compact?: boolean }) {
  const router = useRouter();
  const [from, setFrom] = useState(initial.fromLabel);
  const [to, setTo] = useState(initial.toLabel);
  const [date, setDate] = useState(initial.date);
  const [quota, setQuota] = useState(initial.quota);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const f = parseStationInput(from);
    const t = parseStationInput(to);
    if (!f || !t) return toast.error("Pick stations from the suggestions");
    if (f === t) return toast.error("From and To can't be the same");
    router.push(`/trains?${new URLSearchParams({ from: f, to: t, date, quota, fl: from, tl: to })}`);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
        <StationInput label="From" value={from} onChange={(l) => setFrom(l)} />
        <button type="button" onClick={() => (setFrom(to), setTo(from))} aria-label="Swap" className="z-10 -my-3 mx-auto flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border border-line bg-white text-brand shadow-soft transition hover:rotate-180 md:-mx-4 md:my-0">
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <StationInput label="To" value={to} onChange={(l) => setTo(l)} />
        <DatePicker label="Journey date" value={date} onChange={setDate} className="md:max-w-[210px]" />
        <button type="submit" className={cn("flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-7 font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,90,31,0.8)] transition hover:brightness-110", compact ? "h-[74px]" : "h-[74px]")}>
          <Search className="h-5 w-5" /> Modify
        </button>
      </div>
      <div className="flex flex-wrap gap-2 px-1">
        {QUOTAS.map((q) => (
          <button key={q.code} type="button" onClick={() => setQuota(q.code)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition", quota === q.code ? "border-brand bg-brand-soft text-brand" : "border-line bg-white text-ink/60 hover:border-ink/30")}>
            {q.label}
          </button>
        ))}
      </div>
    </form>
  );
}
