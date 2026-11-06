"use client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Globe, ShieldCheck } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, Table } from "./ui";
import { useAdmin } from "./admin-context";
import { api, errMsg } from "@/lib/client/api";
import { fmtDateTime, formatINR, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Detail = {
  user: Record<string, string | null>;
  sessions: { id: number; ip: string; location: string | null; device: string; client: string; login_method: string; created_at: string; last_seen_at: string; revoked_at: string | null; revoked_reason: string | null; active: number }[];
  bookings: { booking_ref: string; service: string; status: string; title: string; travel_date: string; amount_paise: number; created_at: string }[];
};

export function UserDetail({ id }: { id: number }) {
  const admin = useAdmin();
  const [reveal, setReveal] = useState(false);
  const { data, reload } = useFetch<Detail>(`/api/admin/users/${id}${reveal ? "?reveal=1" : ""}`);
  const u = data?.user;

  const setStatus = async (status: string) => {
    if (!confirm(`Set this user to ${status}?${status !== "active" ? " All their sessions will be logged out." : ""}`)) return;
    try {
      await api(`/api/admin/users/${id}`, { method: "PATCH", body: { status } });
      toast.success(`User marked ${status}`);
      void reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const revoke = async (sid: number) => {
    try {
      await api("/api/admin/sessions", { body: { kind: "user", id: sid } });
      toast.success("Session ended");
      void reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" /> All users</Link>
      {u && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-1">
            <div className="relative bg-ink p-6 text-white">
              <div className="bg-grid absolute inset-0 opacity-40" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-iris text-xl font-extrabold">{(u.name || "T")[0]}</div>
                <div>
                  <div className="text-lg font-extrabold">{u.name || "Unnamed traveller"}</div>
                  <div className="font-mono text-xs text-white/50">{u.uid}</div>
                </div>
              </div>
            </div>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Status", <Badge key="s">{u.status}</Badge>],
                ["Email", <span key="e">{u.email || "—"} {u.email_verified_at && <span className="text-mint">✓</span>}</span>],
                ["Mobile", <span key="p">{u.phone ? `+91 ${u.phone}` : "—"} {u.phone_verified_at && <span className="text-mint">✓</span>}</span>],
                ["Signed up via", u.signup_method === "register" ? "Full registration" : "OTP login"],
                ["Consent", u.consent_at ? `${fmtDateTime(u.consent_at)} (v${u.consent_version})` : "—"],
                ["Sign-up IP", <span key="ip" className="font-mono">{u.signup_ip || "—"}</span>],
                ["Last login", fmtDateTime(u.last_login_at)],
                ["Last location", u.last_location || "—"],
                ["Last device", u.last_device || "—"],
                ["Joined", fmtDateTime(u.created_at)],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 px-6 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-line p-4">
              {admin.can("users.contact") && (
                <Button variant="outline" size="sm" onClick={() => setReveal((r) => !r)}>
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {reveal ? "Mask" : "Reveal contact"}
                </Button>
              )}
              {admin.can("users.manage") && (
                <>
                  {u.status !== "active" && <Button size="sm" variant="dark" onClick={() => setStatus("active")}>Activate</Button>}
                  {u.status !== "inactive" && <Button size="sm" variant="outline" onClick={() => setStatus("inactive")}>Deactivate</Button>}
                  {u.status !== "blocked" && <Button size="sm" variant="danger" onClick={() => setStatus("blocked")}>Block</Button>}
                </>
              )}
            </div>
          </Card>

          <div className="space-y-6 xl:col-span-2">
            <Card>
              <div className="flex items-center gap-2 border-b border-line p-5 font-bold"><ShieldCheck className="h-5 w-5 text-mint" /> Session history</div>
              <Table head={["Device", "Location / IP", "Method", "Started", "Last active", "State", ""]} empty={!data.sessions.length}>
                {data.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3 text-xs font-medium">{s.device}<div className="text-muted">{s.client}</div></td>
                    <td className="px-5 py-3 text-xs"><div className="flex items-center gap-1"><Globe className="h-3 w-3 text-muted" />{s.location || "—"}</div><div className="font-mono text-muted">{s.ip}</div></td>
                    <td className="px-5 py-3 text-xs">{s.login_method}</td>
                    <td className="px-5 py-3 text-xs text-muted">{fmtDateTime(s.created_at)}</td>
                    <td className="px-5 py-3 text-xs text-muted">{timeAgo(s.last_seen_at)}</td>
                    <td className="px-5 py-3">{s.active ? <Badge>active</Badge> : <Badge tone="revoked">{s.revoked_reason || "expired"}</Badge>}</td>
                    <td className="px-5 py-3 text-right">{!!s.active && admin.can("sessions.revoke") && <button onClick={() => revoke(s.id)} className="text-xs font-bold text-red-600 hover:underline">Force logout</button>}</td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card>
              <div className="border-b border-line p-5 font-bold">Recent bookings</div>
              <Table head={["Ref", "Service", "Trip", "Travel date", "Amount", "Status"]} empty={!data.bookings.length}>
                {data.bookings.map((b) => (
                  <tr key={b.booking_ref}>
                    <td className="px-5 py-3 font-mono text-xs">{b.booking_ref}</td>
                    <td className="px-5 py-3 text-xs capitalize">{b.service}</td>
                    <td className="px-5 py-3 text-xs">{b.title}</td>
                    <td className="px-5 py-3 text-xs">{b.travel_date ? new Date(b.travel_date).toLocaleDateString("en-IN") : "—"}</td>
                    <td className="px-5 py-3 text-xs font-bold">{formatINR(b.amount_paise)}</td>
                    <td className="px-5 py-3"><Badge>{b.status}</Badge></td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
