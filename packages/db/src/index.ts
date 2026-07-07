import { Prisma, PrismaClient } from '@prisma/client';

export * from '@prisma/client';

/** NUMERIC(38,0) columns hold integer minimal units; code works in bigint. */
export function decimalToBigint(value: Prisma.Decimal): bigint {
  return BigInt(value.toFixed(0));
}

let client: PrismaClient | undefined;

/** Lazy singleton — keeps a single connection pool per process. */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}
