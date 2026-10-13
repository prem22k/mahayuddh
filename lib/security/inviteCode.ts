import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const CODE_LENGTH = 8;

/**
 * Eight characters over a 30-symbol alphabet: ~41 bits of entropy, which is
 * plenty for a human-shared join code.
 *
 * `randomInt` (CSPRNG) rather than `Math.random`. This code is the thing that
 * authorises a join, and `Math.random()` is a 52-bit-per-call PRNG with no
 * seeding guarantee — V8's state can be recovered from observed outputs, which
 * turns "unguessable" into "guessable given a few dozen samples". The referral
 * minting in /api/squads/referral already uses `randomBytes`; this brings the
 * join code up to the same bar.
 *
 * Rejection sampling is handled by `randomInt` itself, so the distribution is
 * uniform rather than the modulo bias a hand-rolled `%` would introduce.
 */
export function randomInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export { CODE_ALPHABET, CODE_LENGTH };