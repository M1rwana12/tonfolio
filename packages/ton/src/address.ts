import { Address } from '@ton/core';

export interface ParsedTonAddress {
  /** Canonical raw form "0:<hex>" — used for storage and dedup. */
  raw: string;
  /** Non-bounceable friendly form ("UQ…") — used for display. */
  friendly: string;
}

/** Accepts raw or friendly (bounceable/non-bounceable) form; null when invalid. */
export function parseTonAddress(input: string): ParsedTonAddress | null {
  try {
    const address = Address.parse(input.trim());
    return {
      raw: address.toRawString(),
      friendly: address.toString({ bounceable: false }),
    };
  } catch {
    return null;
  }
}
