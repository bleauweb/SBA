import path from 'node:path';

export interface AppConfig {
  port: number;
  isProd: boolean;
  rootDir: string;
  databaseUrl: string;
  storageDir: string;
  cookieSecret: string;
  retentionDays: number;
  maxUploadBytes: number;
  maxProjectsPerBrowser: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rootDir = process.cwd();
  const isProd = env.NODE_ENV === 'production';
  const cookieSecret = env.COOKIE_SECRET ?? 'dev-only-insecure-secret';
  if (isProd && cookieSecret === 'dev-only-insecure-secret') {
    // eslint-disable-next-line no-console
    console.warn('COOKIE_SECRET is not set; browser cookies can be forged. Set it in production.');
  }
  return {
    port: Number(env.PORT ?? 3000),
    isProd,
    rootDir,
    databaseUrl: path.resolve(rootDir, env.DATABASE_URL ?? './var/sba.sqlite'),
    storageDir: path.resolve(rootDir, env.STORAGE_DIR ?? './var/storage'),
    cookieSecret,
    retentionDays: Number(env.RETENTION_DAYS ?? 60),
    maxUploadBytes: 20 * 1024 * 1024,
    maxProjectsPerBrowser: Number(env.MAX_PROJECTS_PER_BROWSER ?? 50),
  };
}

export const CONFIG = Symbol('APP_CONFIG');
