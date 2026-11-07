"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, KeyRound, Loader2, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Btn, Card, PageHeader } from "./ui";
import { api, errMsg } from "@/lib/client/api";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { cn, fmtDateTime } from "@/lib/utils";

type Profile = { id: number; name: string; email: string; role: "admin" | "staff"; permissions: Permission[]; avatar: string | null; lastLoginAt: string | null; lastLoginIp: string | null; passwordChangedAt: string | null; createdAt: string | null };

export function ProfileView() {
  const router = useRouter();
  const { data, reload } = useFetch<{ profile: Profile }>("/api/admin/profile");
  const p = data?.profile;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<{ field?: string; msg: string } | null>(null);
  const refresh = () => (reload(), router.refresh()); // router.refresh re-renders the header & sidebar with the new photo/name

  const upload = async (f: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast.error("Use a JPG, PNG or WebP image.");
    if (f.size > 2 * 1024 * 1024) return toast.error("Photo must be 2 MB or smaller.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/profile/avatar", { method: "POST", body: fd, headers: { "X-Requested-With": "skyo" }, credentials: "same-origin" });
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!res.ok) throw new Error(j.error?.message || "Upload failed");
      toast.success("Profile photo updated");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const removePhoto = async () => {
    setBusy(true);
    try {
      await api("/api/admin/profile/avatar", { method: "DELETE" });
      toast.success("Profile photo removed");
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const saveName = async () => {
    try {
      await api("/api/admin/profile", { method: "PATCH", body: { name } });
      toast.success("Name updated");
      setName(null);
      refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const changePw = async () => {
    setPwErr(null);
    if (pw.next !== pw.confirm) return setPwErr({ field: "confirm", msg: "Passwords don't match." });
    setPwBusy(true);
    try {
      await api("/api/admin/profile/password", { body: { current: pw.current, next: pw.next } });
      toast.success("Password changed — other devices were signed out");
      setPw({ current: "", next: "", confirm: "" });
      reload();
    } catch (e) {
      setPwErr({ field: (e as { info?: { field?: string } }).info?.field, msg: errMsg(e) });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <>
      <PageHeader icon={<UserRound />} title="My profile" sub="Your photo and name appear in the console header and sidebar." />
      {!p ? (
        <div className="flex h-40 items-center justify-center text-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <Card className="overflow-hidden">
            <div className="relative h-24 bg-[linear-gradient(120deg,#0a0f1f,#1e2a5a_60%,#ff5a1f)]" />
            <div className="-mt-12 px-6 pb-6">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
              <button onClick={() => input.current?.click()} className="group relative h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-lg" title="Change photo">
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand to-iris text-2xl font-extrabold text-white">{p.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                )}
                <span className={cn("absolute inset-0 flex items-center justify-center bg-black/45 text-white transition", busy ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}</span>
              </button>
              <h2 className="mt-3 text-lg font-extrabold">{p.name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5 text-mint" /> {p.role === "admin" ? "Administrator · full access" : "Staff"}</div>
              <div className="mt-4 flex gap-2">
                <Btn onClick={() => input.current?.click()} disabled={busy}><Camera className="h-4 w-4" /> {p.avatar ? "Change photo" : "Upload photo"}</Btn>
                {p.avatar && <Btn variant="danger" onClick={removePhoto} disabled={busy}><Trash2 className="h-4 w-4" /></Btn>}
              </div>
              <p className="mt-2 text-[11px] text-muted">JPG, PNG or WebP · up to 2 MB · stored privately in S3</p>
              <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                <Row k="Email" v={<span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted" />{p.email}</span>} />
                <Row k="Last login" v={p.lastLoginAt ? `${fmtDateTime(p.lastLoginAt)}${p.lastLoginIp ? ` · ${p.lastLoginIp}` : ""}` : "—"} />
                <Row k="Password changed" v={p.passwordChangedAt ? fmtDateTime(p.passwordChangedAt) : "—"} />
                <Row k="Member since" v={p.createdAt ? fmtDateTime(p.createdAt) : "—"} />
              </dl>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-bold">Display name</h3>
              <p className="mt-1 text-xs text-muted">Shown in the console and in audit logs. Your login email is managed under Staff & access.</p>
              <div className="mt-4 flex max-w-lg gap-2">
                <input value={name ?? p.name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-10 flex-1 rounded-xl border border-line px-3 text-sm font-semibold outline-none focus:border-brand" />
                <Btn variant="dark" disabled={!name || name.trim() === p.name || name.trim().length < 2} onClick={saveName}>Save</Btn>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="flex items-center gap-2 font-bold"><KeyRound className="h-4 w-4" /> Change password</h3>
              <p className="mt-1 text-xs text-muted">At least 10 characters with upper, lower case, a number and a symbol. Other devices are signed out.</p>
              <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
                {([["current", "Current password"], ["next", "New password"], ["confirm", "Confirm new"]] as const).map(([k, l]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">{l}</span>
                    <input type="password" autoComplete={k === "current" ? "current-password" : "new-password"} value={pw[k]} onChange={(e) => setPw((x) => ({ ...x, [k]: e.target.value }))} className={cn("h-10 w-full rounded-xl border px-3 text-sm outline-none focus:border-brand", pwErr?.field === k ? "border-red-300" : "border-line")} />
                  </label>
                ))}
              </div>
              {pwErr && <p className="mt-2 text-xs font-semibold text-red-600">{pwErr.msg}</p>}
              <div className="mt-4"><Btn variant="dark" disabled={pwBusy || !pw.current || !pw.next} onClick={changePw}>Update password</Btn></div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold">Your access</h3>
              {p.role === "admin" ? (
                <p className="mt-1 text-sm text-muted">Administrators can use every part of the console.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.permissions.map((k) => <span key={k} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold">{PERMISSIONS[k]?.label ?? k}</span>)}
                  {p.permissions.length === 0 && <span className="text-sm text-muted">No permissions yet.</span>}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="min-w-0 text-right font-medium">{v}</dd></div>
  );
}
