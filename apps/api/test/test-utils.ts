import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/core/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/core/interceptors/logging.interceptor';
import { applyVersionMiddleware } from '../src/core/versioning/middlewares/version.middleware';

export interface TestAppSetup {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestAppSetup> {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-1234567890';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-0987654321';
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
  process.env.PORT = '3001';
  process.env.CORS_ORIGIN = '*';
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.enableShutdownHooks();

  const prisma = app.get(PrismaService);

  app.use(applyVersionMiddleware);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Setup Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Job Tracker API')
    .setDescription('Production-Grade REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();

  return { app, prisma };
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  if (!prisma) return;
  if (prisma.userRole) await prisma.userRole.deleteMany();
  if (prisma.refreshSession) await prisma.refreshSession.deleteMany();
  if (prisma.note) await prisma.note.deleteMany();
  if (prisma.attachment) await prisma.attachment.deleteMany();
  if (prisma.statusHistory) await prisma.statusHistory.deleteMany();
  if (prisma.application) await prisma.application.deleteMany();
  if (prisma.company) await prisma.company.deleteMany();
  if (prisma.auditLog) await prisma.auditLog.deleteMany();
  if (prisma.featureFlag) await prisma.featureFlag.deleteMany();
  if (prisma.user) await prisma.user.deleteMany();

  if (prisma.role) {
    await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Admin role' },
    });
    await prisma.role.upsert({
      where: { name: 'USER' },
      update: {},
      create: { name: 'USER', description: 'User role' },
    });
  }
}
