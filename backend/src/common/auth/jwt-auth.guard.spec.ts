import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GatewaySessionService } from './gateway-session.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const gatewaySessionService = {
    resolveAccessToken: jest.fn(),
  };

  const mockContext = (authorization?: string) => {
    const request = { headers: { authorization }, user: undefined as unknown };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as any,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(
      gatewaySessionService as unknown as GatewaySessionService,
    );
  });

  it('allows access and attaches the session resolved by Master Gateway', async () => {
    gatewaySessionService.resolveAccessToken.mockResolvedValue({
      sub: 'user-id',
      jti: 'access-jti',
      sid: 'session-id',
      roleId: 'role-id',
      roleName: 'ADMIN',
    });
    const { context, request } = mockContext('Bearer encrypted-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(gatewaySessionService.resolveAccessToken).toHaveBeenCalledWith(
      'encrypted-token',
    );
    expect(request.user).toMatchObject({
      sub: 'user-id',
      roleId: 'role-id',
      roleName: 'ADMIN',
    });
  });

  it.each([undefined, 'Basic token'])(
    'rejects a missing or malformed Authorization header',
    async (authorization) => {
      const { context } = mockContext(authorization);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('rejects invalid tokens', async () => {
    gatewaySessionService.resolveAccessToken.mockRejectedValue(
      new UnauthorizedException(),
    );
    const { context } = mockContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
