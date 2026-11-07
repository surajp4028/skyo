/** Permission catalog — shared by server (enforcement) and client (UI hiding). */
export const PERMISSIONS = {
  "dashboard.view": { group: "General", label: "View dashboard overview" },
  "users.view": { group: "Customers", label: "View customers" },
  "users.contact": { group: "Customers", label: "See full email / phone (unmasked)" },
  "users.manage": { group: "Customers", label: "Activate / deactivate / block customers" },
  "sessions.view": { group: "Security", label: "View session logs" },
  "sessions.revoke": { group: "Security", label: "Force logout sessions" },
  "audit.view": { group: "Security", label: "View audit trail" },
  "payments.view": { group: "Bookings", label: "Payment & ticketing transactions (request / response logs)" },
  "payments.refund": { group: "Bookings", label: "Refund payments, retry ticketing, resend notifications" },
  "coupons.manage": { group: "Bookings", label: "Create / edit coupons (incl. personal codes)" },
  "bookings.train": { group: "Bookings", label: "Train bookings" },
  "bookings.flight": { group: "Bookings", label: "Flight bookings" },
  "bookings.bus": { group: "Bookings", label: "Bus bookings" },
  "bookings.hotel": { group: "Bookings", label: "Hotel bookings" },
  "bookings.package": { group: "Bookings", label: "Holiday package bookings" },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
export const isPermission = (p: string): p is Permission => Object.prototype.hasOwnProperty.call(PERMISSIONS, p);

/** Admin-only capabilities (never grantable to staff). */
export const ADMIN_ONLY = ["staff.manage", "settings.manage"] as const;

export type AdminRole = "admin" | "staff";
export type AdminIdentity = { id: number; name: string; email: string; role: AdminRole; permissions: Permission[]; avatar?: string | null };

export function can(admin: Pick<AdminIdentity, "role" | "permissions">, perm: Permission | (typeof ADMIN_ONLY)[number]) {
  if (admin.role === "admin") return true;
  return (admin.permissions as string[]).includes(perm);
}

export const SERVICES = [
  { key: "train", label: "Trains", perm: "bookings.train" },
  { key: "flight", label: "Flights", perm: "bookings.flight" },
  { key: "bus", label: "Buses", perm: "bookings.bus" },
  { key: "hotel", label: "Hotels", perm: "bookings.hotel" },
  { key: "package", label: "Packages", perm: "bookings.package" },
] as const;
export type ServiceKey = (typeof SERVICES)[number]["key"];
