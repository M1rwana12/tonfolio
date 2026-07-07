import { json } from '@/lib/server/http';

export function GET(): Response {
  return json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
}
