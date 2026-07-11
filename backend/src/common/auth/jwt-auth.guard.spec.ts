import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  const mockContext = (authorization?: string) => {
    const request = { headers: { authorization } };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() } as any;
    guard = new JwtAuthGuard(jwtService);
  });

  it('allows access with valid Bearer token', async () => {
    const context = mockContext('Bearer valid-token');
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-id', roleId: 'role-id' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when no Authorization header', async () => {
    const context = mockContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when header does not start with Bearer', async () => {
    const context = mockContext('Basic token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when token is invalid or expired', async () => {
    const context = mockContext('Bearer bad-token');
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('Token expired'));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets user on request when token is valid', async () => {
    const request = { headers: { authorization: 'Bearer valid-token' } } as { headers: { authorization: string }; user?: unknown };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
    const payload = { sub: 'user-id', roleId: 'role-id', roleName: 'ADMIN' };
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue(payload);

    await guard.canActivate(context);

    expect(request.user).toEqual(payload);
  });
});
