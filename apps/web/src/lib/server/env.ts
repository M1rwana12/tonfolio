import { z } from 'zod';

const optionalString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined),
  z.string().optional(),
);

const schema = z.object({
  BOT_TOKEN: z.string().min(10),
  TONAPI_KEY: optionalString,
  COINGECKO_API_KEY: optionalString,
  /** Public origin of the Mini App, e.g. https://tonfolio.example.com */
  APP_URL: optionalString,
  /** "1" enables header-based dev auth (never set in production). */
  ALLOW_DEV_AUTH: optionalString,
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
