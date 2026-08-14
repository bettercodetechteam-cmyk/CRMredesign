import { request as httpRequest } from 'http';

import { checkPostgresConnection } from './services/postgresBootstrap';

async function checkNestApi(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/health',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export async function logDevStackStatus(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const nestPort = Number(process.env.NEST_API_PORT || 4000);
  const [postgresOk, nestOk] = await Promise.all([
    checkPostgresConnection(),
    checkNestApi(nestPort),
  ]);

  if (postgresOk && nestOk) {
    console.log('✅ Dev stack: PostgreSQL and Nest API are reachable');
    return;
  }

  console.warn('⚠️  Dev stack incomplete — CRM features need PostgreSQL + Nest API:');
  if (!postgresOk) {
    console.warn('   • PostgreSQL: not reachable (start Docker Desktop → npm run db:up)');
  }
  if (!nestOk) {
    console.warn(
      `   • Nest API: not running on port ${nestPort} (use npm run dev or npm run dev:full)`,
    );
  }
}
