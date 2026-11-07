"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { BadgePercent, Pause, Pencil, Play, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Btn, Card } from "./ui";
import { api, errMsg } from "@/lib/client/api";
import { couponLabel } from "@/lib/train/charges";
import { cn, fmtDate } from "@/lib/utils";

export type AdminCoupon = {
  id: number; code: string; title: string | null; type: "percent" | "fixed" | "zero_service"; value: number; applyOn: "base_fare" | "service_fee" | "total";
  maxDiscount: number | null; minOrder: number | null; service: string; perUserLimit: number | null; totalLimit: number | null; userUid: string | null;
  status: "active" | "paused"; startsAt: string | null; expiresAt: string | null; isDefault: boolean; used: number; reserved: number; remaining: number | null;
  discountGivenPaise: number; usedByThisUser?: number;
};

const inr = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
/** UTC ISO → "YYYY-MM-DDTHH:mm" in IST for <input type="datetime-local"> */
const toIstInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

/**
 * Coupon manager — used in Settings → Coupons (all coupons) and on a customer's page
 * (`userUid` set: shows coupons that customer can use, and "New coupon" pre-fills their SKYO ID).
 */
export function CouponsManager({ userUid, userId }: { userUid?: string; userId?: number }) {
  const url = userId ? `/api/admin/users/${userId}/coupons` : "/api/admin/coupons";
  const { data, loading, reload } = useFetch<{ coupons: AdminCoupon[]; max?: number }>(url);
  const [edit, setEdit] = useState<Partial<AdminCoupon> | null>(null);
  const [who, setWho] = useState<AdminCoupon | null>(null);
  const [now] = useState(() => Date.now());
  const list = data?.coupons || [];

  const toggle = async (c: AdminCoupon) => {
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "PUT", body: formBody({ ...c, status: c.status === "active" ? "paused" : "active" }) });
      toast.success(c.status === "active" ? `${c.code} paused` : `${c.code} is live`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const remove = async (c: AdminCoupon) => {
    if (!confirm(`Delete coupon ${c.code}? This can't be undone.`)) return;
    try {
      await api(`/api/admin/coupons/${c.id}`, { method: "DELETE" });
      toast.success(`${c.code} deleted`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold"><BadgePercent className="h-4 w-4 text-brand" /> {userUid ? "Coupons for this customer" : "Coupons"}</h3>
          <p className="text-xs text-muted">
            {userUid ? `General coupons plus personal codes made for ${userUid}.` : `${list.length} of ${data?.max ?? "…"} coupons · percent or fixed off fare, service fee or total.`}
          </p>
        </div>
        <Btn variant="dark" onClick={() => setEdit({ type: "percent", applyOn: "total", status: "active", service: "train", userUid: userUid ?? null })}>
          <Plus className="h-4 w-4" /> {userUid ? "Personal coupon" : "New coupon"}
        </Btn>
      </div>
      {loading && !data ? (
        <div className="p-8 text-center text-sm text-muted">Loading…</div>
      ) : list.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">No coupons yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Offer</th><th className="px-4 py-2.5">For</th>
                <th className="px-4 py-2.5 text-center">Used</th><th className="px-4 py-2.5 text-center">Left</th><th className="px-4 py-2.5 text-center">Per user</th>
                {userUid && <th className="px-4 py-2.5 text-center">This user</th>}
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => {
                const expired = c.expiresAt && new Date(c.expiresAt).getTime() < now;
                return (
                  <tr key={c.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-extrabold">{c.code}</div>
                      {c.isDefault && <span className="mt-0.5 inline-block rounded bg-sky-50 px-1.5 text-[10px] font-bold text-sky-700">DEFAULT</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold">{couponLabel(c)}</div>
                      <div className="text-[11px] text-muted">{c.title || "—"}{c.minOrder ? ` · min ₹${c.minOrder}` : ""}{c.expiresAt ? ` · till ${fmtDate(c.expiresAt)}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.userUid ? <span className="inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 font-mono font-bold text-violet-700"><UserRound className="h-3 w-3" />{c.userUid}</span> : <span className="text-muted">Everyone</span>}</td>
                    <td className="px-4 py-3 text-center text-xs"><b>{c.used}</b>{c.reserved ? <span className="text-muted"> +{c.reserved} pending</span> : null}{c.discountGivenPaise ? <div className="text-[10px] text-muted">{inr(c.discountGivenPaise)} off</div> : null}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold">{c.remaining ?? "∞"}{c.totalLimit ? <span className="font-normal text-muted"> / {c.totalLimit}</span> : null}</td>
                    <td className="px-4 py-3 text-center text-xs">{c.perUserLimit ?? "∞"}</td>
                    {userUid && <td className="px-4 py-3 text-center text-xs font-bold">{c.usedByThisUser ?? 0}{c.perUserLimit ? <span className="font-normal text-muted"> / {c.perUserLimit}</span> : null}</td>}
                    <td className="px-4 py-3">
                      <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", expired ? "border-neutral-200 bg-neutral-50 text-neutral-500" : c.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                        {expired ? "expired" : c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn title="Who used it" onClick={() => setWho(c)}><Users className="h-4 w-4" /></IconBtn>
                        <IconBtn title={c.status === "active" ? "Pause" : "Activate"} onClick={() => toggle(c)}>{c.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</IconBtn>
                        <IconBtn title="Edit" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></IconBtn>
                        {!c.isDefault && <IconBtn title="Delete" danger onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></IconBtn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <CouponForm initial={edit} lockUser={!!userUid} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), reload())} />}
      {who && <WhoUsed coupon={who} onClose={() => setWho(null)} />}
    </Card>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} aria-label={title} onClick={onClick} className={cn("rounded-lg p-1.5 text-muted transition hover:bg-neutral-100", danger ? "hover:text-red-600" : "hover:text-ink")}>{children}</button>
  );
}

const formBody = (f: Partial<AdminCoupon>) => ({
  code: (f.code || "").toUpperCase(), title: f.title || null, type: f.type || "percent", value: Number(f.value || 0), applyOn: f.applyOn || "total",
  maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null, minOrder: f.minOrder ? Number(f.minOrder) : null, service: f.service === "all" || f.service === "flight" ? f.service : "train",
  perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null, totalLimit: f.totalLimit ? Number(f.totalLimit) : null, userUid: f.userUid || null,
  status: f.status || "active", startsAt: f.startsAt ? toIstInput(f.startsAt) : null, expiresAt: f.expiresAt ? toIstInput(f.expiresAt) : null,
});

function CouponForm({ initial, lockUser, onClose, onSaved }: { initial: Partial<AdminCoupon>; lockUser: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>(() => {
    const b = formBody(initial);
    return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v == null ? "" : String(v)]));
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const isZero = f.type === "zero_service";

  const save = async () => {
    setBusy(true);
    setErr(null);
    const body = {
      ...f, code: f.code.toUpperCase(), value: Number(f.value || 0), title: f.title || null,
      maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null, minOrder: f.minOrder ? Number(f.minOrder) : null,
      perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null, totalLimit: f.totalLimit ? Number(f.totalLimit) : null,
      userUid: f.userUid ? f.userUid.toUpperCase() : null, startsAt: f.startsAt || null, expiresAt: f.expiresAt || null,
    };
    try {
      await api(initial.id ? `/api/admin/coupons/${initial.id}` : "/api/admin/coupons", { method: initial.id ? "PUT" : "POST", body });
      toast.success(initial.id ? "Coupon updated" : `Coupon ${body.code} created`);
      onSaved();
    } catch (e) {
      const info = (e as { info?: { field?: string } }).info;
      setErr({ field: info?.field, msg: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const preview = couponLabel({ type: f.type as AdminCoupon["type"], value: Number(f.value || 0), applyOn: f.applyOn as AdminCoupon["applyOn"], maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null });

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h3 className="font-bold">{initial.id ? `Edit ${initial.code}` : "New coupon"}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <In label="Coupon code" value={f.code} onChange={(e) => setF((p) => ({ ...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }))} placeholder="SKYOSURAJ10" mono disabled={!!initial.isDefault} error={err?.field === "code" ? err.msg : undefined} />
            <In label="Title (shown to customers)" value={f.title} onChange={set("title")} placeholder="10% off your train ticket" />
          </div>

          <Group label="Discount type">
            {([["percent", "Percent %"], ["fixed", "Fixed ₹"], ["zero_service", "Zero service fee"]] as const).map(([v, l]) => (
              <Chip key={v} on={f.type === v} onClick={() => setF((p) => ({ ...p, type: v }))}>{l}</Chip>
            ))}
          </Group>

          {!isZero && (
            <>
              <Group label="Discount applies on">
                {([["base_fare", "Base fare"], ["service_fee", "SKYO service charge"], ["total", "Total fare"]] as const).map(([v, l]) => (
                  <Chip key={v} on={f.applyOn === v} onClick={() => setF((p) => ({ ...p, applyOn: v }))}>{l}</Chip>
                ))}
              </Group>
              <div className="grid gap-4 sm:grid-cols-3">
                <In label={f.type === "percent" ? "Percent off" : "Amount off (₹)"} value={f.value} onChange={set("value")} inputMode="decimal" error={err?.field === "value" ? err.msg : undefined} />
                {f.type === "percent" && <In label="Max discount (₹)" value={f.maxDiscount} onChange={set("maxDiscount")} inputMode="decimal" hint="Blank = no cap" />}
                <In label="Min booking (₹)" value={f.minOrder} onChange={set("minOrder")} inputMode="decimal" hint="Blank = any amount" />
              </div>
            </>
          )}
          {isZero && <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">The SKYO service fee and its GST become ₹0. IRCTC fee, insurance and gateway charges still apply.</p>}

          <div className="grid gap-4 sm:grid-cols-3">
            <In label="Uses per customer" value={f.perUserLimit} onChange={set("perUserLimit")} inputMode="numeric" hint="e.g. 5 · blank = unlimited" />
            <In label="Total uses" value={f.totalLimit} onChange={set("totalLimit")} inputMode="numeric" hint="e.g. 50 · blank = unlimited" />
            <In label="Only for SKYO ID" value={f.userUid} onChange={(e) => setF((p) => ({ ...p, userUid: e.target.value.toUpperCase() }))} placeholder="Everyone" mono disabled={lockUser} hint="Personal coupon" error={err?.field === "userUid" ? err.msg : undefined} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <In label="Starts (IST)" type="datetime-local" value={f.startsAt} onChange={set("startsAt")} />
            <In label="Expires (IST)" type="datetime-local" value={f.expiresAt} onChange={set("expiresAt")} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Service</span>
              <select value={f.service} onChange={set("service")} className="h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand">
                <option value="train">Trains</option>
                <option value="flight">Flights</option>
                <option value="all">All services</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
            <span><span className="font-mono font-extrabold">{f.code || "CODE"}</span> · {preview}</span>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={f.status === "active"} onChange={(e) => setF((p) => ({ ...p, status: e.target.checked ? "active" : "paused" }))} className="accent-[#0057ff]" /> Active</label>
          </div>
          {err && !err.field && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err.msg}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="dark" disabled={busy || !f.code} onClick={save}>{initial.id ? "Save changes" : "Create coupon"}</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function WhoUsed({ coupon, onClose }: { coupon: AdminCoupon; onClose: () => void }) {
  const { data, loading } = useFetch<{ redemptions: { booking_ref: string; user_uid: string; discount_paise: number; status: string; created_at: string; used_at: string | null; user_id: number | null }[] }>(`/api/admin/coupons/${coupon.id}/redemptions`);
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div><h3 className="font-bold">Who used <span className="font-mono">{coupon.code}</span></h3><p className="text-xs text-muted">{coupon.used} used · {coupon.reserved} pending payment · {coupon.remaining ?? "∞"} left</p></div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto">
          {loading ? <p className="p-6 text-center text-sm text-muted">Loading…</p> : !data?.redemptions.length ? <p className="p-6 text-center text-sm text-muted">Nobody has used this coupon yet.</p> : (
            <ul className="divide-y divide-line">
              {data.redemptions.map((r) => (
                <li key={r.booking_ref} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div>
                    {r.user_id ? <Link href={`/admin/users/${r.user_id}`} className="font-mono text-xs font-bold text-brand hover:underline">{r.user_uid}</Link> : <span className="font-mono text-xs">{r.user_uid}</span>}
                    <div className="text-[11px] text-muted">Booking {r.booking_ref} · {new Date(r.used_at || r.created_at).toLocaleString("en-IN")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">− {inr(r.discount_paise)}</div>
                    <span className={cn("text-[10px] font-bold uppercase", r.status === "used" ? "text-emerald-600" : r.status === "reserved" ? "text-amber-600" : "text-muted")}>{r.status === "reserved" ? "awaiting payment" : r.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-xl border px-3 py-2 text-xs font-bold transition", on ? "border-ink bg-ink text-white" : "border-line text-ink/70 hover:bg-neutral-50")}>{children}</button>;
}
function In({ label, hint, error, mono, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <input {...props} className={cn("h-10 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none transition focus:border-brand disabled:bg-neutral-50 disabled:text-muted", mono && "font-mono uppercase", error ? "border-red-300" : "border-line")} />
      {error ? <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span> : hint ? <span className="mt-1 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}
