import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined),
  z.string().optional(),
);

const envSchema = z.object({
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  BOT_TOKEN: z.string().min(10),
  TONAPI_KEY: optionalString,
  COINGECKO_API_KEY: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
