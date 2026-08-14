import pg from 'pg';

import {
  getMigrationRoleForEmail,
  isDirectorEmail,
  normalizeEmail,
} from '../../shared/permissions';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return pool;
}

const VALID_ROLES = new Set([
  'director',
  'centre_head',
  'bdm',
  'marketing',
  'digital_marketing',
  'faculty',
  'academic_head',
  'accounting',
  'designer',
  'employee',
  'admin',
  'accountant',
  'pending',
]);

function resolveRole(email: string): string {
  const migrated = getMigrationRoleForEmail(email);
  if (migrated && VALID_ROLES.has(migrated)) return migrated;
  if (isDirectorEmail(email)) return 'director';
  return 'pending';
}

function formatConnectionError(error: unknown): string {
  if (error instanceof AggregateError) {
    const refused = error.errors?.some(
      (entry) => entry instanceof Error && entry.message.includes('ECONNREFUSED'),
    );
    if (refused) {
      return 'PostgreSQL is not running (connection refused on DATABASE_URL port)';
    }
    return error.errors?.[0] instanceof Error
      ? error.errors[0].message
      : 'Database connection failed';
  }
  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      return 'PostgreSQL is not running (connection refused on DATABASE_URL port)';
    }
    return error.message;
  }
  return 'Database connection failed';
}

export interface PostgresBootstrapResult {
  success: boolean;
  message?: string;
  centreId?: string;
  userId?: string;
  created?: boolean;
}

/**
 * Ensure default centre + staff user exist in PostgreSQL (CRM primary database).
 */
export async function bootstrapPostgresUser(input: {
  firebaseUid: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<PostgresBootstrapResult> {
  const dbPool = getPool();
  if (!dbPool) {
    return {
      success: false,
      message: 'DATABASE_URL is not configured on the server',
    };
  }

  const firebaseUid = input.firebaseUid.trim();
  const email = normalizeEmail(input.email) || input.email.trim().toLowerCase();
  const firstName = (input.firstName || 'User').trim().slice(0, 80);
  const lastName = (input.lastName || '').trim().slice(0, 80) || null;
  const role = resolveRole(email);
  const approved = role === 'director' || Boolean(getMigrationRoleForEmail(email));

  let client: pg.PoolClient;
  try {
    client = await dbPool.connect();
  } catch (error) {
    console.error('Postgres bootstrap connection failed:', error);
    return {
      success: false,
      message: `${formatConnectionError(error)}. Start Docker Desktop, then run: npm run db:up`,
    };
  }

  try {
    await client.query('BEGIN');

    const centreResult = await client.query<{ id: string }>(
      `INSERT INTO centres (code, name, city, state, is_active)
       VALUES ('PUNE', 'Pune Centre', 'Pune', 'Maharashtra', true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true
       RETURNING id`,
    );
    const centreId = centreResult.rows[0]?.id;
    if (!centreId) {
      throw new Error('Failed to resolve default centre');
    }

    const existingByUid = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1`,
      [firebaseUid],
    );

    if (existingByUid.rows[0]) {
      await client.query(
        `UPDATE users SET
           email = $2,
           first_name = $3,
           last_name = $4,
           role = $5::"UserRole",
           centre_id = COALESCE(centre_id, $6),
           approved = CASE WHEN $7 THEN true ELSE approved END,
           is_active = true,
           updated_at = NOW()
         WHERE firebase_uid = $1`,
        [firebaseUid, email, firstName, lastName, role, centreId, approved],
      );

      await client.query('COMMIT');
      return {
        success: true,
        created: false,
        centreId,
        userId: existingByUid.rows[0].id,
      };
    }

    const existingByEmail = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );

    if (existingByEmail.rows[0]) {
      await client.query(
        `UPDATE users SET
           firebase_uid = $1,
           first_name = $2,
           last_name = $3,
           role = $4::"UserRole",
           centre_id = COALESCE(centre_id, $5),
           approved = CASE WHEN $6 THEN true ELSE approved END,
           is_active = true,
           updated_at = NOW()
         WHERE id = $7`,
        [
          firebaseUid,
          firstName,
          lastName,
          role,
          centreId,
          approved,
          existingByEmail.rows[0].id,
        ],
      );

      await client.query('COMMIT');
      return {
        success: true,
        created: false,
        centreId,
        userId: existingByEmail.rows[0].id,
      };
    }

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO users (
         firebase_uid, email, first_name, last_name, role, centre_id, approved, is_active
       ) VALUES ($1, $2, $3, $4, $5::"UserRole", $6, $7, true)
       RETURNING id`,
      [firebaseUid, email, firstName, lastName, role, centreId, approved],
    );

    await client.query('COMMIT');
    return {
      success: true,
      created: true,
      centreId,
      userId: inserted.rows[0]?.id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Postgres bootstrap failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Postgres bootstrap failed',
    };
  } finally {
    client.release();
  }
}

export async function checkPostgresConnection(): Promise<boolean> {
  const dbPool = getPool();
  if (!dbPool) return false;
  try {
    await dbPool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
