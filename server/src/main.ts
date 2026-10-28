import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { UPLOAD_ROOT, UPLOAD_URL_PREFIX } from './modules/attachments/attachments.controller';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(UPLOAD_ROOT, { prefix: UPLOAD_URL_PREFIX });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://127.0.0.1:${port}/api`);
}

void bootstrap();
