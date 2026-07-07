import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, bigintReplacer), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

type RouteContext = { params: Promise<Record<string, string>> };

export function apiRoute(
  handler: (req: Request, ctx: RouteContext) => Promise<Response>,
): (req: Request, ctx: RouteContext) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        return json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return json({ error: 'invalid request', issues: error.issues }, { status: 400 });
      }
      console.error('[api] unhandled error:', error);
      return json({ error: 'internal error' }, { status: 500 });
    }
  };
}
