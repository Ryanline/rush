import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { spendGem, syncGems } from "../lib/gems";

export async function gemsRoutes(app: FastifyInstance) {
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
}