import { z } from 'zod';

/** Integer amount in minimal units (nanoton / jetton units / fixed-point fiat), as a string. */
const unitsString = z.string().regex(/^\d+$/, 'expected an integer amount in minimal units');

export const alertParamsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PRICE_ABOVE'),
    assetId: z.string().min(1),
    priceUsd: unitsString,
  }),
  z.object({
    type: z.literal('PRICE_BELOW'),
    assetId: z.string().min(1),
    priceUsd: unitsString,
  }),
  z.object({
    type: z.literal('PRICE_CHANGE_PCT'),
    assetId: z.string().min(1),
    thresholdBps: z.number().int().min(10).max(100_000),
    windowMinutes: z.number().int().min(5).max(1_440),
  }),
  z.object({
    type: z.literal('WALLET_TX'),
    walletId: z.string().min(1),
  }),
  z.object({
    type: z.literal('LARGE_TRANSFER'),
    walletId: z.string().min(1),
    minAmount: unitsString,
    assetId: z.string().min(1).optional(),
  }),
]);

export type AlertParams = z.infer<typeof alertParamsSchema>;
export type AlertParamsOf<T extends AlertParams['type']> = Extract<AlertParams, { type: T }>;
