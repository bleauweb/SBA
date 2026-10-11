import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'node:path';
import { AppModule } from './app.module';
import { CONFIG, type AppConfig } from './config/config';
import { SsrService } from './modules/render/ssr.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  const cfg = app.get<AppConfig>(CONFIG);
  app.set('trust proxy', 1);
  app.use(cookieParser(cfg.cookieSecret));

  // Vite (dev) or static assets (prod) must be registered before Nest wires the routes,
  // otherwise the catch-all page route would swallow asset requests.
  const ssr = app.get(SsrService);
  await ssr.setup();
  if (ssr.middlewares) {
    app.use(ssr.middlewares);
  } else {
    app.use('/assets', express.static(path.join(cfg.rootDir, 'dist/client/assets'), { immutable: true, maxAge: '1y' }));
  }

  await app.listen(cfg.port);
  new Logger('bootstrap').log(`SBA listening on http://localhost:${cfg.port} (${cfg.isProd ? 'production' : 'development'})`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
