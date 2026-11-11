"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import type { TourPackage } from "@/lib/packages";
import { api, errMsg } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type ImportRow = { row: number; slug: string; title: string; action: "create" | "update" | "error"; error?: string };
type ImportResult = { rows: ImportRow[]; created: number; updated: number; errors: number; applied: boolean };

/** Export chosen packages to CSV / import a CSV (preview first, then apply) — for moving packages between servers. */
export function PackageTransfer({ packages, onImported }: { packages: TourPackage[]; onImported: () => void }) {
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);
  return (
    <>
      <button onClick={() => setDialog("export")} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-extrabold text-ink shadow-sm transition hover:border-ink/30">
        <Download className="h-4 w-4" /> Export CSV
      </button>
      <button onClick={() => setDialog("import")} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-extrabold text-ink shadow-sm transition hover:border-ink/30">
        <Upload className="h-4 w-4" /> Import CSV
      </button>
      {dialog === "export" && <ExportDialog packages={packages} onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} onDone={onImported} />}
    </>
  );
}

function Modal({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[26px] bg-white shadow-2xl sm:rounded-[26px]">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted">{sub}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full border border-line p-2"><X className="h-4 w-4" /></button>
        </header>
        {children}
      </motion.div>
    </div>,
    document.body,
  );
}

function ExportDialog({ packages, onClose }: { packages: TourPackage[]; onClose: () => void }) {
  const [sel, setSel] = useState<Set<number>>(() => new Set(packages.map((p) => p.id)));
  const all = sel.size === packages.length;
  const toggle = (id: number) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const download = () => {
    // a normal navigation download — the session cookie goes along, nothing is built in the browser
    const ids = all ? "" : `?ids=${[...sel].join(",")}`;
    const a = document.createElement("a");
    a.href = `/api/admin/packages/export${ids}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Exporting ${sel.size} package${sel.size === 1 ? "" : "s"}`);
    onClose();
  };
  return (
    <Modal title="Export packages" sub="Choose the packages to download as CSV — then use Import CSV on the other server." onClose={onClose}>
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5 text-xs font-bold">
        <span className="text-muted">{sel.size} of {packages.length} selected</span>
        <button onClick={() => setSel(all ? new Set() : new Set(packages.map((p) => p.id)))} className="text-[#0057ff] hover:underline">{all ? "Select none" : "Select all"}</button>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {packages.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-surface">
              <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[#ff5a1f]" />
              <span className="h-10 w-14 shrink-0 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url("${p.coverPhoto}")` }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{p.title}</span>
                <span className="block truncate text-[11px] text-muted">{p.slug} · {p.durationDays}D/{p.durationNights}N · {(p.departures || []).length} departures</span>
              </span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold capitalize", p.status === "published" ? "bg-emerald-50 text-emerald-700" : p.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{p.status}</span>
            </label>
          </li>
        ))}
      </ul>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted hover:text-ink">Cancel</button>
        <button onClick={download} disabled={!sel.size} className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-40">
          <Download className="h-4 w-4" /> Download CSV ({sel.size})
        </button>
      </footer>
    </Modal>
  );
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast.error("That file is too large (max 2 MB).");
    const text = await f.text();
    setCsv({ name: f.name, text });
    setBusy(true);
    try {
      setPreview(await api<ImportResult>("/api/admin/packages/import", { body: { csv: text, apply: false } }));
    } catch (e) {
      toast.error(errMsg(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!csv) return;
    setBusy(true);
    try {
      const r = await api<ImportResult>("/api/admin/packages/import", { body: { csv: csv.text, apply: true } });
      toast.success(`Imported: ${r.created} new, ${r.updated} updated${r.errors ? `, ${r.errors} skipped` : ""}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import packages" sub="Pick a CSV exported from SKYO. You'll see what changes before anything is saved." onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button
          onClick={() => file.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => (e.preventDefault(), pick(e.dataTransfer.files?.[0]))}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface/60 px-4 py-7 text-center transition hover:border-brand/40"
        >
          {busy && !preview ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <FileUp className="h-6 w-6 text-brand" />}
          <span className="text-sm font-extrabold">{csv ? csv.name : "Choose or drop a CSV file"}</span>
          <span className="text-[11px] text-muted">Packages are matched by URL slug — existing ones are updated, new ones are created.</span>
        </button>

        {preview && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["New", preview.created, "bg-emerald-50 text-emerald-700"],
                ["Updated", preview.updated, "bg-sky-50 text-sky-700"],
                ["Errors", preview.errors, preview.errors ? "bg-rose-50 text-rose-700" : "bg-surface text-muted"],
              ].map(([l, v, c]) => (
                <div key={l as string} className={cn("rounded-xl px-3 py-2.5", c as string)}>
                  <div className="text-xl font-black">{v as number}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">{l as string}</div>
                </div>
              ))}
            </div>
            <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
              {preview.rows.map((r) => (
                <li key={r.row} className="flex items-start gap-2.5 px-3 py-2.5 text-xs">
                  {r.action === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" /> : r.action === "create" ? <Plus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{r.title || r.slug || `Row ${r.row}`}</div>
                    <div className={cn("text-[11px]", r.action === "error" ? "text-rose-700" : "text-muted")}>
                      {r.action === "error" ? `Row ${r.row}: ${r.error}` : `${r.slug} · will be ${r.action === "create" ? "created" : "updated"}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {preview.errors > 0 && <p className="mt-2 text-[11px] text-muted">Rows with errors are skipped; the rest are imported.</p>}
          </div>
        )}
      </div>
      <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted hover:text-ink">Cancel</button>
        <button onClick={apply} disabled={busy || !preview || preview.created + preview.updated === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-xs font-extrabold text-white disabled:opacity-40">
          {busy && preview ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Import {preview ? preview.created + preview.updated : ""} package{preview && preview.created + preview.updated === 1 ? "" : "s"}
        </button>
      </footer>
    </Modal>
  );
}
