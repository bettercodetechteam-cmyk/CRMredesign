#!/usr/bin/env node
/**
 * Phase 1 local dev verification — PostgreSQL + Nest API + Express stack.
 * Run after: npm run db:up && npm run db:migrate && npm run db:seed:reference && npm run dev:full
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return {};
  const text = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const databaseUrl = env.DATABASE_URL || process.env.DATABASE_URL;
const nestBase = 'http://localhost:4000/api/v1';
const expressBase = 'http://localhost:3000';

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkPostgres() {
  if (!databaseUrl) {
    fail('DATABASE_URL in .env', 'missing');
    return;
  }
  pass('DATABASE_URL in .env', 'set');

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query('SELECT 1');
    pass('PostgreSQL connection', 'ok');

    const centre = await pool.query(
      `SELECT id, code FROM centres WHERE code = 'PUNE' LIMIT 1`,
    );
    if (centre.rows[0]) {
      pass('Reference centre (PUNE)', centre.rows[0].id);
    } else {
      fail('Reference centre (PUNE)', 'run npm run db:seed:reference');
    }

    const course = await pool.query(
      `SELECT id, code FROM courses WHERE code = 'WD' LIMIT 1`,
    );
    if (course.rows[0]) {
      pass('Reference course (WD)', course.rows[0].id);
    } else {
      fail('Reference course (WD)', 'run npm run db:seed:reference');
    }

    const users = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
    pass('Users table', `${users.rows[0]?.count ?? 0} row(s) — log in once to create your user`);
  } catch (error) {
    fail('PostgreSQL connection', error instanceof Error ? error.message : String(error));
  } finally {
    await pool.end().catch(() => {});
  }
}

async function checkHttp(label, url, validate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json().catch(() => ({}))
      : null;

    if (!response.ok || (validate && !validate(body))) {
      const detail = !response.ok
        ? `HTTP ${response.status} from ${url}`
        : `unexpected response from ${url}`;
      fail(label, detail);
      return null;
    }

    pass(label, url);
    return body;
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function main() {
  console.log('\nPhase 1 verification\n');

  const apiEnvPath = path.join(root, 'api', '.env');
  if (fs.existsSync(apiEnvPath)) {
    pass('api/.env', 'present');
  } else {
    fail('api/.env', 'copy from api/.env.example and add Firebase Admin + DATABASE_URL');
  }

  await checkPostgres();

  const nestReady = await checkHttp(
    'Nest API health',
    `${nestBase}/health/ready`,
    (body) => body?.status === 'ok' || body?.data?.status === 'ok',
  );
  if (nestReady?.data?.database === 'ok' || nestReady?.database === 'ok') {
    pass('Nest Postgres health', 'ready');
  } else if (nestReady) {
    pass('Nest API reachable', 'health/ready responded');
  }

  const expressHealth = await checkHttp(
    'Express health',
    `${expressBase}/api/health`,
    (body) => body?.status === 'healthy',
  );
  if (expressHealth?.services?.postgres === 'connected') {
    pass('Express Postgres health', 'connected');
  } else if (expressHealth) {
    fail(
      'Express Postgres health',
      expressHealth.services?.postgres || 'start npm run dev:full',
    );
  }

  await checkHttp(
    'Nest proxy via Express',
    `${expressBase}/nest-api/api/v1/health`,
    (body) => body?.status === 'ok' || body?.data?.status === 'ok',
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed\n`);

  if (failed.length > 0) {
    console.log('Fix failures, then re-run: npm run phase1:verify\n');
    process.exit(1);
  }

  console.log('Phase 1 foundation is ready. Open http://localhost:3000 and sign in.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
