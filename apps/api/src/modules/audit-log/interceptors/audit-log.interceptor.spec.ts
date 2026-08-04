import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from '../services/audit-log.service';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let mockAuditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    mockAuditLogService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogInterceptor,
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should ignore GET requests and pass through', (done) => {
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/companies' }),
      }),
    };
    const mockCallHandler: any = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (res) => {
        expect(res).toEqual({ success: true });
        expect(mockAuditLogService.recordEvent).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should intercept POST mutation requests and record audit log', (done) => {
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          originalUrl: '/api/v1/companies',
          user: { id: 'u-123' },
          headers: { 'x-request-id': 'req-999', 'user-agent': 'Jest' },
          ip: '127.0.0.1',
          body: { name: 'Acme Corp', password: 'secretpassword' },
          params: {},
        }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    };
    const mockCallHandler: any = {
      handle: () => of({ success: true, data: { id: 'company-555' } }),
    };

    interceptor.intercept(mockContext, mockCallHandler).subscribe({
      next: (res) => {
        expect(res).toEqual({ success: true, data: { id: 'company-555' } });
        expect(mockAuditLogService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'u-123',
            action: 'CREATE_COMPANY',
            resource: 'COMPANY',
            resourceId: 'company-555',
            method: 'POST',
            endpoint: '/api/v1/companies',
            metadata: expect.objectContaining({
              body: expect.objectContaining({
                name: 'Acme Corp',
                password: '[REDACTED]',
              }),
            }),
          }),
        );
        done();
      },
    });
  });
});
