import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import "dotenv/config";

import prismaPlugin from "./plugins/prisma";
import jwtPlugin from "./plugins/jwt";
import { authRoutes } from "./routes/auth";
import { wsRoutes } from "./routes/ws";

async function buildServer() {
  const app = Fastify({ logger: true });

  // Security + basic protections
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(sensible);

  // Allow the Vite dev server(s) to call the API from the browser
  await app.register(cors, {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  });

  // WebSockets
  await app.register(websocket);

  // Core plugins
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);

  // Health checks
  app.get("/health/live", async () => ({ ok: true }));
  app.get("/health/ready", async () => ({ ok: true }));

  // Routes
  await app.register(authRoutes);
  await app.register(wsRoutes);

  return app;
}

async function start() {
  const app = await buildServer();

  const PORT = Number(process.env.PORT || 3001);
  const HOST = process.env.HOST || "0.0.0.0";

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();