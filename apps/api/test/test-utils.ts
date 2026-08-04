import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../src/core/filters/http-exception.filter';
import { LoggingInterceptor } from '../src/core/interceptors/logging.interceptor';

export interface TestAppSetup {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestAppSetup> {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-1234567890';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-0987654321';
  process.env.PORT = '3001';
  process.env.CORS_ORIGIN = '*';
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.enableShutdownHooks();

  const prisma = app.get(PrismaService);

  app.setGlobalPrefix('api/v1');
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
  await prisma.refreshSession.deleteMany();
  await prisma.note.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();
}
