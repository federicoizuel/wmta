import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL;
  let connectionString = dbUrl;

  if (dbUrl) {
    const url = new URL(dbUrl);

    // Silencia la advertencia de seguridad usando la API WHATWG URL
    if (url.searchParams.get('sslmode') === 'require' && !url.searchParams.has('uselibpqcompat')) {
      url.searchParams.set('sslmode', 'verify-full');
    }
    connectionString = url.toString();
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