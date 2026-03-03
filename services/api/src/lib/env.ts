import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174"),
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.string().optional(),
  HOST: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
