import type { Request, Response } from 'express';
import { newId } from './ids';

export const BROWSER_COOKIE = 'sba_browser';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The signed browser id from the request cookie, or null. */
export function readBrowserId(req: Request): string | null {
  const v = (req.signedCookies as Record<string, unknown> | undefined)?.[BROWSER_COOKIE];
  return typeof v === 'string' && v.length >= 16 ? v : null;
}

/** Existing browser id, or a fresh one written to the response. */
export function ensureBrowserId(req: Request, res: Response, secure: boolean): string {
  const existing = readBrowserId(req);
  if (existing) return existing;
  const id = newId();
  res.cookie(BROWSER_COOKIE, id, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: ONE_YEAR_MS,
    path: '/',
  });
  return id;
}
