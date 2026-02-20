// services/api/src/lib/gemStore.ts
// DEV-ONLY in-memory gem store (used for dev WS bypass and /gems/dev).
// Production should use Prisma-backed gems (lib/gems.ts).

export type GemAccount = {
  balance: number;
  updatedAt: number;
};

const accounts = new Map<string, GemAccount>();

// Keep these aligned with your config defaults for dev testing.
// (You can change to 3 or whatever you want.)
const DEFAULT_STARTING_GEMS = 3;
const MATCH_EXTEND_GEM_COST = 1;

function now() {
  return Date.now();
}

export function getOrCreateAccount(userId: string): GemAccount {
  const existing = accounts.get(userId);
  if (existing) return existing;

  const created: GemAccount = { balance: DEFAULT_STARTING_GEMS, updatedAt: now() };
  accounts.set(userId, created);
  return created;
}

export function getBalance(userId: string): number {
  return getOrCreateAccount(userId).balance;
}

export function grantGems(userId: string, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid grant amount");
  const acct = getOrCreateAccount(userId);
  acct.balance += amount;
  acct.updatedAt = now();
  return acct.balance;
}

export function spendGems(
  userId: string,
  amount: number
): { ok: true; balance: number } | { ok: false; balance: number } {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid spend amount");
  const acct = getOrCreateAccount(userId);

  if (acct.balance < amount) {
    return { ok: false, balance: acct.balance };
  }

  acct.balance -= amount;
  acct.updatedAt = now();
  return { ok: true, balance: acct.balance };
}

/** Convenience for match extension (spends MATCH_EXTEND_GEM_COST). */
export function spendExtendGem(userId: string) {
  return spendGems(userId, MATCH_EXTEND_GEM_COST);
}

/** Helpful for local dev / tests */
export function _dangerousResetAllGemAccounts() {
  accounts.clear();
}