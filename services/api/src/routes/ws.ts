import type { FastifyInstance } from "fastify";
import { getBalance, spendExtendGem } from "../lib/gemStore";

type ClientMsg =
  | { type: "POOL_JOIN" }
  | { type: "POOL_LEAVE" }
  | { type: "CHAT_SEND"; matchId: string; text: string }
  | { type: "MATCH_EXTEND"; matchId: string };

type ServerMsg =
  | { type: "WS_READY" }
  | { type: "POOL_JOINED" }
  | { type: "POOL_LEFT" }
  | { type: "MATCH_FOUND"; matchId: string; peerId: string; endsAt: number }
  | { type: "TIMER_UPDATE"; matchId: string; endsAt: number; by: string }
  | { type: "CHAT_MSG"; matchId: string; from: string; text: string; at: string }
  | { type: "PEER_STATUS"; matchId: string; peerId: string; status: "reconnecting" | "connected" }
  | { type: "MATCH_ENDED"; reason: "leave" | "disconnect" | "timeout" }
  | { type: "ERROR"; error: string };

type ClientConn = {
  userId: string;
  socket: any;
  socketId: number;
  matchId: string | null;
};

type Match = {
  a: string;
  b: string;

  endsAt: number;
  timeoutId: ReturnType<typeof setTimeout>;

  // reconnect grace
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;

  // timeout decision window
  state: "active" | "ended_timeout";
  finalizeAt: number | null; // epoch ms when we will finalize, if ended_timeout
  finalizeId: ReturnType<typeof setTimeout> | null;

  // Two-party extend consent (kept silent)
  extendVotes: Set<string>;
};

const DISCONNECT_GRACE_MS = 5000;
const TIMEOUT_DECISION_MS = 10_000;

// ⏱ testing values
const INITIAL_MATCH_MS = 10_000; // 10 seconds
const EXTEND_MS = 5_000; // 5 seconds

const clients = new Map<string, ClientConn>();
const pool: string[] = [];
const matches = new Map<string, Match>();

let nextSocketId = 1;

function send(socket: any, msg: ServerMsg) {
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    // ignore
  }
}

function inPool(userId: string) {
  return pool.includes(userId);
}

function removeFromPool(userId: string) {
  const idx = pool.indexOf(userId);
  if (idx >= 0) pool.splice(idx, 1);
}

function makeMatchId(a: string, b: string) {
  return `${a}_${b}_${Date.now()}`;
}

function findMatchForUser(userId: string): { matchId: string; match: Match; peerId: string } | null {
  for (const [matchId, m] of matches.entries()) {
    if (m.a === userId) return { matchId, match: m, peerId: m.b };
    if (m.b === userId) return { matchId, match: m, peerId: m.a };
  }
  return null;
}

function otherIdFor(match: Match, userId: string) {
  return match.a === userId ? match.b : match.a;
}

function notifyPeerStatus(matchId: string, match: Match, subjectUserId: string, status: "reconnecting" | "connected") {
  const peerId = otherIdFor(match, subjectUserId);
  const peerConn = clients.get(peerId);
  if (!peerConn) return;

  send(peerConn.socket, { type: "PEER_STATUS", matchId, peerId: subjectUserId, status });
}

function clearDisconnectTimer(matchId: string, match: Match, userId: string) {
  const t = match.disconnectTimers.get(userId);
  if (t) {
    try {
      clearTimeout(t);
    } catch {}
    match.disconnectTimers.delete(userId);
    notifyPeerStatus(matchId, match, userId, "connected");
  }
}

function scheduleDisconnectEnd(matchId: string, userId: string) {
  const m = matches.get(matchId);
  if (!m) return;

  if (m.disconnectTimers.has(userId)) return;

  notifyPeerStatus(matchId, m, userId, "reconnecting");

  const t = setTimeout(() => {
    const still = matches.get(matchId);
    if (!still) return;
    endMatch(matchId, "disconnect");
  }, DISCONNECT_GRACE_MS);

  m.disconnectTimers.set(userId, t);
}

function clearTimeoutTimer(m: Match) {
  try {
    clearTimeout(m.timeoutId);
  } catch {}
}

function clearFinalizeTimer(m: Match) {
  if (!m.finalizeId) return;
  try {
    clearTimeout(m.finalizeId);
  } catch {}
  m.finalizeId = null;
  m.finalizeAt = null;
}

function scheduleMatchTimeout(matchId: string, m: Match) {
  clearTimeoutTimer(m);

  m.timeoutId = setTimeout(() => {
    const still = matches.get(matchId);
    if (!still) return;
    onTimeout(matchId);
  }, Math.max(0, m.endsAt - Date.now()));
}

function finalizeTimeout(matchId: string) {
  const m = matches.get(matchId);
  if (!m) return;

  // If match got extended/resumed, do nothing
  if (m.state !== "ended_timeout") return;

  // Clear match state for participants so they can queue again
  const ca = clients.get(m.a);
  const cb = clients.get(m.b);
  if (ca?.matchId === matchId) ca.matchId = null;
  if (cb?.matchId === matchId) cb.matchId = null;

  // Stop timers and remove match
  clearTimeoutTimer(m);
  clearFinalizeTimer(m);
  m.disconnectTimers.forEach((t) => {
    try {
      clearTimeout(t);
    } catch {}
  });
  m.disconnectTimers.clear();

  matches.delete(matchId);
}

function onTimeout(matchId: string) {
  const m = matches.get(matchId);
  if (!m) return;

  // Enter decision window
  m.state = "ended_timeout";
  m.finalizeAt = Date.now() + TIMEOUT_DECISION_MS;

  // Clear any pending extend votes when entering timeout menu
  m.extendVotes.clear();

  // Notify both sides (if connected). Keep match around for potential Extend.
  const ca = clients.get(m.a);
  const cb = clients.get(m.b);

  if (ca?.matchId === matchId) send(ca.socket, { type: "MATCH_ENDED", reason: "timeout" });
  if (cb?.matchId === matchId) send(cb.socket, { type: "MATCH_ENDED", reason: "timeout" });

  // Finalize after decision window
  clearFinalizeTimer(m);
  m.finalizeId = setTimeout(() => finalizeTimeout(matchId), TIMEOUT_DECISION_MS);
}

function endMatch(matchId: string, reason: "leave" | "disconnect" | "timeout") {
  const m = matches.get(matchId);
  if (!m) return;

  clearTimeoutTimer(m);
  clearFinalizeTimer(m);

  m.disconnectTimers.forEach((t) => {
    try {
      clearTimeout(t);
    } catch {}
  });
  m.disconnectTimers.clear();

  matches.delete(matchId);

  const ca = clients.get(m.a);
  const cb = clients.get(m.b);

  if (ca?.matchId === matchId) {
    ca.matchId = null;
    send(ca.socket, { type: "MATCH_ENDED", reason });
  }

  if (cb?.matchId === matchId) {
    cb.matchId = null;
    send(cb.socket, { type: "MATCH_ENDED", reason });
  }
}

function tryMatchmake() {
  while (pool.length >= 2) {
    const a = pool.shift()!;
    const b = pool.shift()!;
    if (a === b) continue;

    const ca = clients.get(a);
    const cb = clients.get(b);
    if (!ca || !cb) continue;

    const matchId = makeMatchId(a, b);
    const endsAt = Date.now() + INITIAL_MATCH_MS;

    const m: Match = {
      a,
      b,
      endsAt,
      timeoutId: setTimeout(() => {}, 0) as any,
      disconnectTimers: new Map(),
      state: "active",
      finalizeAt: null,
      finalizeId: null,
      extendVotes: new Set(),
    };

    matches.set(matchId, m);
    scheduleMatchTimeout(matchId, m);

    ca.matchId = matchId;
    cb.matchId = matchId;

    send(ca.socket, { type: "MATCH_FOUND", matchId, peerId: b, endsAt });
    send(cb.socket, { type: "MATCH_FOUND", matchId, peerId: a, endsAt });
  }
}

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (connection: any, req: any) => {
    const socket = connection?.socket ?? connection;

    const token = (req.query as any)?.token as string | undefined;
    const isProd = process.env.NODE_ENV === "production";

    // DEV bypass
    let userId = "";
    const devUser = String((req.query as any)?.user ?? "").trim();
    const devToken = String(process.env.DEV_WS_BYPASS_TOKEN || "dev");

    if (!token) {
      try {
        socket.close(4401, "Missing token");
      } catch {}
      return;
    }

    if (!isProd && token === devToken) {
      userId = devUser || `dev_${Math.random().toString(16).slice(2, 8)}`;
    } else {
      try {
        const payload = app.jwt.verify<{ sub: string }>(token);
        userId = payload.sub;
      } catch {
        try {
          socket.close(4403, "Invalid token");
        } catch {}
        return;
      }
    }

    const socketId = nextSocketId++;

    // Close old socket on reconnect
    const existing = clients.get(userId);
    if (existing) {
      try {
        existing.socket.close(4400, "Reconnected");
      } catch {}
      removeFromPool(userId);
    }

    clients.set(userId, { userId, socket, socketId, matchId: null });

    send(socket, { type: "WS_READY" });

    // Reattach if user is in a match
    const active = findMatchForUser(userId);
    if (active) {
      clearDisconnectTimer(active.matchId, active.match, userId);

      const conn = clients.get(userId);
      if (conn) conn.matchId = active.matchId;

      send(socket, {
        type: "MATCH_FOUND",
        matchId: active.matchId,
        peerId: active.peerId,
        endsAt: active.match.endsAt,
      });

      // If match is in the "ended timeout menu" state, re-send MATCH_ENDED so UI shows menu
      if (active.match.state === "ended_timeout") {
        send(socket, { type: "MATCH_ENDED", reason: "timeout" });
      }
    }

    socket.on("message", (raw: any) => {
      let msg: ClientMsg | any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg?.type === "POOL_JOIN") {
        const conn = clients.get(userId);
        if (conn?.matchId) return send(socket, { type: "ERROR", error: "ALREADY_IN_MATCH" });

        if (!inPool(userId)) pool.push(userId);
        send(socket, { type: "POOL_JOINED" });
        tryMatchmake();
        return;
      }

      if (msg?.type === "POOL_LEAVE") {
        removeFromPool(userId);

        const conn = clients.get(userId);
        if (conn?.matchId) endMatch(conn.matchId, "leave");

        send(socket, { type: "POOL_LEFT" });
        return;
      }

      if (msg?.type === "CHAT_SEND") {
        const matchId = String(msg.matchId ?? "");
        const text = String(msg.text ?? "").slice(0, 500);

        if (!matchId) return send(socket, { type: "ERROR", error: "MISSING_MATCH_ID" });
        if (!text.trim()) return;

        const conn = clients.get(userId);
        if (!conn?.matchId || conn.matchId !== matchId) {
          return send(socket, { type: "ERROR", error: "NOT_IN_MATCH" });
        }

        const m = matches.get(matchId);
        if (!m) return send(socket, { type: "ERROR", error: "NO_SUCH_MATCH" });

        // No chat during end menu window
        if (m.state !== "active") return;

        const otherId = m.a === userId ? m.b : m.a;
        const other = clients.get(otherId);
        if (!other) return send(socket, { type: "ERROR", error: "PEER_OFFLINE" });

        const payload: ServerMsg = {
          type: "CHAT_MSG",
          matchId,
          from: userId,
          text,
          at: new Date().toISOString(),
        };

        send(socket, payload);
        send(other.socket, payload);
        return;
      }

      if (msg?.type === "MATCH_EXTEND") {
        const matchId = String(msg.matchId ?? "");
        if (!matchId) return send(socket, { type: "ERROR", error: "MISSING_MATCH_ID" });

        const m = matches.get(matchId);
        if (!m) return send(socket, { type: "ERROR", error: "NO_SUCH_MATCH" });

        // must be participant
        if (m.a !== userId && m.b !== userId) return send(socket, { type: "ERROR", error: "NOT_IN_MATCH" });

        // Only allow extend during timeout menu window
        if (m.state !== "ended_timeout") return send(socket, { type: "ERROR", error: "NOT_EXTENDABLE" });

        // Must still be within decision window
        if (m.finalizeAt && Date.now() > m.finalizeAt) {
          return send(socket, { type: "ERROR", error: "EXTEND_WINDOW_EXPIRED" });
        }

        // If user can't afford, tell ONLY them (this doesn't reveal anything about the peer)
        if (getBalance(userId) <= 0) {
          return send(socket, { type: "ERROR", error: "NOT_ENOUGH_GEMS" });
        }

        // Record vote (silent). Always ACK so the client button doesn't get stuck.
        m.extendVotes.add(userId);
        send(socket, { type: "ERROR", error: "EXTEND_PENDING" });

        // If both have voted, then and only then: charge both + extend.
        const bothVoted = m.extendVotes.has(m.a) && m.extendVotes.has(m.b);
        if (!bothVoted) return;

        // Check affordability for BOTH without revealing votes/status.
        // If either can't pay, extension simply will not happen. Only notify the broke user.
        const aCanPay = getBalance(m.a) > 0;
        const bCanPay = getBalance(m.b) > 0;

        if (!aCanPay || !bCanPay) {
          // Clear votes so they can try again (still silent)
          m.extendVotes.clear();

          if (!aCanPay) {
            const ca = clients.get(m.a);
            if (ca?.matchId === matchId) send(ca.socket, { type: "ERROR", error: "NOT_ENOUGH_GEMS" });
          }
          if (!bCanPay) {
            const cb = clients.get(m.b);
            if (cb?.matchId === matchId) send(cb.socket, { type: "ERROR", error: "NOT_ENOUGH_GEMS" });
          }

          return;
        }

        // Spend from BOTH. If anything fails (shouldn't given checks), do not extend.
        const spentA = spendExtendGem(m.a);
        const spentB = spendExtendGem(m.b);

        if (!spentA.ok || !spentB.ok) {
          // Attempt to avoid inconsistent future behavior by clearing votes.
          // (In-memory store makes true rollback annoying; this should be extremely rare.)
          m.extendVotes.clear();

          if (!spentA.ok) {
            const ca = clients.get(m.a);
            if (ca?.matchId === matchId) send(ca.socket, { type: "ERROR", error: "NOT_ENOUGH_GEMS" });
          }
          if (!spentB.ok) {
            const cb = clients.get(m.b);
            if (cb?.matchId === matchId) send(cb.socket, { type: "ERROR", error: "NOT_ENOUGH_GEMS" });
          }

          return;
        }

        // Success: clear votes, resume match, extend time.
        m.extendVotes.clear();

        clearFinalizeTimer(m);
        m.state = "active";
        m.finalizeAt = null;

        m.endsAt = Math.max(Date.now(), m.endsAt) + EXTEND_MS;
        scheduleMatchTimeout(matchId, m);

        const ca = clients.get(m.a);
        const cb = clients.get(m.b);

        // We DO notify both only on success (allowed)
        if (ca?.matchId === matchId) send(ca.socket, { type: "TIMER_UPDATE", matchId, endsAt: m.endsAt, by: userId });
        if (cb?.matchId === matchId) send(cb.socket, { type: "TIMER_UPDATE", matchId, endsAt: m.endsAt, by: userId });

        return;
      }

      send(socket, { type: "ERROR", error: "UNKNOWN_TYPE" });
    });

    socket.on("close", () => {
      const current = clients.get(userId);
      if (!current || current.socketId !== socketId) return;

      removeFromPool(userId);

      const matchId = current.matchId ?? null;
      clients.delete(userId);

      if (matchId) scheduleDisconnectEnd(matchId, userId);
    });
  });
}