"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { KeyRound, Lock, Plus, ShieldCheck, UserCog, X } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Btn, Card, PageHeader, Table } from "./ui";
import { useAdmin } from "./admin-context";
import { api, errMsg } from "@/lib/client/api";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { timeAgo, cn } from "@/lib/utils";

type Agent = { id: number; name: string; email: string; role: "admin" | "staff"; permissions: string | string[] | null; status: string; last_login_at: string | null; last_login_ip: string | null; locked: number; active_sessions: number };
const perms = (p: Agent["permissions"]): string[] => (Array.isArray(p) ? p : p ? JSON.parse(p) : []);

const PRESETS: Record<string, Permission[]> = {
  "Support desk": ["dashboard.view", "users.view", "sessions.view", "bookings.train", "bookings.flight", "bookings.bus", "bookings.hotel", "bookings.package"],
  "Train ops": ["dashboard.view", "bookings.train", "users.view"],
  "Security analyst": ["dashboard.view", "users.view", "sessions.view", "sessions.revoke", "audit.view"],
};

export function StaffManager() {
  const me = useAdmin();
  const { data, reload, loading } = useFetch<{ staff: Agent[] }>("/api/admin/staff");
  const [editing, setEditing] = useState<Agent | "new" | null>(null);
  return (
    <>
      <PageHeader
        icon={<UserCog />}
        title="Staff & access"
        sub="Two roles: Admin (full access) and Staff (only the permissions you grant). Everyone signs in from Agent login."
        actions={<Btn variant="dark" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add agent</Btn>}
      />
      <Card>
        <Table head={["Agent", "Role", "Permissions", "Status", "Last login", "Sessions", ""]} loading={loading} empty={!data?.staff.length}>
          {data?.staff.map((a) => (
            <tr key={a.id} className="hover:bg-neutral-50/70">
              <td className="px-4 py-3">
                <div className="font-semibold">{a.name} {a.id === me.id && <span className="text-xs text-muted">(you)</span>}</div>
                <div className="text-xs text-muted">{a.email}</div>
              </td>
              <td className="px-4 py-3"><Badge>{a.role}</Badge></td>
              <td className="max-w-[320px] px-4 py-3 text-xs text-muted">{a.role === "admin" ? "Everything" : `${perms(a.permissions).length} permission${perms(a.permissions).length === 1 ? "" : "s"}`}</td>
              <td className="px-4 py-3">{a.locked ? <Badge tone="blocked"><Lock className="h-3 w-3" /> locked</Badge> : <Badge>{a.status}</Badge>}</td>
              <td className="px-4 py-3 text-xs text-muted">{timeAgo(a.last_login_at)}<div className="font-mono">{a.last_login_ip || ""}</div></td>
              <td className="px-4 py-3 text-center font-bold">{a.active_sessions}</td>
              <td className="px-4 py-3 text-right"><Btn className="h-7 px-2.5 text-xs" onClick={() => setEditing(a)}>Manage</Btn></td>
            </tr>
          ))}
        </Table>
      </Card>
      <AnimatePresence>{editing && <AgentDrawer agent={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), reload())} />}</AnimatePresence>
    </>
  );
}

function AgentDrawer({ agent, onClose, onSaved }: { agent: Agent | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(agent?.name || "");
  const [email, setEmail] = useState(agent?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">(agent?.role || "staff");
  const [status, setStatus] = useState(agent?.status || "active");
  const [sel, setSel] = useState<Set<string>>(new Set(agent ? perms(agent.permissions) : PRESETS["Support desk"]));
  const [busy, setBusy] = useState(false);
  const groups = Object.entries(PERMISSIONS).reduce<Record<string, [string, string][]>>((acc, [k, v]) => ((acc[v.group] ||= []).push([k, v.label]), acc), {});

  const save = async () => {
    setBusy(true);
    try {
      if (agent) {
        await api(`/api/admin/staff/${agent.id}`, { method: "PATCH", body: { name, role, status, permissions: [...sel], ...(password ? { password } : {}) } });
      } else {
        await api("/api/admin/staff", { body: { name, email, password, role, permissions: [...sel] } });
      }
      toast.success(agent ? "Agent updated" : "Agent created");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: "spring", stiffness: 300, damping: 34 }} className="relative flex h-full w-full max-w-[480px] flex-col bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-line p-6">
          <div>
            <h2 className="text-lg font-extrabold">{agent ? "Manage agent" : "Add agent"}</h2>
            <p className="text-xs text-muted">Changes to role, permissions or password sign the agent out everywhere.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-surface"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <Field label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Work email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!agent} />
          <Field label={agent ? "Reset password (optional)" : "Password"} name="password" type="password" autoComplete="new-password" icon={<KeyRound className="h-4 w-4" />} value={password} onChange={(e) => setPassword(e.target.value)} hint="10+ chars with upper, lower, number & symbol" />
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Role</div>
            <div className="grid grid-cols-2 gap-2">
              {(["staff", "admin"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)} className={cn("rounded-2xl border-2 p-4 text-left transition", role === r ? "border-brand bg-brand-soft" : "border-line hover:border-ink/20")}>
                  <div className="flex items-center gap-2 font-bold capitalize">{r === "admin" ? <ShieldCheck className="h-4 w-4" /> : <UserCog className="h-4 w-4" />} {r}</div>
                  <div className="mt-1 text-xs text-muted">{r === "admin" ? "Full access incl. staff & settings" : "Only selected permissions"}</div>
                </button>
              ))}
            </div>
          </div>
          {agent && (
            <div className="flex items-center justify-between rounded-2xl border border-line p-4">
              <div><div className="font-bold">Account active</div><div className="text-xs text-muted">Inactive agents can&apos;t sign in.</div></div>
              <button type="button" onClick={() => setStatus((s) => (s === "active" ? "inactive" : "active"))} className={cn("relative h-7 w-12 rounded-full transition", status === "active" ? "bg-mint" : "bg-line")}>
                <motion.span layout className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow", status === "active" ? "right-1" : "left-1")} />
              </button>
            </div>
          )}
          {role === "staff" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Permissions</span>
                <div className="flex gap-1">
                  {Object.keys(PRESETS).map((p) => (
                    <button key={p} type="button" onClick={() => setSel(new Set(PRESETS[p]))} className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold hover:bg-line">{p}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border border-line p-4">
                {Object.entries(groups).map(([g, items]) => (
                  <div key={g}>
                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/50">{g}</div>
                    {items.map(([k, l]) => (
                      <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface">
                        <input type="checkbox" checked={sel.has(k)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(k); else n.delete(k); setSel(n); }} className="h-4 w-4 accent-[#ff5a1f]" />
                        {l}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-line p-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" loading={busy} onClick={save} disabled={name.trim().length < 2 || (!agent && (!email || !password))}>{agent ? "Save changes" : "Create agent"}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
