import { join } from 'node:path';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RequestLoggingMiddleware } from './common/observability/request-logging.middleware';
import { validateEnv } from './config/env.validation';
import { ExternalServicesModule } from './external-services/external-services.module';
import { MenusModule } from './menus/menus.module';
import { ModulesModule } from './modules/modules.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PolicyModule } from './common/policy/policy.module';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { ServiceProxyModule } from './service-proxy/service-proxy.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ServeStaticModule.forRoot({
      // `frontend/` era el Angular legado, ya retirado (solo queda su
      // node_modules). La SPA real es `frontend-vue`, asi que el backend estaba
      // sirviendo estaticos desde un directorio inexistente.
      // __dirname = backend/dist/src -> tres niveles arriba es la raiz del repo.
      rootPath:
        process.env.FRONTEND_DIST_PATH ??
        join(__dirname, '..', '..', '..', 'frontend-vue', 'dist'),
      // Sintaxis de path-to-regexp v8 (Express 5): los grupos regex sin nombre
      // como `(.*)` ya no son vÃ¡lidos y lanzan PathError. `{/*splat}` es el
      // wildcard con nombre equivalente, que matchea el prefijo y todo lo que
      // cuelga de Ã©l (`/api`, `/api/`, `/api/auth/login`).
      exclude: ['/api{/*splat}', '/health{/*splat}'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    ModulesModule,
    MenusModule,
    ExternalServicesModule,
    PolicyModule,
    PermissionsModule,
    ServiceProxyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
