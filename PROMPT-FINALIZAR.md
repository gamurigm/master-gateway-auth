# Prompt: Finalizar Implementación de Seguridad — Master Gateway

## Contexto del Proyecto

- **Stack:** NestJS (backend) + Node.js (servicio ventas) + Angular (frontend) + Docker Compose + Render (PaaS)
- **Repo:** `deploy/frontend-test` (branch remota en GitHub)
- **Auth:** RSA256 con `@nestjs/jwt` (asymmetric signing)
- **Git-crypt:** Inicializado, clave exportada a `/home/gamuri/git-crypt-key-backup` en WSL

## Estado Actual (Real)

### ✅ Completado
- git-crypt inicializado en el repo, `.gitattributes` creado, `.env` sacado de `.gitignore`
- Commit `3faca0c` pusheado a `origin/deploy/frontend-test`
- `docker-compose.yml` y `render.yaml` ya editados con `JWE_SECRET`

### ❌ No Implementado (lo que hay que hacer)
1. **JWE con `jose`** — archivos sin cambios, `jose` no está en `package.json`
2. **Render secrets via CLI** — `render login` no ejecutado, secrets no creados
3. **Rotación de credenciales** — las passwords expuestas en commits anteriores siguen siendo las mismas
4. **Guardar clave git-crypt** — está solo en WSL, no en gestor de contraseñas

### ⚠️ Problema Conocido
- git-crypt filter apunta a `/home/gamuri/.local/bin/git-crypt` (WSL).
- `git status`/`git add`/`git commit` desde Windows PowerShell falla.
- Solución: usar `wsl -e bash -c "cd /mnt/c/Users/gamur/Documents/... && git <cmd>"` desde PowerShell, o trabajar directamente en WSL.

---

## Tareas Detalladas

### 1. Implementar JWE en Backend

#### 1a. Instalar dependencia

```bash
cd backend
npm install jose
```

#### 1b. Actualizar `backend/src/common/auth/authenticated-user.ts`

```typescript
export interface AuthenticatedUser {
  sub: string;
  jti: string;
  roleId: string;
  roleName: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}
```

#### 1c. Reescribir `backend/src/common/auth/jwt-auth.guard.ts`

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { jwtDecrypt } from 'jose';
import { RequestWithUser } from './request-with-user';
import { AuthenticatedUser } from './authenticated-user';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token requerido');
    }

    const token = header.slice('Bearer '.length);

    try {
      const jweSecret = this.configService.get<string>('JWE_SECRET');
      if (!jweSecret) {
        throw new Error('JWE_SECRET no configurado');
      }

      const secret = new TextEncoder().encode(jweSecret);
      const { payload } = await jwtDecrypt(token, secret);

      request.user = payload as unknown as AuthenticatedUser;
      return true;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }
}
```

#### 1d. Actualizar `backend/src/auth/auth.service.ts`

**Cambios:**
- Importar `EncryptJWT` de `jose` y `ConfigService` de `@nestjs/config`
- Inyectar `ConfigService` en el constructor
- En `issueSessionTokens`, usar `EncryptJWT` para encriptar el accessToken
- El refreshToken puede seguir firmado con RSA (se guarda hasheado en DB, nunca viaja al frontend de forma visible)

```typescript
import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { EncryptJWT } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { omitPassword } from '../common/utils/omit-password';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';

type TempTokenPayload = {
  sub: string;
  jti: string;
  email: string;
};

type GatewayTokenPayload = {
  sub: string;
  jti: string;
  roleId: string;
  roleName?: string;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenJti: string;
  tokenType: string;
  expiresIn: string;
  role: { id: string; name: string };
};

type DecodedJwt = {
  exp?: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, estado: Estado.ACTIVO },
      include: {
        roles: {
          where: { estado: Estado.ACTIVO, role: { estado: Estado.ACTIVO } },
          include: { role: true },
        },
      },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.failed',
          emailHash: this.hashIdentifier(dto.email),
        }),
      );
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const roles = user.roles.map((assignment) => ({
      id: assignment.role.id,
      name: assignment.role.name,
      description: assignment.role.description,
    }));

    const tempToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti: randomUUID(),
        email: user.email,
      } satisfies TempTokenPayload,
      { expiresIn: '5m' },
    );

    this.logger.log(
      JSON.stringify({
        event: 'auth.login.success',
        userId: user.id,
        roles: roles.length,
      }),
    );

    return {
      tempToken,
      user: omitPassword(user),
      roles,
    };
  }

  async selectRole(dto: SelectRoleDto): Promise<SessionTokens> {
    const payload = await this.verifyTempToken(dto.tempToken);
    const assignment = await this.prisma.userRole.findFirst({
      where: {
        userId: payload.sub,
        roleId: dto.roleId,
        estado: Estado.ACTIVO,
        user: { estado: Estado.ACTIVO },
        role: { estado: Estado.ACTIVO },
      },
      include: { role: true },
    });

    if (!assignment) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.role_select.denied',
          userId: payload.sub,
          roleId: dto.roleId,
        }),
      );
      throw new ForbiddenException('El rol no pertenece al usuario');
    }

    const session = await this.issueSessionTokens(
      payload.sub,
      assignment.role.id,
      assignment.role.name,
    );
    this.logger.log(
      JSON.stringify({
        event: 'auth.role_select.success',
        userId: payload.sub,
        roleId: assignment.role.id,
        roleName: assignment.role.name,
      }),
    );

    return session;
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
      include: { role: true },
    });

    if (!storedToken || storedToken.estado !== Estado.ACTIVO) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'not_found_or_inactive',
          userId: payload.sub,
          roleId: payload.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token invalido');
    }

    if (storedToken.revokedAt || storedToken.replacedByJti) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: storedToken.userId,
          roleId: storedToken.roleId,
          estado: Estado.ACTIVO,
        },
        data: {
          revokedAt: new Date(),
          reuseDetected: true,
          estado: Estado.INACTIVO,
        },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.reuse_detected',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token reutilizado');
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date(), estado: Estado.INACTIVO },
      });
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'expired',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token expirado');
    }

    if (!(await argon2.verify(storedToken.tokenHash, refreshToken))) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.refresh.denied',
          reason: 'hash_mismatch',
          userId: storedToken.userId,
          roleId: storedToken.roleId,
        }),
      );
      throw new UnauthorizedException('Refresh token invalido');
    }

    const next = await this.issueSessionTokens(
      storedToken.userId,
      storedToken.roleId,
      storedToken.role.name,
    );

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByJti: next.refreshTokenJti,
        estado: Estado.INACTIVO,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'auth.refresh.success',
        userId: storedToken.userId,
        roleId: storedToken.roleId,
      }),
    );

    return next;
  }

  async logout(userId: string, refreshToken: string) {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, jti: payload.jti, estado: Estado.ACTIVO },
        data: { revokedAt: new Date(), estado: Estado.INACTIVO },
      });
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.logout.token_invalid',
          userId,
        }),
      );
      return { success: true };
    }

    this.logger.log(
      JSON.stringify({
        event: 'auth.logout.success',
        userId,
      }),
    );

    return { success: true };
  }

  async validateInternal(
    apiKey: string | undefined,
    token: string,
    serviceName: string | undefined,
  ) {
    const expectedKey = process.env['INTERNAL_API_KEY'];
    if (expectedKey && apiKey !== expectedKey) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.denied',
          reason: 'bad_api_key',
          serviceName,
        }),
      );
      throw new UnauthorizedException('API key interna invalida');
    }

    if (!this.isAllowedInternalService(serviceName)) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.denied',
          reason: 'service_not_allowed',
          serviceName,
        }),
      );
      throw new UnauthorizedException('Servicio interno no autorizado');
    }

    try {
      const payload = await this.jwtService.verifyAsync<GatewayTokenPayload>(
        token,
      );

      return {
        valid: true,
        userId: payload.sub,
        roleId: payload.roleId,
        roleName: payload.roleName,
      };
    } catch {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.internal_validate.invalid_token',
          serviceName,
        }),
      );
      return { valid: false };
    }
  }

  private async verifyTempToken(tempToken: string) {
    try {
      return await this.jwtService.verifyAsync<TempTokenPayload>(tempToken);
    } catch {
      throw new UnauthorizedException('TempToken invalido o expirado');
    }
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<GatewayTokenPayload>(
        refreshToken,
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }
  }

  private async issueSessionTokens(
    userId: string,
    roleId: string,
    roleName: string,
  ): Promise<SessionTokens> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const jweSecret = this.configService.get<string>('JWE_SECRET');
    if (!jweSecret) {
      throw new Error('JWE_SECRET no configurado');
    }

    const secret = new TextEncoder().encode(jweSecret);

    const accessToken = await new EncryptJWT({
      sub: userId,
      jti: accessJti,
      roleId,
      roleName,
    })
      .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .setIssuer(
        this.configService.get<string>('JWT_ISSUER') ?? 'master-gateway',
      )
      .setAudience(
        this.configService.get<string>('JWT_AUDIENCE') ??
          'master-gateway-clients',
      )
      .encrypt(secret);

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        jti: refreshJti,
        roleId,
        roleName,
      } satisfies GatewayTokenPayload,
      { expiresIn: '7d' },
    );

    const decoded: unknown = this.jwtService.decode(refreshToken);
    const expiresAt =
      isDecodedJwt(decoded) && decoded.exp
        ? new Date(decoded.exp * 1000)
        : this.addDays(new Date(), 7);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        roleId,
        jti: refreshJti,
        tokenHash: await argon2.hash(refreshToken, { type: argon2.argon2id }),
        expiresAt,
        createdBy: userId,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenJti: refreshJti,
      tokenType: 'Bearer',
      expiresIn: '15m',
      role: { id: roleId, name: roleName },
    };
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isAllowedInternalService(serviceName: string | undefined) {
    const allowedServices = (
      process.env['INTERNAL_ALLOWED_SERVICES'] ?? ''
    )
      .split(',')
      .map((service) => service.trim())
      .filter(Boolean);

    return Boolean(serviceName && allowedServices.includes(serviceName));
  }

  private hashIdentifier(value: string) {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex')
      .slice(0, 16);
  }
}

function isDecodedJwt(value: unknown): value is DecodedJwt {
  if (!value || typeof value !== 'object' || !('exp' in value)) {
    return false;
  }

  const { exp } = value as { exp?: unknown };
  return typeof exp === 'number';
}
```

#### 1e. Verificar que compile

```bash
cd backend
npx nest build
```

---

### 2. Configurar Render CLI y Secrets

```bash
# Desde Windows PowerShell o WSL
render login

# Crear grupo de secrets
render env-groups create master-gateway-secrets

# Agregar seed email (ingresar valor real cuando promptee)
render env-groups add-secret master-gateway-secrets --key SEED_ADMIN_EMAIL

# Vincular grupo al servicio
render services env-groups add master-gateway --group master-gateway-secrets
```

> **Nota:** `JWE_SECRET`, `SEED_ADMIN_PASSWORD` y demás secrets sensibles se generan automáticamente vía `generateValue: true` en `render.yaml` — Render los crea al hacer deploy. No necesitan ser creados manualmente.

---

### 3. Rotar Credenciales Expuestas

Las siguientes credenciales están en texto plano en commits anteriores del repo público. Deben cambiarse:

| Variable | Valor actual (expuesto) |
|----------|------------------------|
| `JWT_SECRET` en `.env` | Cualquier valor actual |
| `REFRESH_JWT_SECRET` en `.env` | Cualquier valor actual |
| `INTERNAL_API_KEY` en `.env` | Cualquier valor actual |
| `SEED_ADMIN_PASSWORD` en `.env` | Cualquier valor actual |
| Passwords de Docker Compose | `postgres`, `kong`, `sonar` (solo local, bajo riesgo) |

**Acción:** Generar nuevos valores seguros y reemplazar en `.env` y `docker-compose.yml`

---

### 4. Guardar Clave de git-crypt

```bash
# La clave está en WSL en:
ls -la /home/gamuri/git-crypt-key-backup

# DEBE guardarse en gestor de contraseñas (Chrome/Brave/1Password/Bitwarden)
# Si se pierde, .env y render-secrets.yaml serán ilegibles para siempre
```

---

### 5. Commit y Push Final

```bash
# Desde WSL o usando wsl desde PowerShell:
cd /mnt/c/Users/gamur/Documents/ESPE\ VII\ SI\ 2026/Desarrollo\ Seguro/U3/p

git add -A
git commit -m "feat(security): implement JWE, configure Render secrets, rotate credentials"
git push origin deploy/frontend-test
```

---

## Resumen de Archivos a Modificar

| Archivo | Acción |
|---------|--------|
| `backend/package.json` | Agregar `"jose": "^6.0.0"` en dependencies |
| `backend/src/common/auth/jwt-auth.guard.ts` | Reescribir con `jwtDecrypt` de `jose` |
| `backend/src/common/auth/authenticated-user.ts` | Agregar `jti`, `iat`, `exp`, `iss`, `aud` |
| `backend/src/auth/auth.service.ts` | Inyectar `ConfigService`, usar `EncryptJWT` en accessToken |
| `.env` | Rotar valores expuestos |
| `docker-compose.yml` | ✅ Ya editado (solo falta rotar passwords) |
| `render.yaml` | ✅ Ya editado |

## Orden de Ejecución Recomendado

1. Guardar clave git-crypt (paso 4)
2. Instalar `jose` y escribir cambios JWE (pasos 1a-1e)
3. Rotar credenciales en `.env` (paso 3)
4. Verificar que compila: `npx nest build`
5. Commitear con git desde WSL (paso 5)
6. `render login` y configurar secrets (paso 2)
7. Hacer deploy en Render
