"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, BusFront, Building2, ChevronRight, ExternalLink, LayoutDashboard, LogOut, Menu, Palmtree, PanelLeftClose, PanelLeftOpen,
  Plane, ScrollText, Settings, ShieldCheck, TrainFront, UserCog, Users, X,
} from "lucide-react";
import { LogoMark } from "@/components/site/logo";
import { useSite } from "@/lib/client/providers";
import { api } from "@/lib/client/api";
import { AdminProvider, useAdmin } from "./admin-context";
import type { AdminIdentity, Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Users; perm?: Permission | "staff.manage" | "settings.manage" };
const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard.view" }] },
  {
    section: "Bookings",
    items: [
      { href: "/admin/bookings/train", label: "Trains", icon: TrainFront, perm: "bookings.train" },
      { href: "/admin/bookings/flight", label: "Flights", icon: Plane, perm: "bookings.flight" },
      { href: "/admin/bookings/bus", label: "Buses", icon: BusFront, perm: "bookings.bus" },
      { href: "/admin/bookings/hotel", label: "Hotels", icon: Building2, perm: "bookings.hotel" },
      { href: "/admin/bookings/package", label: "Packages", icon: Palmtree, perm: "bookings.package" },
    ],
  },
  {
    section: "Customers",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, perm: "users.view" },
      { href: "/admin/sessions", label: "Session logs", icon: Activity, perm: "sessions.view" },
      { href: "/admin/audit", label: "Audit trail", icon: ScrollText, perm: "audit.view" },
    ],
  },
  {
    section: "Workspace",
    items: [
      { href: "/admin/staff", label: "Staff & access", icon: UserCog, perm: "staff.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
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
    <div className="flex h-screen overflow-hidden bg-[#f4f4f5] text-neutral-900">
      <div className="hidden md:flex">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} path={path} admin={admin} />
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-50 flex md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-sm" onClick={() => setMobile(false)} />
            <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="relative h-full bg-[#f4f4f5] shadow-xl">
              <Sidebar collapsed={false} onToggle={() => setMobile(false)} path={path} admin={admin} onNavigate={() => setMobile(false)} mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col p-0 md:py-2 md:pr-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-neutral-200 bg-white md:rounded-2xl md:border md:shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-neutral-200/80 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button onClick={() => setMobile(true)} className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 md:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
              <nav className="flex min-w-0 items-center gap-1.5 text-sm">
                {crumbs.map((c, i) => (
                  <span key={c + i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />}
                    <span className={cn("truncate", i === crumbs.length - 1 ? "font-medium text-neutral-900" : "text-neutral-500")}>{c}</span>
                  </span>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:flex">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>
                Session secured
              </span>
              <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
                View site <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <motion.div key={path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mx-auto max-w-[1360px] px-4 py-6 md:px-8 md:py-8">
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  collapsed, onToggle, path, admin, onNavigate, mobile,
}: { collapsed: boolean; onToggle: () => void; path: string; admin: ReturnType<typeof useAdmin>; onNavigate?: () => void; mobile?: boolean }) {
  const site = useSite();
  const nav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || admin.can(i.perm)) })).filter((s) => s.items.length);
  return (
    <motion.aside animate={{ width: collapsed ? 68 : 252 }} transition={{ type: "spring", stiffness: 300, damping: 32 }} className="flex h-full flex-col overflow-hidden">
      {/* top: brand + collapse */}
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 px-3.5", collapsed && "justify-center px-0")}>
        <Link href="/admin" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <LogoMark className="h-8 w-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold tracking-tight">{site.site_name}</div>
              <div className="text-[11px] text-neutral-500">Agent console</div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button onClick={onToggle} className="ml-auto rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-700" aria-label={mobile ? "Close menu" : "Collapse sidebar"} title={mobile ? "Close" : "Collapse"}>
            {mobile ? <X className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={onToggle} className="mx-auto mb-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700" aria-label="Expand sidebar" title="Expand">
          <PanelLeftOpen className="h-[18px] w-[18px]" />
        </button>
      )}

      <nav className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-2.5 py-3">
        {nav.map((s) => (
          <div key={s.section}>
            {!collapsed ? (
              <div className="mb-1 px-2.5 text-[11px] font-medium text-neutral-400">{s.section}</div>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-neutral-200" />
            )}
            <div className="space-y-0.5">
              {s.items.map((i) => {
                const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
                return (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={onNavigate}
                    title={collapsed ? i.label : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors",
                      collapsed && "justify-center px-0",
                      active ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
                    )}
                  >
                    {active && (
                      <motion.span layoutId="admin-nav-pill" className="absolute inset-0 rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />
                    )}
                    <i.icon className={cn("relative h-4 w-4 shrink-0 transition", active ? "text-brand" : "group-hover:translate-x-0.5")} />
                    {!collapsed && <span className="relative truncate">{i.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 p-2.5">
        <div className={cn("flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white p-2", collapsed && "flex-col p-1.5")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-950 text-xs font-semibold text-white">
            {admin.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium">{admin.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-500"><ShieldCheck className="h-3 w-3" /> {admin.role === "admin" ? "Administrator" : "Staff"}</div>
            </div>
          )}
          <button
            title="Log out"
            onClick={async () => {
              await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
              window.location.replace("/login?as=agent");
            }}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
