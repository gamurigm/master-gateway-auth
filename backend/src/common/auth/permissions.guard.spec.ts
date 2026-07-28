import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  const mockContext = (user?: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  const withRequired = (required: string[] | undefined) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows endpoints that declare no permissions', () => {
    withRequired(undefined);
    expect(guard.canActivate(mockContext({ roleName: 'USER' }))).toBe(true);
  });

  it('allows when the role holds every required permission', () => {
    withRequired(['users:read']);
    const user = { roleName: 'ADMIN', permissions: ['users:read'] };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies when a required permission is missing', () => {
    withRequired(['users:delete']);
    const user = { roleName: 'ADMIN', permissions: ['users:read'] };
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('denies a role whose token carries no permissions at all', () => {
    // Menor privilegio (§6.2): tener el nombre de rol correcto ya no basta.
    withRequired(['users:read']);
    const user = { roleName: 'ADMIN', permissions: [] };
    expect(() => guard.canActivate(mockContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('lets SUPER_ADMIN through', () => {
    withRequired(['permissions:delete']);
    const user = { roleName: 'SUPER_ADMIN', permissions: [] };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies when there is no authenticated user (fail-closed)', () => {
    withRequired(['users:read']);
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
