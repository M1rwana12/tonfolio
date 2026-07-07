import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { ed25519 } from '@noble/curves/ed25519';

import { serverEnv } from './env';

const PROOF_PREFIX = 'ton-proof-item-v2/';
const CONNECT_PREFIX = 'ton-connect';
const PAYLOAD_TTL_MS = 10 * 60 * 1000;
const PROOF_MAX_AGE_SEC = 15 * 60;

function payloadSecret(): Buffer {
  // derived, so the bot token itself never leaves the auth path
  return createHash('sha256').update(`tonproof:${serverEnv().BOT_TOKEN}`).digest();
}

function signPayload(nonce: string, expiresAt: number): string {
  return createHmac('sha256', payloadSecret())
    .update(`${nonce}.${expiresAt}`)
    .digest('hex')
    .slice(0, 32);
}

/** Stateless challenge: nonce + expiry + HMAC, verified on the way back. */
export function generateProofPayload(): string {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + PAYLOAD_TTL_MS;
  return `${nonce}.${expiresAt}.${signPayload(nonce, expiresAt)}`;
}

export function isProofPayloadValid(payload: string): boolean {
  const [nonce, expiresAtRaw, signature] = payload.split('.');
  if (!nonce || !expiresAtRaw || !signature) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signPayload(nonce, expiresAt);
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}

export interface TonProof {
  timestamp: number;
  domain: { lengthBytes: number; value: string };
  payload: string;
  signature: string;
}

export interface VerifyProofInput {
  /** Raw address "wc:hex" as reported by TON Connect. */
  address: string;
  proof: TonProof;
  /** Hex-encoded ed25519 public key of the wallet. */
  publicKey: string;
}

/**
 * Reference scheme (ton-connect/requests-responses.md):
 *   message  = "ton-proof-item-v2/" ++ wc(int32 BE) ++ hash(32) ++
 *              domainLen(uint32 LE) ++ domain ++ timestamp(uint64 LE) ++ payload
 *   signed   = sha256(0xffff ++ "ton-connect" ++ sha256(message))
 */
export function verifyTonProofSignature(input: VerifyProofInput): boolean {
  const [wcRaw, hashHex] = input.address.split(':');
  if (wcRaw === undefined || hashHex === undefined || hashHex.length !== 64) return false;

  const wc = Buffer.alloc(4);
  wc.writeInt32BE(Number(wcRaw), 0);

  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64LE(BigInt(input.proof.timestamp), 0);

  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32LE(input.proof.domain.lengthBytes, 0);

  const message = Buffer.concat([
    Buffer.from(PROOF_PREFIX),
    wc,
    Buffer.from(hashHex, 'hex'),
    domainLength,
    Buffer.from(input.proof.domain.value),
    timestamp,
    Buffer.from(input.proof.payload),
  ]);

  const messageHash = createHash('sha256').update(message).digest();
  const signedMessage = createHash('sha256')
    .update(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from(CONNECT_PREFIX), messageHash]))
    .digest();

  try {
    return ed25519.verify(
      Buffer.from(input.proof.signature, 'base64'),
      signedMessage,
      Buffer.from(input.publicKey, 'hex'),
    );
  } catch {
    return false;
  }
}

export function isProofTimestampFresh(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - timestamp <= PROOF_MAX_AGE_SEC && timestamp - now <= 60;
}

/** Expected TMA domain, derived from APP_URL; null disables the check in dev. */
export function expectedProofDomain(): string | null {
  const env = serverEnv();
  if (env.APP_URL) return new URL(env.APP_URL).host;
  return env.ALLOW_DEV_AUTH === '1' ? null : '';
}
