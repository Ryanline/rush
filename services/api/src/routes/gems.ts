import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { spendGem, syncGems } from "../lib/gems";
import { getBalance, spendExtendGem } from "../lib/gemStore.js";

export async function gemsRoutes(app: FastifyInstance) {
  // DEV ONLY: GET /gems/dev?userId=dev_xxx
  // Uses in-memory gemStore so dev IDs work even if Prisma has FK constraints.
  app.get("/gems/dev", async (req: any, reply) => {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) return reply.code(404).send({ ok: false });

    const userId = String(req.query?.userId ?? "").trim();
    if (!userId) return reply.code(400).send({ ok: false, error: "MISSING_USER_ID" });

    const balance = getBalance(userId);
    return { ok: true, gems: { gems: balance } };
  });

  // GET /gems  -> returns current gem state (always synced)
  app.get("/gems", { preHandler: requireAuth }, async (req: any) => {
    const userId = req.user.sub as string;
    const gb = await syncGems(app.prisma, userId);
    return { ok: true, gems: gb };
  });

  // POST /gems/spend -> spend 1 gem (we'll use this for "extend" later)
  app.post("/gems/spend", { preHandler: requireAuth }, async (req: any, reply) => {
    const userId = req.user.sub as string;
    const updated = await spendGem(app.prisma, userId);
    if (!updated) return reply.code(409).send({ ok: false, error: "NO_GEMS" });
    return { ok: true, gems: updated };
  });

  // DEV ONLY helper: POST /gems/dev/spend?userId=dev_xxx
  app.post("/gems/dev/spend", async (req: any, reply) => {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) return reply.code(404).send({ ok: false });

    const userId = String(req.query?.userId ?? "").trim();
    if (!userId) return reply.code(400).send({ ok: false, error: "MISSING_USER_ID" });

    const spent = spendExtendGem(userId);
    if (!spent.ok) return reply.code(409).send({ ok: false, error: "NO_GEMS", gems: { gems: spent.balance } });

    return { ok: true, gems: { gems: spent.balance } };
  });
}