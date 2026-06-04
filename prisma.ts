import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
  let connectionString = process.env.DATABASE_URL;

  // Silencia la advertencia de seguridad forzando el modo verify-full si se detecta require
  if (connectionString?.includes('sslmode=require') && !connectionString.includes('uselibpqcompat')) {
    connectionString = connectionString.replace('sslmode=require', 'sslmode=verify-full');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;