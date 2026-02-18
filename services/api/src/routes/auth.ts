import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { hashPassword, verifyPassword } from "../lib/password";

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(50),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(u: { id: string; email: string; firstName: string; birthYear: number }) {
  return { id: u.id, email: u.email, firstName: u.firstName, birthYear: u.birthYear };
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/signup
  app.post("/auth/signup", async (req, reply) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_BODY", details: parsed.error.flatten() });

    const { email, password, firstName, birthYear } = parsed.data;

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "EMAIL_IN_USE" });

    const passwordHash = await hashPassword(password);

    const user = await app.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        birthYear,
        settings: {
          create: {
            notifyEmail: true,
            notifySms: false,
            notifyOnGemRegain: true,
            notifyOnGemsFull: true,
            emailForNotifs: email,
          },
        },
        gems: {
          create: {
            gems: 3,
            gemMax: 3,
            nextRegenAt: null,
            lastFullNotifiedAt: null,
          },
        },
      },
      select: { id: true, email: true, firstName: true, birthYear: true },
    });

    const token = await reply.jwtSign({ sub: user.id });

    return reply.code(201).send({ token, user: publicUser(user) });
  });

  // POST /auth/login
  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_BODY", details: parsed.error.flatten() });

    const { email, password } = parsed.data;

    const user = await app.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, firstName: true, birthYear: true, passwordHash: true },
    });

    if (!user) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "INVALID_CREDENTIALS" });

    const token = await reply.jwtSign({ sub: user.id });

    const { passwordHash: _ph, ...safe } = user;
    return reply.send({ token, user: publicUser(safe) });
  });
}