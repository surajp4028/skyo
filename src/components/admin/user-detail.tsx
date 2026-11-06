"use client";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Ban, CheckCircle2, Copy, Globe, LogOut, PauseCircle, ShieldCheck } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Avatar, Badge, Btn, Card, Table, Td } from "./ui";
import { useAdmin } from "./admin-context";
import { forceLogoutUser } from "./users";
import { api, errMsg } from "@/lib/client/api";
import { fmtDateTime, formatINR, timeAgo } from "@/lib/utils";

type Detail = {
  user: {
    id: number; uid: string; name: string | null; email: string | null; phone: string | null; email_verified_at: string | null; phone_verified_at: string | null; status: string;
    signup_method: string; consent_at: string | null; consent_version: string | null; signup_ip: string | null; last_login_at: string | null; last_login_ip: string | null;
    last_location: string | null; last_device: string | null; created_at: string;
  };
  sessions: { id: number; ip: string; location: string | null; device: string; client: string; login_method: string; created_at: string; last_seen_at: string; revoked_reason: string | null; active: number }[];
  bookings: { booking_ref: string; service: string; status: string; title: string; travel_date: string; amount_paise: number; created_at: string }[];
};

export function UserDetail({ id }: { id: number }) {
  const admin = useAdmin();
  const { data, reload } = useFetch<Detail>(`/api/admin/users/${id}`);
  const u = data?.user;
  const activeCount = data?.sessions.filter((s) => s.active).length ?? 0;

  const setStatus = async (status: string) => {
    if (!confirm(`Set this user to ${status}?${status !== "active" ? " All their sessions will be logged out." : ""}`)) return;
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: { status } });
      toast.success(`User marked ${status}`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const revoke = async (sid: number) => {
    try {
      await api("/api/admin/sessions", { body: { kind: "user", id: sid } });
      toast.success("Session ended");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-neutral-900"><ArrowLeft className="h-4 w-4" /> All users</Link>
      {u && (
        <>
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <Avatar name={u.name} className="h-14 w-14 text-base" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] font-semibold tracking-tight">{u.name || "Unnamed traveller"}</h1>
                  <Badge>{u.status}</Badge>
                </div>
                <button onClick={() => navigator.clipboard?.writeText(u.uid).then(() => toast.success("SKYO ID copied"))} className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-xs text-neutral-500 hover:text-neutral-900">
                  {u.uid} <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {admin.can("sessions.revoke") && (
                <Btn variant="danger" disabled={!activeCount} onClick={async () => { await forceLogoutUser(u.id); reload(); }}>
                  <LogOut className="h-4 w-4" /> Force logout all ({activeCount})
                </Btn>
              )}
              {admin.can("users.manage") && (
                <>
                  {u.status !== "active" && <Btn variant="dark" onClick={() => setStatus("active")}><CheckCircle2 className="h-4 w-4" /> Activate</Btn>}
                  {u.status !== "inactive" && <Btn onClick={() => setStatus("inactive")}><PauseCircle className="h-4 w-4" /> Deactivate</Btn>}
                  {u.status !== "blocked" && <Btn onClick={() => setStatus("blocked")}><Ban className="h-4 w-4" /> Block</Btn>}
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="h-fit xl:col-span-1">
              <div className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold">Profile</div>
              <dl className="divide-y divide-neutral-100 text-[13px]">
                {[
                  ["Full name", u.name || "—"],
                  ["Email", u.email ? `${u.email}${u.email_verified_at ? "  ✓" : ""}` : "—"],
                  ["Mobile", u.phone ? `+91 ${u.phone}${u.phone_verified_at ? "  ✓" : ""}` : "—"],
                  ["Signed up via", u.signup_method === "register" ? "Full registration" : "OTP login"],
                  ["Consent", u.consent_at ? `${fmtDateTime(u.consent_at)} · v${u.consent_version}` : "—"],
                  ["Sign-up IP", u.signup_ip || "—"],
                  ["Last login", fmtDateTime(u.last_login_at)],
                  ["Last IP", u.last_login_ip || "—"],
                  ["Last location", u.last_location || "—"],
                  ["Last device", u.last_device || "—"],
                  ["Joined", fmtDateTime(u.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-2.5">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="break-words font-medium text-neutral-900">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2 border-t border-neutral-200 px-5 py-3 text-[11px] text-neutral-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Stored encrypted (AWS KMS) · this view is audit-logged</div>
            </Card>

            <div className="space-y-3 xl:col-span-2">
              <Card>
                <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
                  <span className="text-sm font-semibold">Session history</span>
                  <span className="text-xs text-neutral-500">{activeCount} active</span>
                </div>
                <Table head={["Device", "Location / IP", "Method", "Started", "Last active", "State", ""]} empty={!data.sessions.length}>
                  {data.sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50/70">
                      <Td className="max-w-[220px]"><div className="truncate">{s.device}</div><div className="text-[11px] text-neutral-400">{s.client}</div></Td>
                      <Td><div className="flex items-center gap-1"><Globe className="h-3 w-3 text-neutral-400" />{s.location || "—"}</div><div className="font-mono text-[11px] text-neutral-400">{s.ip}</div></Td>
                      <Td className="text-neutral-600">{s.login_method}</Td>
                      <Td className="whitespace-nowrap text-neutral-500">{fmtDateTime(s.created_at)}</Td>
                      <Td className="whitespace-nowrap text-neutral-500">{timeAgo(s.last_seen_at)}</Td>
                      <Td>{s.active ? <Badge>active</Badge> : <Badge tone="ended">{s.revoked_reason || "expired"}</Badge>}</Td>
                      <Td className="text-right">{!!s.active && admin.can("sessions.revoke") && <button onClick={() => revoke(s.id)} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">End</button>}</Td>
                    </tr>
                  ))}
                </Table>
              </Card>
              <Card>
                <div className="border-b border-neutral-200 px-5 py-3 text-sm font-semibold">Bookings <span className="font-normal text-neutral-400">· linked to {u.uid}</span></div>
                <Table head={["Ref", "Service", "Trip", "Travel date", "Amount", "Status"]} empty={!data.bookings.length}>
                  {data.bookings.map((b) => (
                    <tr key={b.booking_ref}>
                      <Td className="font-mono text-xs">{b.booking_ref}</Td>
                      <Td className="capitalize">{b.service}</Td>
                      <Td>{b.title}</Td>
                      <Td>{b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-IN") : "—"}</Td>
                      <Td className="font-medium tabular-nums">{formatINR(b.amount_paise)}</Td>
                      <Td><Badge>{b.status}</Badge></Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
