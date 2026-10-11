import { randomBytes } from 'node:crypto';

/** 128 bits of randomness, URL-safe. Unguessable, so a project URL doubles as its share link. */
export function newId(): string {
  return randomBytes(16).toString('base64url');
}

export function nowIso(): string {
  return new Date().toISOString();
}
