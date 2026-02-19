import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { requireAuth } from "../plugins/auth";
import { realtime, safeSend, nowMs } from "../realtime/state";
import { enqueue, removeFromPool, tryMatchmake, endMatch } from "../realtime/matchmaking";

type ClientMsg =
  | { type: "POOL_JOIN" }
  | { type: "POOL_LEAVE" }
  | { type: "CHAT_SEND"; matchId: string; text: string };

export async function realtimeRoutes(app: FastifyInstance) {
  // Register websocket plugin once (safe even if called once)
  await app.register(websocket);

  // WebSocket endpoint
  app.get(
    "/ws",
    { preHandler: requireAuth, websocket: true },
    (socket, req: any) => {
      const userId = req.user.sub as string;

      // Register client
      realtime.clients.set(userId, {
        userId,
        socket, // ✅ socket IS the websocket
        matchId: null,
        lastSeenAt: nowMs(),
      });

      safeSend(socket, { type: "WS_READY" });

      socket.on("message", (raw: any) => {
        try {
          const msg = JSON.parse(raw.toString()) as ClientMsg;

          const conn = realtime.clients.get(userId);
          if (conn) conn.lastSeenAt = nowMs();

          if (msg.type === "POOL_JOIN") {
            enqueue(userId);
            safeSend(socket, { type: "POOL_STATE", inPool: true });
            tryMatchmake();
            return;
          }

          if (msg.type === "POOL_LEAVE") {
            removeFromPool(userId);

            // If they were in a match, end it
            const matchId = realtime.clients.get(userId)?.matchId;
            if (matchId) endMatch(matchId, "leave");

            safeSend(socket, { type: "POOL_STATE", inPool: false });
            return;
          }

          if (msg.type === "CHAT_SEND") {
            const conn = realtime.clients.get(userId);
            if (!conn?.matchId || conn.matchId !== msg.matchId) return;

            // sanitize minimal
            const text = String(msg.text ?? "").slice(0, 500);
            if (!text.trim()) return;

            const session = realtime.matches.get(msg.matchId);
            if (!session || session.status !== "active") return;

            const otherId = session.userA === userId ? session.userB : session.userA;
            const otherConn = realtime.clients.get(otherId);
            if (!otherConn) return;

            const payload = {
              type: "CHAT_MSG",
              matchId: msg.matchId,
              from: userId,
              text,
              at: new Date().toISOString(),
            };

            // Echo to sender + send to other
            safeSend(socket, payload);
            safeSend(otherConn.socket, payload);
            return;
          }
        } catch {
          // ignore malformed messages
        }
      });

      socket.on("close", () => {
        // Clean up
        removeFromPool(userId);

        const conn = realtime.clients.get(userId);
        const matchId = conn?.matchId;

        realtime.clients.delete(userId);

        // If they were in a match, end it
        if (matchId) endMatch(matchId, "disconnect");
      });
    }
  );
}