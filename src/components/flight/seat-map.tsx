"use client";
import { motion } from "motion/react";
import type { CabinLayout } from "@/lib/flight/airlines";
import type { SeatInfo } from "@/lib/flight/model";
import { fmtMoney } from "@/lib/train/format";
import { cn } from "@/lib/utils";

export type SeatLeg = { key: string; flight: string; from: string; to: string; aircraft: { code: string; name: string }; layout: CabinLayout | null; seats: SeatInfo[] };

/**
 * Dark fuselage seat map: rounded nose with cockpit windows, cabin title, letter header,
 * row numbers in the aisle, fee hint on hover and a soft glow on chosen seats.
 */
export function SeatMap({ leg, selected, max, onToggle }: { leg: SeatLeg; selected: string[]; max: number; onToggle: (id: string) => void }) {
  if (!leg.layout) return <p className="p-6 text-center text-sm text-white/60">Seat map isn&apos;t available for this cabin.</p>;
  const layout = leg.layout;
  const byId = new Map(leg.seats.map((s) => [s.id, s]));
  const rows: number[] = [];
  for (let r = layout.fromRow; r <= layout.toRow; r++) if (!layout.skipRows?.includes(r)) rows.push(r);
  const groups = layout.groups;
  const seatW = layout.cabin === "business" ? 40 : groups.length > 2 ? 26 : 32;
  const business = layout.cabin === "business";
  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      {/* fuselage */}
      <div className="relative overflow-hidden rounded-t-[50%_120px] rounded-b-[44px] bg-gradient-to-b from-white/[0.07] to-white/[0.03] px-4 pb-6 pt-24 ring-1 ring-white/10">
        {/* cockpit windows */}
        <div className="absolute left-1/2 top-7 flex -translate-x-1/2 gap-1.5">
          {[-18, -6, 6, 18].map((r) => (
            <span key={r} className="h-5 w-7 rounded-md bg-gradient-to-b from-white/25 to-white/5" style={{ transform: `rotate(${r}deg)` }} />
          ))}
        </div>
        <div className="mb-3 text-center text-lg font-extrabold text-white">{business ? "Business" : "Economy"}</div>
        <div className="mb-2 flex items-center justify-center gap-3">
          {groups.map((g, gi) => (
            <div key={gi} className="flex items-center gap-3">
              {gi > 0 && <span className="w-6" />}
              <div className="flex gap-1.5">
                {g.map((l) => (
                  <span key={l} className="text-center text-xs font-bold text-white/60" style={{ width: seatW }}>{l}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map((r) => {
            const exit = layout.exitRows?.includes(r);
            return (
              <div key={r} className="relative">
                {exit && <div className="mb-1 flex justify-between px-1 text-[9px] font-bold uppercase tracking-widest text-amber-300/80"><span>◀ Exit</span><span>Exit ▶</span></div>}
                <div className="flex items-center justify-center gap-3">
                  {groups.map((g, gi) => (
                    <div key={gi} className="flex items-center gap-3">
                      {gi > 0 && <span className="w-6 text-center text-[10px] font-semibold tabular-nums text-white/35">{gi === 1 ? r : ""}</span>}
                      <div className="flex gap-1.5">
                        {g.map((l) => {
                          const id = `${r}${l}`;
                          const s = byId.get(id);
                          const on = selected.includes(id);
                          const disabled = !s || s.taken || (!on && selected.length >= max);
                          return (
                            <motion.button
                              key={id}
                              type="button"
                              whileTap={{ scale: 0.88 }}
                              disabled={!s || s.taken}
                              onClick={() => s && !s.taken && (on || selected.length < max) && onToggle(id)}
                              title={s ? `${id} · ${s.kind}${s.xl ? " · extra legroom" : ""}${s.taken ? " · taken" : s.feePaise ? ` · ${fmtMoney(s.feePaise / 100)}` : " · free"}` : id}
                              aria-label={`Seat ${id}${s?.taken ? " taken" : ""}`}
                              aria-pressed={on}
                              className={cn(
                                "relative rounded-t-[9px] rounded-b-md transition-all duration-150",
                                business ? "h-11" : "h-8",
                                s?.taken
                                  ? "cursor-not-allowed bg-gradient-to-b from-slate-600/70 to-slate-700/70 shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]"
                                  : on
                                    ? "bg-gradient-to-b from-[#a5c8ff] to-[#5b8dff] shadow-[0_0_18px_rgba(91,141,255,0.65),inset_0_-3px_0_rgba(0,0,0,0.18)]"
                                    : cn("bg-gradient-to-b from-slate-100 to-slate-300 shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] hover:-translate-y-0.5 hover:from-white", disabled && "opacity-60", s?.xl && "ring-2 ring-amber-300/70"),
                              )}
                              style={{ width: seatW }}
                            >
                              <span className={cn("absolute inset-x-1 top-1 h-1.5 rounded-full", s?.taken ? "bg-white/10" : "bg-white/60")} />
                              {on && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-[#0b1a3d]">{id}</span>}
                              {!on && s && !s.taken && s.feePaise > 0 && !business && <span className="absolute -bottom-0.5 right-0.5 text-[7px] font-black text-slate-500">₹</span>}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SeatLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-white/70">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200" /> Available</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-600" /> Taken</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#7aa8ff] shadow-[0_0_8px_rgba(91,141,255,0.8)]" /> Selected</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-200 ring-2 ring-amber-300" /> Extra legroom</span>
    </div>
  );
}
