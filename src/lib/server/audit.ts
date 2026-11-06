import "server-only";
import { exec } from "./db";

export async function audit(entry: {
  actorType: "user" | "admin" | "system";
  actorId?: number | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await exec(
      "INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, ip, user_agent, meta) VALUES (?,?,?,?,?,?,?,?)",
      [
        entry.actorType,
        entry.actorId ?? null,
        entry.action.slice(0, 64),
        entry.targetType ?? null,
        entry.targetId !== undefined ? String(entry.targetId) : null,
        entry.ip ?? null,
        entry.userAgent?.slice(0, 400) ?? null,
        entry.meta ? JSON.stringify(entry.meta) : null,
      ],
    );
  } catch (e) {
    // Audit must never break the request, but must be visible in logs.
    console.error("[audit] write failed", (e as Error).message);
  }
}
