import { ConfigService } from '@nestjs/config';
import { JwtStrategy, JwtPayload } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    const mockConfig = {
      get: jest.fn().mockReturnValue('test-access-secret'),
      getOrThrow: jest.fn().mockReturnValue('test-access-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(mockConfig);
  });

  describe('validate', () => {
    it('should validate and extract sub and email from JWT payload', async () => {
      const payload: JwtPayload = {
        sub: 'user-uuid-1',
        email: 'test@example.com',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        sub: 'user-uuid-1',
        email: 'test@example.com',
      });
    });
  });
});
