import { config } from "../lib/config";
import { realtime, safeSend, cooldownActive, setPairCooldown, nowMs } from "./state";

function newMatchId() {
  // simple unique id for now
  return `m_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function removeFromPool(userId: string) {
  realtime.pool = realtime.pool.filter((u) => u !== userId);
}

export function enqueue(userId: string) {
  if (!realtime.pool.includes(userId)) realtime.pool.push(userId);
}

export function tryMatchmake() {
  // Keep matching as long as we can
  while (realtime.pool.length >= 2) {
    const a = realtime.pool.shift()!;
    let bIndex = realtime.pool.findIndex((b) => !cooldownActive(a, b));
    if (bIndex === -1) {
      // nobody valid right now, put a back and stop
      realtime.pool.unshift(a);
      return;
    }
    const b = realtime.pool.splice(bIndex, 1)[0];

    const connA = realtime.clients.get(a);
    const connB = realtime.clients.get(b);

    // If either is no longer connected, skip appropriately
    if (!connA && !connB) continue;
    if (!connA) {
      // put b back
      realtime.pool.unshift(b);
      continue;
    }
    if (!connB) {
      realtime.pool.unshift(a);
      continue;
    }

    // Create match session
    const matchId = newMatchId();
    const startedAt = nowMs();
    const endsAt = startedAt + config.chat.primaryChatSeconds * 1000;

    const session = {
      id: matchId,
      userA: a,
      userB: b,
      startedAt,
      endsAt,
      status: "active" as const,
      timer: undefined as any,
    };

    // set pair cooldown immediately (so disconnect/requeue doesn't immediately rematch)
    setPairCooldown(a, b);

    realtime.matches.set(matchId, session);
    connA.matchId = matchId;
    connB.matchId = matchId;

    // Notify both clients
    safeSend(connA.socket, {
      type: "MATCH_FOUND",
      matchId,
      youAre: "A",
      other: { userId: b },
      startedAt,
      endsAt,
      chatSeconds: config.chat.primaryChatSeconds,
    });

    safeSend(connB.socket, {
      type: "MATCH_FOUND",
      matchId,
      youAre: "B",
      other: { userId: a },
      startedAt,
      endsAt,
      chatSeconds: config.chat.primaryChatSeconds,
    });

    // Auto-end timer
    session.timer = setTimeout(() => {
      endMatch(matchId, "timer");
    }, config.chat.primaryChatSeconds * 1000);

    realtime.matches.set(matchId, session);
  }
}

export function endMatch(matchId: string, reason: "timer" | "disconnect" | "leave") {
  const session = realtime.matches.get(matchId);
  if (!session || session.status === "ended") return;

  session.status = "ended";
  if (session.timer) clearTimeout(session.timer);

  const connA = realtime.clients.get(session.userA);
  const connB = realtime.clients.get(session.userB);

  if (connA) connA.matchId = null;
  if (connB) connB.matchId = null;

  const payload = { type: "MATCH_ENDED", matchId, reason };

  if (connA) safeSend(connA.socket, payload);
  if (connB) safeSend(connB.socket, payload);

  realtime.matches.delete(matchId);
}