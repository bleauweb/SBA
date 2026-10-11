import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ViteDevServer } from 'vite';
import { CONFIG, type AppConfig } from '../../config/config';
import type { PageData } from '../../shared/types';

type RenderFn = (url: string, data: PageData) => Promise<{ html: string; head: string }>;

/**
 * Server-side rendering of the React client.
 * Dev: a Vite dev server in middleware mode compiles the entry on demand (with HMR).
 * Prod: the prebuilt `dist/ssr/entry-server.mjs` and `dist/client/index.html` are used.
 */
@Injectable()
export class SsrService implements OnModuleDestroy {
  private readonly log = new Logger(SsrService.name);
  private vite: ViteDevServer | null = null;
  private prodTemplate: string | null = null;
  private prodRender: RenderFn | null = null;

  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  /** Called from main.ts before routes are registered so Vite's middleware runs first. */
  async setup() {
    if (this.cfg.isProd) {
      this.prodTemplate = await fs.readFile(path.join(this.cfg.rootDir, 'dist/client/index.html'), 'utf8');
      const mod = (await import(pathToFileURL(path.join(this.cfg.rootDir, 'dist/ssr/entry-server.mjs')).href)) as { render: RenderFn };
      this.prodRender = mod.render;
    } else {
      const { createServer } = await import('vite');
      this.vite = await createServer({
        root: this.cfg.rootDir,
        server: { middlewareMode: true },
        appType: 'custom',
      });
      this.log.log('Vite dev server attached');
    }
  }

  async onModuleDestroy() {
    await this.vite?.close();
  }

  /** Express middleware for Vite's dev assets (dev only). */
  get middlewares() {
    return this.vite?.middlewares ?? null;
  }

  async renderPage(url: string, data: PageData): Promise<string> {
    let template: string;
    let render: RenderFn;
    if (this.vite) {
      template = await fs.readFile(path.join(this.cfg.rootDir, 'index.html'), 'utf8');
      template = await this.vite.transformIndexHtml(url, template);
      render = ((await this.vite.ssrLoadModule('/src/client/entry-server.tsx')) as { render: RenderFn }).render;
    } else {
      template = this.prodTemplate!;
      render = this.prodRender!;
    }
    try {
      const { html, head } = await render(url, data);
      const json = JSON.stringify(data).replace(/</g, '\\u003c');
      return template
        .replace('<!--app-head-->', head)
        .replace('<!--app-html-->', html)
        .replace('<!--app-data-->', `<script>window.__DATA__=${json}</script>`);
    } catch (err) {
      this.vite?.ssrFixStacktrace(err as Error);
      throw err;
    }
  }
}
