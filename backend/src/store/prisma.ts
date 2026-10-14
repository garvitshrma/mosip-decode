import { PrismaClient } from "@prisma/client";

// Created on first use, not on import, so a missing `prisma generate` surfaces
// as an error on the endpoint that needs the database instead of refusing to
// start the whole server. tsx watch reloads modules, so the client is reused.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function db(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
