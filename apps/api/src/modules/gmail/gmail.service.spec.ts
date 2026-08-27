import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisher } from '../websocket/services/realtime-publisher.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { TelegramService } from '../telegram/telegram.service';
import {
  GmailService,
  cleanCompanyName,
  getCompanyAliases,
  scoreApplicationMatch,
  findBestMatchingApplication,
} from './gmail.service';

describe('GmailService - Application Matching and Auto Status Update', () => {
  let service: GmailService;
  let prisma: any;
  let realtime: any;

  const mockPrisma = {
    application: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    statusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    emailMessage: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    gmailToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  };

  const mockRealtime = {
    emitToRoom: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, defaultValue?: string) => defaultValue || ''),
  };

  const mockWhatsapp = {
    notifyEmailNotification: jest.fn().mockResolvedValue({}),
  };

  const mockTelegram = {
    notifyEmailNotification: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RealtimePublisher, useValue: mockRealtime },
        { provide: ConfigService, useValue: mockConfig },
        { provide: WhatsappService, useValue: mockWhatsapp },
        { provide: TelegramService, useValue: mockTelegram },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
    prisma = module.get<PrismaService>(PrismaService);
    realtime = module.get<RealtimePublisher>(RealtimePublisher);
  });

  describe('Company Cleaning and Alias Helpers', () => {
    it('should clean PT, TBK, Group, and punctuation from company names', () => {
      expect(cleanCompanyName('PT Orang Tua Group')).toBe('orang tua');
      expect(cleanCompanyName('PT. Djarum Indonesia')).toBe('djarum');
      expect(cleanCompanyName('PT Bank Central Asia Tbk.')).toBe('bank central asia');
    });

    it('should generate known aliases and acronyms for Orang Tua Group', () => {
      const aliases = getCompanyAliases('PT Orang Tua Group');
      expect(aliases).toContain('orang tua');
      expect(aliases).toContain('ot');
      expect(aliases).toContain('ot group');
      expect(aliases).toContain('ultra prima abadi');
    });

    it('should generate known aliases for PT Djarum', () => {
      const aliases = getCompanyAliases('PT Djarum');
      expect(aliases).toContain('djarum');
      expect(aliases).toContain('pt djarum');
      expect(aliases).toContain('djarum group');
    });
  });

  describe('scoreApplicationMatch & findBestMatchingApplication', () => {
    const apps = [
      {
        id: 'app-djarum',
        jobTitle: 'Software Engineer',
        company: { name: 'PT Djarum' },
        status: 'APPLIED',
      },
      {
        id: 'app-ot',
        jobTitle: 'Software Engineer',
        company: { name: 'Orang Tua Group' },
        status: 'APPLIED',
      },
    ];

    it('should match Orang Tua Group and NOT PT Djarum when rejection email is from OT Group', () => {
      const email = {
        subject: 'Hasil Seleksi Rekrutmen - Software Engineer',
        fromEmail: 'recruitment@ot.id',
        fromName: 'Talent Acquisition OT Group',
        snippet: 'Terima kasih atas ketertarikan Anda melamar di Orang Tua Group...',
        bodyText: 'Mohon maaf, saat ini kami belum dapat melanjutkan proses lamaran Anda.',
      };

      const djarumScore = scoreApplicationMatch(apps[0], email);
      const otScore = scoreApplicationMatch(apps[1], email);

      expect(djarumScore.companyScore).toBe(0);
      expect(otScore.companyScore).toBeGreaterThanOrEqual(80); // domain + fromName + snippet match

      const matched = findBestMatchingApplication(apps, email, true);
      expect(matched).toBeDefined();
      expect(matched?.id).toBe('app-ot');
      expect(matched?.company?.name).toBe('Orang Tua Group');
    });

    it('should match Orang Tua Group when email comes via Talentics ATS', () => {
      const email = {
        subject: '[Talentics] Update Lamaran Anda di PT Orang Tua Group',
        fromEmail: 'no-reply@talentics.id',
        fromName: 'Recruitment OT Group via Talentics',
        snippet: 'Status lamaran Anda untuk posisi Software Engineer telah diperbarui.',
        bodyText: 'Terima kasih telah melamar di Orang Tua Group. Sayangnya...',
      };

      const matched = findBestMatchingApplication(apps, email, true);
      expect(matched?.id).toBe('app-ot');
    });

    it('should NOT match any application if company name does not match despite matching generic job title', () => {
      const email = {
        subject: 'Job Recommendation for Software Engineer',
        fromEmail: 'newsletter@somedomain.com',
        fromName: 'Job Newsletter',
        snippet: 'Here are software engineer positions for you.',
        bodyText: 'Software Engineer roles available.',
      };

      const matched = findBestMatchingApplication(apps, email, true);
      expect(matched).toBeNull();
    });

    it('should differentiate between multiple applications of the same company by job title', () => {
      const otApps = [
        {
          id: 'app-ot-fe',
          jobTitle: 'Frontend Engineer',
          company: { name: 'Orang Tua Group' },
          status: 'APPLIED',
        },
        {
          id: 'app-ot-be',
          jobTitle: 'Backend Engineer',
          company: { name: 'Orang Tua Group' },
          status: 'APPLIED',
        },
      ];

      const email = {
        subject: 'Update Lamaran Backend Engineer di OT Group',
        fromEmail: 'recruitment@ot.id',
        fromName: 'OT Group Recruitment',
        snippet: 'Mengenai lamaran Backend Engineer Anda...',
        bodyText: 'Terima kasih telah melamar posisi Backend Engineer di Orang Tua Group.',
      };

      const matched = findBestMatchingApplication(otApps, email, true);
      expect(matched?.id).toBe('app-ot-be');
    });
  });

  describe('autoUpdateApplicationStatus execution', () => {
    it('should auto-update ONLY the Orang Tua Group application to REJECTED and record StatusHistory', async () => {
      const userApps = [
        {
          id: 'app-djarum',
          jobTitle: 'Software Engineer',
          company: { name: 'PT Djarum' },
          status: 'APPLIED',
          userId: 'user-1',
        },
        {
          id: 'app-ot',
          jobTitle: 'Software Engineer',
          company: { name: 'Orang Tua Group' },
          status: 'APPLIED',
          userId: 'user-1',
        },
      ];

      mockPrisma.application.findMany.mockResolvedValue(userApps);
      mockPrisma.application.update.mockResolvedValue({
        ...userApps[1],
        status: 'REJECTED',
        rejectedAtStage: 'APPLIED',
      });

      // Call private method autoUpdateApplicationStatus
      await (service as any).autoUpdateApplicationStatus(
        'user-1',
        'REJECTED',
        'Update Proses Rekrutmen Software Engineer',
        'recruitment@ot.id',
        'HRD Orang Tua Group',
        'Mohon maaf profil Anda belum sesuai dengan posisi Software Engineer di Orang Tua Group...',
        'Belum dapat melanjutkan proses rekrutmen.',
      );

      // Verify Prisma update was called ONCE on app-ot and NOT app-djarum
      expect(mockPrisma.application.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-ot' },
        data: {
          status: 'REJECTED',
          rejectedAtStage: 'APPLIED',
        },
      });

      // Verify StatusHistory was created
      expect(mockPrisma.statusHistory.create).toHaveBeenCalledWith({
        data: {
          applicationId: 'app-ot',
          userId: 'user-1',
          fromStatus: 'APPLIED',
          toStatus: 'REJECTED',
        },
      });

      // Verify WebSocket broadcast
      expect(mockRealtime.emitToRoom).toHaveBeenCalledWith(
        'user:user-1',
        'application:updated',
        expect.anything(),
      );
    });
  });
});
