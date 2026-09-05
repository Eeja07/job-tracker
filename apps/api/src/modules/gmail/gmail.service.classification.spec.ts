import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisher } from '../websocket/services/realtime-publisher.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TelegramService } from '../telegram/telegram.service';
import { GmailService } from './gmail.service';

describe('GmailService - Surgical Classification Tests', () => {
  let service: GmailService;
  let prisma: any;

  const mockPrisma = {
    application: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    emailMessage: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    gmailToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimePublisher, useValue: { emitToRoom: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
        { provide: WhatsappService, useValue: { notifyEmailNotification: jest.fn() } },
        { provide: TelegramService, useValue: { notifyEmailNotification: jest.fn() } },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('Case 1: ATI Talent Assessment account confirmation should NOT be SCREENING and NOT Balasan HR', async () => {
    mockPrisma.emailMessage.findMany.mockResolvedValue([
      {
        id: 'msg-ati-1',
        userId: 'user-1',
        fromName: 'Admin<User (via ATI Talent Assessment)',
        fromEmail: 'apps@atibusinessgroup.com',
        subject: 'ATI Talent Assessment: account confirmation',
        snippet:
          'Hi, A new account has been requested at \'ATI Talent Assessment\' using your email address. To confirm your new account, please go to this web address: https://assessment.atibusinessgroup.com/',
        bodyText:
          'Hi, A new account has been requested at \'ATI Talent Assessment\' using your email address. To confirm your new account, please go to this web address: https://assessment.atibusinessgroup.com/',
        receivedAt: new Date('2026-09-04T20:43:00Z'),
        isJobRelated: true,
        detectedType: 'SCREENING', // previously misclassified in DB
      },
    ]);

    const result = await service.getEmailMessages('user-1', false);
    expect(result).toHaveLength(1);
    expect(result[0].detectedType).toBeNull();
    expect(result[0].isHrReply).toBe(false);
  });

  it('Case 2: HiringBranch Self-Registration Confirmation should NOT be SCREENING and NOT Balasan HR', async () => {
    mockPrisma.emailMessage.findMany.mockResolvedValue([
      {
        id: 'msg-hb-1',
        userId: 'user-1',
        fromName: 'monica@hiringbranch.com',
        fromEmail: 'monica@hiringbranch.com',
        subject: 'HiringBranch Self-Registration Confirmation',
        snippet: 'HiringBranch Hi There, You have now been registered to use the HiringBranch',
        bodyText: 'HiringBranch Hi There, You have now been registered to use the HiringBranch',
        receivedAt: new Date('2026-09-04T20:14:00Z'),
        isJobRelated: true,
        detectedType: 'SCREENING', // previously misclassified in DB
      },
    ]);

    const result = await service.getEmailMessages('user-1', false);
    expect(result).toHaveLength(1);
    expect(result[0].detectedType).toBeNull();
    expect(result[0].isHrReply).toBe(false);
  });

  it('Case 3: EY Complete and Submit Your Job Application should NOT be Balasan HR (it is an incomplete application reminder)', async () => {
    mockPrisma.emailMessage.findMany.mockResolvedValue([
      {
        id: 'msg-ey-1',
        userId: 'user-1',
        fromName: 'EY<Talent Acquisition',
        fromEmail: 'TalentAttractionandAcquisition@ey.com',
        subject: 'Complete and Submit Your Job Application',
        snippet:
          'Dear Mahija Ibad, It looks like you started an application, but didn\'t submit it. We\'d love to hear more about what makes you extraordinary. Please click on the link CBS - IT Support Associates',
        bodyText:
          'Dear Mahija Ibad, It looks like you started an application, but didn\'t submit it. We\'d love to hear more about what makes you extraordinary. Please click on the link CBS - IT Support Associates',
        receivedAt: new Date('2026-09-03T05:09:00Z'),
        isJobRelated: true,
        detectedType: null,
      },
    ]);

    const result = await service.getEmailMessages('user-1', false);
    expect(result).toHaveLength(1);
    expect(result[0].isHrReply).toBe(false);
    expect(result[0].detectedType).toBeNull();
  });

  it('Case 4: Glassdoor Community post mentioning job offer should NOT be OFFER and NOT Balasan HR', async () => {
    mockPrisma.emailMessage.findMany.mockResolvedValue([
      {
        id: 'msg-gd-1',
        userId: 'user-1',
        fromName: 'Glassdoor<Community',
        fromEmail: 'noreply@glassdoor.com',
        subject: 'I did it. I\'m switching careers. I accepted the job offer. Now? Now I\'m...',
        snippet: 'Get the latest Tech trending posts 🛎️',
        bodyText: 'Get the latest Tech trending posts 🛎️',
        receivedAt: new Date('2026-08-30T06:15:00Z'),
        isJobRelated: true,
        detectedType: 'OFFER', // previously misclassified in DB
      },
    ]);

    const result = await service.getEmailMessages('user-1', false);
    expect(result).toHaveLength(1);
    expect(result[0].detectedType).toBeNull();
    expect(result[0].isHrReply).toBe(false);
  });

  it('Genuine HR Interview invitation should correctly be detected as INTERVIEW and Balasan HR', async () => {
    mockPrisma.application.findMany.mockResolvedValue([
      {
        id: 'app-abc',
        jobTitle: 'Frontend Engineer',
        company: { name: 'PT Solusi Teknologi' },
        status: 'APPLIED',
      },
    ]);

    mockPrisma.emailMessage.findMany.mockResolvedValue([
      {
        id: 'msg-hr-1',
        userId: 'user-1',
        fromName: 'HR Recruiter PT Solusi Teknologi',
        fromEmail: 'recruitment@solusiteknologi.co.id',
        subject: 'Undangan Interview - Frontend Engineer di PT Solusi Teknologi',
        snippet: 'Selamat, kami mengundang Anda untuk sesi wawancara via Google Meet...',
        bodyText: 'Jadwal wawancara pada hari Senin.',
        receivedAt: new Date('2026-09-05T10:00:00Z'),
        isJobRelated: true,
        detectedType: 'INTERVIEW',
      },
    ]);

    const result = await service.getEmailMessages('user-1', false);
    expect(result).toHaveLength(1);
    expect(result[0].detectedType).toBe('INTERVIEW');
    expect(result[0].isHrReply).toBe(true);
    expect(result[0].matchedApp).toBeDefined();
    expect(result[0].matchedApp?.companyName).toBe('PT Solusi Teknologi');
  });
});
