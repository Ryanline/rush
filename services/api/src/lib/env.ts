import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.string().optional(),
  HOST: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);