"use client";
import { createContext, useContext } from "react";
import { can, type AdminIdentity, type Permission, ADMIN_ONLY } from "@/lib/permissions";

const Ctx = createContext<AdminIdentity | null>(null);
export const AdminProvider = Ctx.Provider;
export function useAdmin() {
  const a = useContext(Ctx)!;
  return { ...a, can: (p: Permission | (typeof ADMIN_ONLY)[number]) => can(a, p) };
}
