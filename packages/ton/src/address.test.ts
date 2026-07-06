import { describe, expect, it } from 'vitest';

import { parseTonAddress } from './address.js';

const ZERO_RAW = `0:${'0'.repeat(64)}`;
const FOUNDATION = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';

describe('parseTonAddress', () => {
  it('parses a raw address and derives a friendly form', () => {
    const parsed = parseTonAddress(ZERO_RAW);

    expect(parsed).not.toBeNull();
    expect(parsed?.raw).toBe(ZERO_RAW);
    expect(parsed?.friendly).toMatch(/^UQ[A-Za-z0-9_-]{46}$/);
  });

  it('parses a real friendly mainnet address into canonical raw form', () => {
    const parsed = parseTonAddress(FOUNDATION);

    expect(parsed).not.toBeNull();
    expect(parsed?.raw).toMatch(/^0:[0-9a-f]{64}$/);
  });

  it('round-trips friendly → raw → friendly', () => {
    const first = parseTonAddress(FOUNDATION);
    const second = parseTonAddress(first?.raw ?? '');

    expect(second?.friendly).toBe(first?.friendly);
    expect(second?.raw).toBe(first?.raw);
  });

  it('resolves bounceable and non-bounceable forms to the same raw address', () => {
    const fromRaw = parseTonAddress(ZERO_RAW);
    const viaFriendly = parseTonAddress(fromRaw?.friendly ?? '');

    expect(viaFriendly?.raw).toBe(ZERO_RAW);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseTonAddress(`  ${FOUNDATION}\n`)?.raw).toBe(parseTonAddress(FOUNDATION)?.raw);
  });

  it('rejects a friendly address with a corrupted checksum', () => {
    const corrupted = `${FOUNDATION.slice(0, -2)}AA`;

    expect(parseTonAddress(corrupted)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(parseTonAddress('hello world')).toBeNull();
    expect(parseTonAddress('')).toBeNull();
    expect(parseTonAddress('0:xyz')).toBeNull();
  });
});
