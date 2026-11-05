import { randomInt } from "node:crypto";

export const VERIFY_CODE_TTL_MS = 30 * 60 * 1000;
export const VERIFY_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const DASH_RE = /[‐\-‑‒–—―−﹘﹣－]/gu;

export function generateVerifyCode(rand: (max: number) => number = randomInt): string {
  let code = "MY-";
  const len = VERIFY_CODE_ALPHABET.length;
  for (let i = 0; i < 6; i++) {
    code += VERIFY_CODE_ALPHABET[rand(len)];
  }
  return code;
}

export function normalizeLeetCodeHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (s.startsWith("@")) {
    s = s.slice(1);
  }
  const lcIndex = s.toLowerCase().indexOf("leetcode.com/");
  if (lcIndex !== -1) {
    let path = s.slice(lcIndex + "leetcode.com/".length);
    const qIndex = path.search(/[?#]/);
    if (qIndex !== -1) {
      path = path.slice(0, qIndex);
    }
    const segments = path.split("/").filter(Boolean);
    if (segments.length > 0) {
      const first = segments[0].toLowerCase();
      if (first === "u" || first === "profile") {
        segments.shift();
      }
    }
    if (segments.length === 0) return null;
    s = segments[0];
  }
  if (!/^[A-Za-z0-9._-]{1,50}$/.test(s)) return null;
  return s.toLowerCase();
}

function normalizeCodeText(str: string): string {
  return str
    .normalize("NFKC")
    .replace(DASH_RE, "-")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function profileHasCode(
  fields: { aboutMe?: string | null; realName?: string | null },
  code: string
): boolean {
  if (!code || typeof code !== "string") return false;
  const normalizedCode = normalizeCodeText(code);
  if (!normalizedCode) return false;

  const checkField = (fieldVal?: string | null): boolean => {
    if (!fieldVal || typeof fieldVal !== "string") return false;
    const normalized = normalizeCodeText(fieldVal);
    return normalized.includes(normalizedCode);
  };

  return checkField(fields.aboutMe) || checkField(fields.realName);
}
