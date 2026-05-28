import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (process.env.TRUST_PROXY) {
    const httpAdapter = app.getHttpAdapter();
    const instance = httpAdapter.getInstance?.();
    if (instance?.set) {
      instance.set('trust proxy', process.env.TRUST_PROXY);
    }
  }

  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : true,
    credentials: true,
  });

  const swaggerEnabled =
    process.env.SWAGGER_ENABLED === 'true' || process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('researchers API')
      .setDescription(
        [
          'Course platform without AI generation.',
          '',
          '**Auth:** `Authorization: Bearer <accessToken>`',
          '',
          '**Paged lists:** `{ data: T[], meta: { total, page, pageSize } }`',
          '',
          '**Error codes** (field `message`):',
          'INVALID_CREDENTIALS, EMAIL_TAKEN, SUBSCRIPTION_REQUIRED,',
          'OWNERSHIP_REQUIRED, LAST_ADMIN_PROTECTED, LESSON_ORDER_CONFLICT,',
          'UPLOAD_LIMIT_EXCEEDED, FORBIDDEN_ROLE',
          '',
          'Full reference: see `docs/API.md` in the repository.',
        ].join('\n'),
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API ready on :${port} (swagger=${swaggerEnabled ? 'on' : 'off'})`,
    'Bootstrap',
  );
}

void bootstrap();
