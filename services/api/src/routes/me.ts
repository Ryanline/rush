import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth";
import { syncGems } from "../lib/gems";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, async (req: any) => {
    const userId = req.user.sub as string;

    // Ensure gem state is current
    await syncGems(app.prisma, userId);

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        birthYear: true,
        createdAt: true,
        gems: {
          select: { gems: true, gemMax: true, nextRegenAt: true, lastFullNotifiedAt: true },
        },
        settings: {
          select: {
            notifyEmail: true,
            notifySms: true,
            notifyOnGemRegain: true,
            notifyOnGemsFull: true,
            emailForNotifs: true,
            phoneForSms: true,
          },
        },
      },
    });

    return { ok: true, user };
  });
}