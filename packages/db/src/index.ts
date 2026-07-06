import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

let client: PrismaClient | undefined;

/** Lazy singleton — keeps a single connection pool per process. */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}
