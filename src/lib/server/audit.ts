import "server-only";
import { exec } from "./db";
import { encOpt } from "./crypto";

/** Append-only audit trail. IP, user-agent and details are KMS-encrypted. */
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
      "INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, ip_enc, user_agent_enc, meta_enc) VALUES (?,?,?,?,?,?,?,?)",
      [
        entry.actorType,
        entry.actorId ?? null,
        entry.action.slice(0, 64),
        entry.targetType ?? null,
        entry.targetId !== undefined ? String(entry.targetId) : null,
        await encOpt(entry.ip),
        await encOpt(entry.userAgent?.slice(0, 400)),
        await encOpt(entry.meta ? JSON.stringify(entry.meta) : null),
      ],
    );
  } catch (e) {
    console.error("[audit] write failed", (e as Error).message);
  }
}
