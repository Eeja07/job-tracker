import { PrismaClient, ApplicationStatus, WorkMode, ApplicationSource, AttachmentType, StorageProvider, Currency } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data
  await prisma.attachment.deleteMany();
  await prisma.note.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.company.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await argon2.hash('password123');

  // 1. Create Seed Users
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@jobtracker.dev',
      passwordHash: defaultPasswordHash,
      fullName: 'Mahija Dev',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mahija',
      isEmailVerified: true,
      lastLoginAt: new Date(),
    },
  });

  console.log(`👤 Created User: ${demoUser.fullName} (${demoUser.email})`);

  // 2. Create Global Companies
  const tokopedia = await prisma.company.create({
    data: {
      name: 'Tokopedia',
      industry: 'E-commerce & Technology',
      website: 'https://www.tokopedia.com',
      careerPage: 'https://www.tokopedia.com/careers',
      location: 'Jakarta, Indonesia',
      description: 'Leading e-commerce technology company in Indonesia.',
    },
  });

  const traveloka = await prisma.company.create({
    data: {
      name: 'Traveloka',
      industry: 'Travel & Financial Services',
      website: 'https://www.traveloka.com',
      careerPage: 'https://www.traveloka.com/en-id/careers',
      location: 'Jakarta, Indonesia',
      description: 'Southeast Asia tech unicorn offering travel and financial products.',
    },
  });

  const grab = await prisma.company.create({
    data: {
      name: 'Grab',
      industry: 'Superapp & Transport',
      website: 'https://www.grab.com',
      careerPage: 'https://grab.careers',
      location: 'Singapore / Jakarta',
      description: 'Everyday superapp providing transportation, delivery, and financial services.',
    },
  });

  console.log(`🏢 Created 3 Companies: ${tokopedia.name}, ${traveloka.name}, ${grab.name}`);

  // 3. Create Applications with StatusHistory, Notes & Attachments
  // Application 1: Backend Engineer at Tokopedia (Interviewing)
  const app1 = await prisma.application.create({
    data: {
      userId: demoUser.id,
      companyId: tokopedia.id,
      jobTitle: 'Senior Backend Engineer (NestJS / Go)',
      applicationCode: 'TOK-2026-BE',
      status: ApplicationStatus.INTERVIEWING,
      workMode: WorkMode.HYBRID,
      source: ApplicationSource.LINKEDIN,
      salaryMin: 25000000,
      salaryMax: 35000000,
      currency: Currency.IDR,
      sourceUrl: 'https://www.linkedin.com/jobs/view/123456789',
      location: 'Jakarta South',
      deadline: new Date('2026-08-30T23:59:59Z'),
      appliedAt: new Date('2026-08-01T09:00:00Z'),
      lastStatusChangedAt: new Date('2026-08-03T14:30:00Z'),
    },
  });

  // StatusHistories for App 1 (Atomic timeline simulation)
  await prisma.statusHistory.createMany({
    data: [
      {
        applicationId: app1.id,
        userId: demoUser.id,
        fromStatus: null,
        toStatus: ApplicationStatus.SAVED,
        createdAt: new Date('2026-07-31T10:00:00Z'),
      },
      {
        applicationId: app1.id,
        userId: demoUser.id,
        fromStatus: ApplicationStatus.SAVED,
        toStatus: ApplicationStatus.APPLIED,
        createdAt: new Date('2026-08-01T09:00:00Z'),
      },
      {
        applicationId: app1.id,
        userId: demoUser.id,
        fromStatus: ApplicationStatus.APPLIED,
        toStatus: ApplicationStatus.SCREENING,
        createdAt: new Date('2026-08-02T11:15:00Z'),
      },
      {
        applicationId: app1.id,
        userId: demoUser.id,
        fromStatus: ApplicationStatus.SCREENING,
        toStatus: ApplicationStatus.INTERVIEWING,
        createdAt: new Date('2026-08-03T14:30:00Z'),
      },
    ],
  });

  // Notes for App 1
  await prisma.note.create({
    data: {
      applicationId: app1.id,
      userId: demoUser.id,
      content: 'User Interview round scheduled for Friday 3 PM. Prepare PostgreSQL index optimization topics and System Design diagrams.',
      pinned: true,
    },
  });

  // Attachment for App 1
  await prisma.attachment.create({
    data: {
      applicationId: app1.id,
      userId: demoUser.id,
      type: AttachmentType.CV,
      label: 'CV Backend Engineer 2026 v3',
      filename: 'CV_Mahija_Backend_2026.pdf',
      mimeType: 'application/pdf',
      fileSize: 450120,
      storageProvider: StorageProvider.LOCAL,
      storagePath: '/uploads/cv_mahija_backend_2026.pdf',
      version: 'v3.0',
    },
  });

  // Application 2: DevOps / Infrastructure Engineer at Grab (Applied)
  const app2 = await prisma.application.create({
    data: {
      userId: demoUser.id,
      companyId: grab.id,
      jobTitle: 'DevOps / Site Reliability Engineer',
      applicationCode: 'GRB-2026-SRE',
      status: ApplicationStatus.APPLIED,
      workMode: WorkMode.REMOTE,
      source: ApplicationSource.GLINTS,
      salaryMin: 30000000,
      salaryMax: 45000000,
      currency: Currency.IDR,
      sourceUrl: 'https://glints.com/jobs/sre-grab-123',
      location: 'Remote / Jakarta',
      appliedAt: new Date('2026-08-04T10:00:00Z'),
      lastStatusChangedAt: new Date('2026-08-04T10:00:00Z'),
    },
  });

  await prisma.statusHistory.createMany({
    data: [
      {
        applicationId: app2.id,
        userId: demoUser.id,
        fromStatus: null,
        toStatus: ApplicationStatus.APPLIED,
        createdAt: new Date('2026-08-04T10:00:00Z'),
      },
    ],
  });

  console.log('🚀 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
