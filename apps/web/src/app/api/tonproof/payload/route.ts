import { authenticate } from '@/lib/server/auth';
import { apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { generateProofPayload } from '@/lib/server/tonproof';

export const POST = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`tonproof:${user.id}`, 10);
  return json({ payload: generateProofPayload() });
});
