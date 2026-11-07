import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

/* =====================================================================
 * Private file storage on S3 — one folder per customer, keyed by SKYO ID:
 *
 *   <prefix><SKYO_ID>/profile_<4 digits>.<jpg|png|webp>
 *   <prefix><SKYO_ID>/train/<booking ref>_<journey YYYYMMDD>.pdf
 *
 * The bucket stays private: files are only served through SKYO APIs after an
 * ownership / admin check. Objects are encrypted at rest with SSE-KMS (AWS_KMS_KEY_ID),
 * falling back to SSE-S3 (AES-256) if the key can't be used by S3.
 * ===================================================================== */

const bucket = () => (process.env.AWS_BUCKET || "").trim();
/** e.g. "imoneytest/skyo/" — always ends with "/" (or is empty). */
export const storagePrefix = () => {
  const p = (process.env.SKYO_S3_PREFIX ?? `${(process.env.AWS_BUCKET_FOLDER || "").trim()}skyo/`).trim().replace(/^\/+/, "");
  return p && !p.endsWith("/") ? `${p}/` : p;
};
export const storageConfigured = () => !!(bucket() && env.aws.accessKeyId && env.aws.secretAccessKey);

let client: S3Client | null = null;
const s3 = () =>
  (client ??= new S3Client({
    region: env.aws.region,
    credentials: { accessKeyId: env.aws.accessKeyId, secretAccessKey: env.aws.secretAccessKey },
  }));

const UID_RE = /^SKYO\d{8}$/;
const safePart = (s: string) => s.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);

/** Builds a key inside the customer's folder. `parts` are path segments under it. */
export function userKey(uid: string, ...parts: string[]) {
  if (!UID_RE.test(uid)) throw new Error("invalid uid for storage key");
  return `${storagePrefix()}${uid}/${parts.map(safePart).join("/")}`;
}

/** Agent files: <prefix>admins/ADM<id>/... */
export function adminKey(adminId: number, ...parts: string[]) {
  if (!Number.isInteger(adminId) || adminId < 1) throw new Error("invalid admin id for storage key");
  return `${storagePrefix()}admins/ADM${adminId}/${parts.map(safePart).join("/")}`;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  if (!storageConfigured()) throw new Error("S3 storage is not configured (AWS_BUCKET / AWS keys)");
  const base = { Bucket: bucket(), Key: key, Body: body, ContentType: contentType, CacheControl: "private, max-age=0" };
  if (env.aws.kmsKeyId) {
    try {
      await s3().send(new PutObjectCommand({ ...base, ServerSideEncryption: "aws:kms", SSEKMSKeyId: env.aws.kmsKeyId }));
      return key;
    } catch (e) {
      const name = (e as { name?: string }).name || "";
      if (!/AccessDenied|KMS/i.test(name)) throw e;
      console.warn("[storage] SSE-KMS refused, using SSE-S3:", name);
    }
  }
  await s3().send(new PutObjectCommand({ ...base, ServerSideEncryption: "AES256" }));
  return key;
}

export async function getObject(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
  if (!storageConfigured()) return null;
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if (!r.Body) return null;
    return { body: await r.Body.transformToByteArray(), contentType: r.ContentType || "application/octet-stream" };
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null;
    throw e;
  }
}

export async function deleteObject(key: string) {
  if (!storageConfigured()) return;
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch((e) => console.warn("[storage] delete failed", (e as Error).name));
}

/** Detects jpg / png / webp from magic bytes (never trust the browser's MIME type). */
export function sniffImage(b: Uint8Array): { ext: "jpg" | "png" | "webp"; type: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: "png", type: "image/png" };
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}
