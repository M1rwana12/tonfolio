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
  /** "webhook" in production (behind Caddy); anything else = long polling. */
  BOT_MODE: optionalString,
  /** Public origin used to register the webhook, e.g. https://example.com */
  APP_URL: optionalString,
  WEBHOOK_SECRET: optionalString,
  PORT: z.coerce.number().int().positive().default(8080),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}
