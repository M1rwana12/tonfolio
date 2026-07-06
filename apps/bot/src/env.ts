import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined),
  z.string().optional(),
);

const envSchema = z.object({
  BOT_TOKEN: z.string().min(10),
  WEB_APP_URL: optionalString,
  TONAPI_KEY: optionalString,
  COINGECKO_API_KEY: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
