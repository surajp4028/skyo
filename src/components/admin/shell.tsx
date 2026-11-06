"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, BusFront, Building2, ChevronsLeft, LayoutDashboard, LogOut, Menu, Palmtree, Plane, ScrollText, Settings, ShieldCheck, TrainFront, UserCog, Users, X,
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
    section: "Customers & security",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, perm: "users.view" },
      { href: "/admin/sessions", label: "Session logs", icon: Activity, perm: "sessions.view" },
      { href: "/admin/audit", label: "Audit trail", icon: ScrollText, perm: "audit.view" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/admin/staff", label: "Staff & access", icon: UserCog, perm: "staff.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, perm: "settings.manage" },
    ],
  },
];

export function AdminShell({ admin, children }: { admin: AdminIdentity; children: ReactNode }) {
  return (
    <AdminProvider value={admin}>
      <ShellInner>{children}</ShellInner>
    </AdminProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const admin = useAdmin();
  const site = useSite();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);

  const nav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || admin.can(i.perm)) })).filter((s) => s.items.length);

  const sidebar = (
    <motion.aside
      animate={{ width: collapsed ? 84 : 272 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="relative flex h-full flex-col overflow-hidden bg-ink text-white"
    >
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="absolute -left-20 top-0 h-60 w-60 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative flex h-20 items-center gap-3 px-5">
        <LogoMark className="h-10 w-10 shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="min-w-0">
              <div className="truncate text-lg font-extrabold">{site.site_name}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-2">Agent console</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <nav className="no-scrollbar relative flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {nav.map((s) => (
          <div key={s.section}>
            {!collapsed && <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">{s.section}</div>}
            <div className="space-y-1">
              {s.items.map((i) => {
                const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
                return (
                  <Link key={i.href} href={i.href} onClick={() => setMobile(false)} title={collapsed ? i.label : undefined} className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", active ? "text-white" : "text-white/55 hover:text-white")}>
                    {active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-brand/30 to-white/5" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />}
                    <i.icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-brand-2")} />
                    {!collapsed && <span className="relative truncate">{i.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="relative border-t border-white/10 p-3">
        <div className={cn("flex items-center gap-3 rounded-xl bg-white/5 p-2.5", collapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-iris text-sm font-bold">{admin.name[0]}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{admin.name}</div>
              <div className="flex items-center gap-1 text-[11px] text-white/50"><ShieldCheck className="h-3 w-3" /> {admin.role === "admin" ? "Administrator" : "Staff"}</div>
            </div>
          )}
          {!collapsed && (
            <button
              title="Log out"
              onClick={async () => {
                await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
                window.location.replace("/login?as=agent");
              }}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
        <button onClick={() => setCollapsed((c) => !c)} className="mt-2 hidden w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white/40 hover:text-white lg:flex">
          <ChevronsLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} /> {!collapsed && "Collapse"}
        </button>
      </div>
    </motion.aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <div className="hidden lg:block">{sidebar}</div>
      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-50 flex lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/50" onClick={() => setMobile(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="relative h-full">{sidebar}</motion.div>
            <button className="relative m-3 h-10 w-10 rounded-full bg-white" onClick={() => setMobile(false)}><X className="mx-auto h-5 w-5" /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white/70 px-5 backdrop-blur-xl lg:hidden">
          <button onClick={() => setMobile(true)} className="rounded-lg p-2 hover:bg-surface"><Menu className="h-5 w-5" /></button>
          <span className="font-extrabold">{site.site_name} console</span>
          <span className="w-9" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mx-auto max-w-[1400px] p-5 md:p-8">
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
