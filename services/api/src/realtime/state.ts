import { config } from "../lib/config";

export type UserId = string;

export type ClientConn = {
  userId: UserId;
  socket: any; // ws socket
  matchId: string | null;
  lastSeenAt: number;
};

export type MatchSession = {
  id: string;
  userA: UserId;
  userB: UserId;
  startedAt: number;
  endsAt: number; // primary chat end time
  status: "active" | "ended";
  timer?: NodeJS.Timeout;
};

export const realtime = {
  // userId -> connection
  clients: new Map<UserId, ClientConn>(),

  // matchmaking pool (FIFO)
  pool: [] as UserId[],

  // matchId -> session
  matches: new Map<string, MatchSession>(),

  // userPair cooldown: "a|b" -> timestamp(ms) when they can match again
  pairCooldownUntil: new Map<string, number>(),
};

export function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

export function nowMs() {
  return Date.now();
}

export function cooldownActive(a: string, b: string) {
  const key = pairKey(a, b);
  const until = realtime.pairCooldownUntil.get(key);
  return typeof until === "number" && until > nowMs();
}

export function setPairCooldown(a: string, b: string) {
  const key = pairKey(a, b);
  const until = nowMs() + config.cooldowns.pairCooldownHours * 60 * 60 * 1000;
  realtime.pairCooldownUntil.set(key, until);
}

export function safeSend(socket: any, payload: any) {
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}