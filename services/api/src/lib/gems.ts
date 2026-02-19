import type { PrismaClient } from "@prisma/client";
import { config } from "./config";

/**
 * Bring a user's GemBalance up to date as of "now".
 * - If gems are full: clear nextRegenAt.
 * - If gems are not full: add gems for every elapsed regen interval.
 *
 * Returns the updated gem balance.
 */
export async function syncGems(prisma: PrismaClient, userId: string) {
  const now = new Date();

  const gb = await prisma.gemBalance.findUnique({
    where: { userId },
  });

  if (!gb) {
    // Should not happen, but be safe for dev
    return prisma.gemBalance.create({
      data: {
        userId,
        gems: config.gems.defaultStart,
        gemMax: config.gems.defaultMax,
        nextRegenAt: null,
        lastFullNotifiedAt: null,
      },
    });
  }

  const gemMax = gb.gemMax ?? config.gems.defaultMax;

  // If already full, keep it clean
  if (gb.gems >= gemMax) {
    if (gb.nextRegenAt !== null) {
      return prisma.gemBalance.update({
        where: { userId },
        data: { gems: gemMax, nextRegenAt: null },
      });
    }
    return gb;
  }

  // Not full: ensure nextRegenAt is set
  const regenMs = config.gems.dailyRegenSeconds * 1000;
  let next = gb.nextRegenAt ?? new Date(now.getTime() + regenMs);

  // If next regen is in the future, nothing to do
  if (next.getTime() > now.getTime()) {
    // if we had to create nextRegenAt above, persist it
    if (gb.nextRegenAt === null) {
      return prisma.gemBalance.update({
        where: { userId },
        data: { nextRegenAt: next },
      });
    }
    return gb;
  }

  // nextRegenAt is in the past: compute how many gems should have been added
  const elapsedMs = now.getTime() - next.getTime();
  const intervalsPassed = 1 + Math.floor(elapsedMs / regenMs);
  const newGems = Math.min(gemMax, gb.gems + intervalsPassed);

  // If now full, clear next; else advance next by intervalsPassed
  const newNext =
    newGems >= gemMax ? null : new Date(next.getTime() + intervalsPassed * regenMs);

  return prisma.gemBalance.update({
    where: { userId },
    data: {
      gems: newGems,
      nextRegenAt: newNext,
    },
  });
}

/**
 * Spend 1 gem if available. Syncs first.
 * Returns updated balance or null if insufficient gems.
 */
export async function spendGem(prisma: PrismaClient, userId: string) {
  const gb = await syncGems(prisma, userId);
  const gemMax = gb.gemMax ?? config.gems.defaultMax;

  if (gb.gems <= 0) return null;

  const newGems = gb.gems - 1;

  // If we just went from full -> not full, schedule regen
  const regenMs = config.gems.dailyRegenSeconds * 1000;
  const nextRegenAt =
    newGems < gemMax
      ? (gb.nextRegenAt ?? new Date(Date.now() + regenMs))
      : null;

  return prisma.gemBalance.update({
    where: { userId },
    data: {
      gems: newGems,
      nextRegenAt,
    },
  });
}