import { randomBytes } from 'node:crypto';
import path from 'node:path';

export interface AppConfig {
  port: number;
  isProd: boolean;
  rootDir: string;
  databaseUrl: string;
  storageDir: string;
  cookieSecret: string;
  /** Projects not opened for this long are deleted. Data is ephemeral by design. */
  retentionHours: number;
  maxUploadBytes: number;
  maxProjectsPerBrowser: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rootDir = process.cwd();
  const isProd = env.NODE_ENV === 'production';
  let cookieSecret = env.COOKIE_SECRET;
  if (!cookieSecret || cookieSecret === 'CHANGE_ME' || cookieSecret === 'change-me') {
    if (isProd) {
      // Project data is ephemeral, so a per-process secret is acceptable: the only effect is
      // that ownership cookies stop matching after a restart, when the projects are gone anyway.
      cookieSecret = randomBytes(32).toString('base64url');
      // eslint-disable-next-line no-console
      console.warn('COOKIE_SECRET is not set; using a random per-process secret.');
    } else {
      cookieSecret = 'dev-only-insecure-secret';
    }
  }
  return {
    port: Number(env.PORT ?? 3000),
    isProd,
    rootDir,
    databaseUrl: path.resolve(rootDir, env.DATABASE_URL ?? './var/sba.sqlite'),
    storageDir: path.resolve(rootDir, env.STORAGE_DIR ?? './var/storage'),
    cookieSecret,
    retentionHours: Number(env.RETENTION_HOURS ?? 24),
    maxUploadBytes: 20 * 1024 * 1024,
    maxProjectsPerBrowser: Number(env.MAX_PROJECTS_PER_BROWSER ?? 50),
  };
}

export const CONFIG = Symbol('APP_CONFIG');
