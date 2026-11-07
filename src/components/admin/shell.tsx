"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, Bell, CreditCard, Inbox, BusFront, Building2, ChevronRight, ExternalLink, LayoutDashboard, LogOut, Menu, Palmtree, PanelLeftClose, PanelLeftOpen,
  Plane, ScrollText, Settings, ShieldCheck, TrainFront, UserCog, UserRound, Users, X,
} from "lucide-react";
import { LogoMark } from "@/components/site/logo";
import { useSite } from "@/lib/client/providers";
import { api } from "@/lib/client/api";
import { AdminProvider, useAdmin } from "./admin-context";
import type { AdminIdentity, Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Users; perm?: Permission | "staff.manage" | "settings.manage"; badge?: string };
const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" }] },
  {
    section: "Bookings",
    items: [
      { href: "/admin/bookings/train", label: "Trains", icon: TrainFront, perm: "bookings.train", badge: "LIVE" },
      { href: "/admin/bookings/flight", label: "Flights", icon: Plane, perm: "bookings.flight" },
      { href: "/admin/bookings/bus", label: "Buses", icon: BusFront, perm: "bookings.bus" },
      { href: "/admin/bookings/hotel", label: "Hotels", icon: Building2, perm: "bookings.hotel" },
      { href: "/admin/bookings/package", label: "Packages", icon: Palmtree, perm: "bookings.package" },
      { href: "/admin/transactions", label: "Transactions", icon: CreditCard, perm: "payments.view" },
    ],
  },
  {
    section: "Customers",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, perm: "users.view" },
      { href: "/admin/messages", label: "Messages", icon: Inbox, perm: "users.view" },
      { href: "/admin/sessions", label: "Session logs", icon: Activity, perm: "sessions.view" },
      { href: "/admin/audit", label: "Audit trail", icon: ScrollText, perm: "audit.view" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/admin/staff", label: "Staff & access", icon: UserCog, perm: "staff.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
      { href: "/admin/profile", label: "My profile", icon: UserRound },
    ],
  },
];
const ALL = NAV.flatMap((s) => s.items.map((i) => ({ ...i, section: s.section })));

export function AdminShell({ admin, children }: { admin: AdminIdentity; children: ReactNode }) {
  return (
    <AdminProvider value={admin}>
      <ShellInner>{children}</ShellInner>
    </AdminProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const admin = useAdmin();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const current = [...ALL].sort((a, b) => b.href.length - a.href.length).find((i) => (i.href === "/admin" ? path === "/admin" : path.startsWith(i.href)));
  const crumbs = path.startsWith("/admin/users/") ? ["Customers", "Users", "Profile"] : current ? [current.section, current.label] : ["Console"];

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f4f9]">
      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} path={path} admin={admin} />
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-50 flex md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setMobile(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="relative h-full">
              <Sidebar collapsed={false} onToggle={() => setMobile(false)} path={path} admin={admin} onNavigate={() => setMobile(false)} mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line/70 bg-white/80 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setMobile(true)} className="rounded-lg p-2 text-ink/60 hover:bg-surface md:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <nav className="flex min-w-0 items-center gap-1.5 text-sm">
              {crumbs.map((c, i) => (
                <span key={c + i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink/25" />}
                  <span className={cn("truncate", i === crumbs.length - 1 ? "font-bold text-ink" : "font-medium text-muted")}>{c}</span>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:flex">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
              Secure session
            </span>
            <button className="relative rounded-xl p-2 text-ink/60 hover:bg-surface" aria-label="Notifications"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand" /></button>
            <a href="/" target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-ink/70 hover:border-ink/30 sm:flex">
              View site <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link href="/admin/profile" title="My profile" className="rounded-xl ring-brand/40 transition hover:ring-2">
              <AgentAvatar name={admin.name} src={admin.avatar} className="text-white" />
            </Link>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function AgentAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />;
  return <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-iris text-xs font-extrabold", className)}>{initials(name)}</div>;
}

const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

function Sidebar({
  collapsed, onToggle, path, admin, onNavigate, mobile,
}: { collapsed: boolean; onToggle: () => void; path: string; admin: ReturnType<typeof useAdmin>; onNavigate?: () => void; mobile?: boolean }) {
  const site = useSite();
  const nav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || admin.can(i.perm)) })).filter((s) => s.items.length);
  return (
    <motion.aside animate={{ width: collapsed ? 84 : 268 }} transition={{ type: "spring", stiffness: 280, damping: 30 }} className="relative flex h-full flex-col overflow-clip bg-ink text-white">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-iris/25 blur-3xl" />

      {/* brand + collapse (top) */}
      <div className={cn("relative flex h-20 shrink-0 items-center gap-3 px-5", collapsed && "flex-col justify-center gap-1.5 px-0 pt-3")}>
        <Link href="/admin" onClick={onNavigate} className="flex min-w-0 items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0 ring-1 ring-white/10" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-lg font-extrabold">{site.site_name}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-2">Agent console</div>
            </div>
          )}
        </Link>
        <button
          onClick={onToggle}
          className={cn("rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white", !collapsed && "ml-auto")}
          aria-label={mobile ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {mobile ? <X className="h-5 w-5" /> : collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
        </button>
      </div>

      <nav className="no-scrollbar relative flex-1 space-y-6 overflow-y-auto overflow-x-clip px-3 py-4">
        {nav.map((s) => (
          <div key={s.section}>
            {!collapsed ? <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{s.section}</div> : <div className="mx-auto mb-2 h-px w-8 bg-white/10" />}
            <div className="space-y-1">
              {s.items.map((i) => {
                const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={onNavigate}
                    title={collapsed ? i.label : undefined}
                    className={cn("group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", collapsed && "justify-center px-0", active ? "text-white" : "text-white/55 hover:text-white")}
                  >
                    {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-brand/35 via-brand/15 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                    {active && <motion.span layoutId="admin-nav-bar" className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-brand" />}
                    <i.icon className={cn("relative h-[18px] w-[18px] shrink-0 transition group-hover:scale-110", active && "text-brand-2")} />
                    {!collapsed && <span className="relative truncate">{i.label}</span>}
                    {!collapsed && i.badge && <span className="relative ml-auto rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300">{i.badge}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative shrink-0 border-t border-white/10 p-3">
        <div className={cn("flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10", collapsed && "flex-col gap-2 p-2")}>
          <Link href="/admin/profile" onClick={onNavigate} title="My profile" className={cn("flex min-w-0 items-center gap-3", collapsed ? "flex-col" : "flex-1")}>
            <AgentAvatar name={admin.name} src={admin.avatar} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{admin.name}</div>
                <div className="flex items-center gap-1 text-[11px] text-white/50"><ShieldCheck className="h-3 w-3" /> {admin.role === "admin" ? "Administrator" : "Staff"}</div>
              </div>
            )}
          </Link>
          <button
            title="Log out"
            onClick={async () => {
              await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
              window.location.replace("/login?as=agent");
            }}
            className="rounded-lg p-2 text-white/50 hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
