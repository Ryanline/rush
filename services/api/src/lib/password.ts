import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64; // derived key length
const SALT_BYTES = 16;

/**
 * Stores hashes like:  scrypt$<saltHex>$<derivedHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, saltHex, derivedHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !derivedHex) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(derivedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);

    // constant-time compare
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}