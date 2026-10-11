import { Inject, Injectable } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CONFIG, type AppConfig } from '../../config/config';

/**
 * Local-disk blob storage. Keys are slash-separated paths; the first segment is a
 * namespace (`projects/<id>/…`, `guides/…`) so a whole project can be removed at once.
 */
@Injectable()
export class ImageStorage {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  private resolve(key: string): string {
    if (key.includes('..') || path.isAbsolute(key)) throw new Error(`invalid storage key: ${key}`);
    return path.join(this.cfg.storageDir, key);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async removePrefix(prefix: string): Promise<void> {
    await fs.rm(this.resolve(prefix), { recursive: true, force: true });
  }
}
