"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronDown, Inbox, Mail, Phone } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Badge, Card, PageHeader, Pager, Select, Toolbar, usePage } from "./ui";
import { api, errMsg } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type M = { id: number; ref: string; topic: string; status: string; created_at: string; user_id: number | null; name: string; email: string; phone: string | null; message: string };
const TOPIC: Record<string, string> = { booking: "Booking help", refund: "Refund", account: "Account", partnership: "Partnership", grievance: "Grievance", other: "Other" };
const STATUS_TONE: Record<string, string> = { new: "pending", in_progress: "staff", closed: "active" };

export function MessagesInbox() {
  const [status, setStatus] = useState("");
  const [page, setPage] = usePage(status);
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading, reload } = useFetch<{ messages: M[]; total: number; page: number; size: number; counts: Record<string, number> }>(`/api/admin/messages?${new URLSearchParams({ status, page: String(page) })}`);
  const setMsgStatus = async (id: number, s: string) => {
    try {
      await api(`/api/admin/messages/${id}`, { method: "PATCH", body: { status: s } });
      toast.success("Updated");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <>
      <PageHeader icon={<Inbox />} title="Messages" sub="Contact-form messages from the website. Stored encrypted; replies go out from your support email." />
      <Card>
        <Toolbar>
          <Select value={status} onChange={setStatus} options={[["", "All"], ["new", `New (${data?.counts.new ?? 0})`], ["in_progress", `In progress (${data?.counts.in_progress ?? 0})`], ["closed", `Closed (${data?.counts.closed ?? 0})`]]} />
          <span className="ml-auto text-xs text-muted">{data ? `${data.total} messages` : ""}</span>
        </Toolbar>
        <div className="divide-y divide-line">
          {loading && !data && <div className="p-10 text-center text-sm text-muted">Loading…</div>}
          {data?.messages.length === 0 && <div className="p-12 text-center text-sm text-muted">No messages yet.</div>}
          {data?.messages.map((m) => (
            <div key={m.id}>
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-surface/60">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", m.status === "new" ? "bg-brand" : "bg-transparent")} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold">{m.name} <span className="font-mono text-[11px] font-semibold text-muted">{m.ref}</span></div>
                  <div className="truncate text-xs text-muted">{m.message}</div>
                </div>
                <span className="hidden rounded-lg bg-surface px-2 py-1 text-[11px] font-bold sm:inline">{TOPIC[m.topic]}</span>
                <Badge tone={STATUS_TONE[m.status]}>{m.status.replace("_", " ")}</Badge>
                <span className="hidden w-36 text-right text-xs text-muted md:inline">{fmtDateTime(m.created_at)}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted transition", open === m.id && "rotate-180")} />
              </button>
              <AnimatePresence>
                {open === m.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-surface/50">
                    <div className="space-y-4 px-5 py-4 pl-11">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{m.message}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: your message ${m.ref}`)}`} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 ring-1 ring-line hover:ring-brand"><Mail className="h-3.5 w-3.5" /> {m.email}</a>
                        {m.phone && <a href={`tel:+91${m.phone}`} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 ring-1 ring-line hover:ring-brand"><Phone className="h-3.5 w-3.5" /> +91 {m.phone}</a>}
                        <span className="ml-auto flex gap-1.5">
                          {(["new", "in_progress", "closed"] as const).filter((s) => s !== m.status).map((s) => (
                            <button key={s} onClick={() => setMsgStatus(m.id, s)} className="rounded-lg bg-ink px-3 py-1.5 text-white hover:bg-ink-2">Mark {s.replace("_", " ")}</button>
                          ))}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}
