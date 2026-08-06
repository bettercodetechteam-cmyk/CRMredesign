import { NodeEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  corsOrigins: string[];
  swaggerEnabled: boolean;
}

export interface DatabaseConfig {
  url: string;
}

export interface FirebaseConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  firebase: FirebaseConfig;
}

function toList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Turns flat environment variables into a typed, namespaced config tree so
 * consumers ask for `app.port` or `database.url` instead of reaching into
 * `process.env` from all over the codebase.
 */
export const configuration = (): Configuration => ({
  app: {
    nodeEnv: (process.env.NODE_ENV as NodeEnv | undefined) ?? NodeEnv.Development,
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    corsOrigins: toList(process.env.CORS_ORIGINS),
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  },
  database: {
    url: process.env.DATABASE_URL as string,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
});

export default configuration;
