import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 7+).
 *
 * Since Prisma 7 the connection URL no longer lives in `schema.prisma`.
 * CLI commands (`migrate`, `db pull`, `studio`) read it from here, while the
 * running application supplies its own URL through a driver adapter in
 * `src/prisma/prisma.service.ts`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
