import type { FastifyInstance } from "fastify";

type ClientMsg =
  | { type: "POOL_JOIN" }
  | { type: "POOL_LEAVE" }
  | { type: "CHAT_SEND"; matchId: string; text: string };

type ServerMsg =
  | { type: "WS_READY" }
  | { type: "POOL_JOINED" }
  | { type: "POOL_LEFT" }
  | { type: "MATCH_FOUND"; matchId: string; peerId: string }
  | { type: "CHAT_MSG"; matchId: string; from: string; text: string; at: string }
  | { type: "MATCH_ENDED"; reason: "leave" | "disconnect" }
  | { type: "ERROR"; error: string };

type ClientConn = {
  userId: string;
  socket: any; // websocket
  matchId: string | null;
};

type Match = { a: string; b: string };

const clients = new Map<string, ClientConn>(); // userId -> conn
const pool: string[] = []; // userIds waiting
const matches = new Map<string, Match>(); // matchId -> {a,b}

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

function tryMatchmake() {
  while (pool.length >= 2) {
    const a = pool.shift()!;
    const b = pool.shift()!;
    if (a === b) continue;

    const ca = clients.get(a);
    const cb = clients.get(b);

    // if either disconnected, skip
    if (!ca || !cb) continue;

    const matchId = makeMatchId(a, b);
    matches.set(matchId, { a, b });

    ca.matchId = matchId;
    cb.matchId = matchId;

    send(ca.socket, { type: "MATCH_FOUND", matchId, peerId: b });
    send(cb.socket, { type: "MATCH_FOUND", matchId, peerId: a });
  }
}

function endMatch(matchId: string, reason: "leave" | "disconnect") {
  const m = matches.get(matchId);
  if (!m) return;

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

export async function wsRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (connection: any, req: any) => {
    // ✅ critical fix: support either connection.socket OR direct socket
    const socket = connection?.socket ?? connection;

    // auth via querystring: /ws?token=...
    const token = (req.query as any)?.token as string | undefined;
    if (!token) {
      try {
        socket.close(4401, "Missing token");
      } catch {}
      return;
    }

    let userId = "";
    try {
      const payload = app.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      try {
        socket.close(4403, "Invalid token");
      } catch {}
      return;
    }

    // If this user reconnects, close old socket
    const existing = clients.get(userId);
    if (existing) {
      try {
        existing.socket.close(4400, "Reconnected");
      } catch {}
      removeFromPool(userId);
    }

    clients.set(userId, { userId, socket, matchId: null });

    send(socket, { type: "WS_READY" });

    socket.on("message", (raw: any) => {
      let msg: ClientMsg | any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg?.type === "POOL_JOIN") {
        // prevent joining while already in a match
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

        // echo + deliver
        send(socket, payload);
        send(other.socket, payload);
        return;
      }

      send(socket, { type: "ERROR", error: "UNKNOWN_TYPE" });
    });

    socket.on("close", () => {
      removeFromPool(userId);

      const conn = clients.get(userId);
      const matchId = conn?.matchId ?? null;

      clients.delete(userId);

      if (matchId) endMatch(matchId, "disconnect");
    });
  });
}