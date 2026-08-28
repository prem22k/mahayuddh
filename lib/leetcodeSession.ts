import crypto from "node:crypto";

// AES-256-GCM encryption for the LeetCode session cookie at rest.
// Key is server-only (LEETCODE_SESSION_SECRET). Never import in client code.

function getKey(): Buffer {
  const secret = process.env.LEETCODE_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("LEETCODE_SESSION_SECRET is not configured");
  }
  // Derive a stable 32-byte key from the secret.
  return crypto.createHash("sha256").update(secret).digest();
}

function toBase64(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function encryptSession(cookie: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(cookie, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // payload = iv.tag.ciphertext
  return toBase64(Buffer.concat([iv, tag, enc]));
}

export function decryptSession(blob: string): string {
  const key = getKey();
  const raw = fromBase64(blob);
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
