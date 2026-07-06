import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  COINGECKO_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
