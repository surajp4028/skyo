"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { PassengerForm, berthLabel, genderLabel, type SavedPassenger } from "./passenger-form";
import { cn } from "@/lib/utils";

/** Saved travellers (account page). Limit comes from Admin → Settings. */
export function PassengersManager() {
  const [list, setList] = useState<SavedPassenger[] | null>(null);
  const [max, setMax] = useState(20);
  const [editing, setEditing] = useState<SavedPassenger | "new" | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ passengers: SavedPassenger[]; max: number }>("/api/account/passengers")
      .then((r) => {
        if (!alive) return;
        setList(r.passengers);
        setMax(r.max);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = () => setTick((t) => t + 1);

  return (
    <section className="rounded-3xl border border-line bg-white p-6 shadow-soft">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="h-5 w-5 text-brand" /> Saved travellers</h2>
          <p className="mt-0.5 text-sm text-muted">Add once, book in one tap. {list ? `${list.length} of ${max} used.` : ""}</p>
        </div>
        <button disabled={!!list && list.length >= max} onClick={() => setEditing("new")} className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ink-2 disabled:opacity-40">
          <Plus className="h-4 w-4" /> Add traveller
        </button>
      </div>
      {list && list.length > 0 && <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface"><motion.div initial={{ width: 0 }} animate={{ width: `${(list.length / max) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" /></div>}
      <div className="grid gap-3 md:grid-cols-2">
        {(list || []).map((p, i) => (
          <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="group flex items-center gap-3 rounded-2xl border border-line p-4 transition hover:border-brand/40">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white", p.gender === "F" ? "bg-gradient-to-br from-pink-500 to-rose-400" : p.gender === "T" ? "bg-gradient-to-br from-violet-500 to-fuchsia-400" : "bg-gradient-to-br from-sky-500 to-indigo-500")}>{p.name[0]}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{p.name}</div>
              <div className="text-xs text-muted">{p.age} yrs · {genderLabel(p.gender)} · {berthLabel(p.berth)} · {p.nationality}</div>
            </div>
            <button onClick={() => setEditing(p)} aria-label="Edit" className="rounded-lg p-2 text-muted opacity-60 hover:bg-surface hover:text-ink group-hover:opacity-100"><Pencil className="h-4 w-4" /></button>
            <button
              aria-label="Delete"
              onClick={async () => {
                if (!confirm(`Remove ${p.name}?`)) return;
                try {
                  await api(`/api/account/passengers/${p.id}`, { method: "DELETE" });
                  reload();
                } catch (e) {
                  toast.error(errMsg(e));
                }
              }}
              className="rounded-lg p-2 text-muted opacity-60 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </div>
      {list && list.length === 0 && (
        <div className="rounded-2xl bg-surface p-8 text-center">
          <UserRound className="mx-auto h-8 w-8 text-ink/25" />
          <p className="mt-2 font-bold">No saved travellers yet</p>
          <p className="text-sm text-muted">Save yourself and family members to book faster.</p>
        </div>
      )}
      <AnimatePresence>
        {editing && (
          <motion.div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setEditing(null)} />
            <motion.div initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }} className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl">
              <button onClick={() => setEditing(null)} className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-surface" aria-label="Close"><X className="h-5 w-5" /></button>
              <h3 className="mb-4 text-xl font-extrabold">{editing === "new" ? "Add traveller" : "Edit traveller"}</h3>
              <PassengerForm
                initial={editing === "new" ? undefined : editing}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  toast.success("Traveller saved");
                  setEditing(null);
                  reload();
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
