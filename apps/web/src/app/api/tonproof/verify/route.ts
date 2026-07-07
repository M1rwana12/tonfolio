import { linkVerifiedWallet } from '@tonfolio/core';
import { parseTonAddress } from '@tonfolio/ton';
import { z } from 'zod';

import { authenticate } from '@/lib/server/auth';
import { ApiError, apiRoute, json } from '@/lib/server/http';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { services } from '@/lib/server/services';
import {
  expectedProofDomain,
  isProofPayloadValid,
  isProofTimestampFresh,
  verifyTonProofSignature,
} from '@/lib/server/tonproof';

const bodySchema = z.object({
  address: z.string().min(3),
  proof: z.object({
    timestamp: z.number().int(),
    domain: z.object({
      lengthBytes: z.number().int().positive(),
      value: z.string().min(1),
    }),
    payload: z.string().min(1),
    signature: z.string().min(1),
  }),
});

/**
 * Server-side ton_proof verification — the wallet becomes verified only after
 * the ed25519 signature checks out. The client is never trusted.
 */
export const POST = apiRoute(async (req) => {
  const user = await authenticate(req);
  checkRateLimit(`tonproof:${user.id}`, 10);
  const { prisma, tonapi } = services();

  const body = bodySchema.parse(await req.json());

  if (!isProofPayloadValid(body.proof.payload)) {
    throw new ApiError(400, 'proof payload is invalid or expired');
  }
  if (!isProofTimestampFresh(body.proof.timestamp)) {
    throw new ApiError(400, 'proof timestamp is stale');
  }
  const domain = expectedProofDomain();
  if (domain !== null && body.proof.domain.value !== domain) {
    throw new ApiError(400, 'proof domain mismatch');
  }

  const address = parseTonAddress(body.address);
  if (!address) throw new ApiError(400, 'invalid address');

  // public key via get_public_key get-method (tonapi); undeployed wallets
  // cannot be verified this way and are rejected explicitly
  let publicKey: string;
  try {
    publicKey = await tonapi.getAccountPublicKey(address.friendly);
  } catch {
    throw new ApiError(400, 'wallet is not deployed — make any transaction first');
  }

  if (!verifyTonProofSignature({ address: address.raw, proof: body.proof, publicKey })) {
    throw new ApiError(401, 'ton_proof signature verification failed');
  }

  const wallet = await linkVerifiedWallet(prisma, tonapi, user.id, address);
  return json({ ok: true, wallet: { id: wallet.id, addressFriendly: wallet.addressFriendly } });
});
