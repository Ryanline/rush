import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import "dotenv/config";

import prismaPlugin from "./plugins/prisma";
import jwtPlugin from "./plugins/jwt";
import { env } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { wsRoutes } from "./routes/ws";
import { gemsRoutes } from "./routes/gems";
import { meRoutes } from "./routes/me";

function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(sensible);

  await app.register(cors, {
    origin: parseCorsOrigins(env.CORS_ORIGINS),
    credentials: true,
  });

  await app.register(websocket);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);

  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(gemsRoutes);
  await app.register(wsRoutes);

  return app;
}

export async function start() {
  const app = await buildServer();

  const PORT = Number(env.PORT || 3001);
  const HOST = env.HOST || "0.0.0.0";

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
