declare module '@nestjs/config' {
  import { DynamicModule } from '@nestjs/common';

  interface EnvVar {
    [key: string]: string | undefined;
  }

  export class ConfigService<T = EnvVar> {
    get<K extends keyof T>(key: K): T[K];
    get<K extends string, R = string>(key: K, defaultValue?: R): R;
  }

  export class ConfigModule {
    static forRoot(options?: Record<string, unknown>): DynamicModule;
  }
}

declare module '@nestjs/throttler' {
  import { CanActivate, DynamicModule, Type } from '@nestjs/common';
  export class ThrottlerGuard implements CanActivate {
    canActivate(): boolean | Promise<boolean>;
  }
  export class ThrottlerModule {
    static forRoot(options?: unknown[]): DynamicModule;
  }
  export interface ThrottlerModuleOptions {
    limit?: number;
    ttl?: number;
    blockDuration?: number;
  }
  export function Throttle(options?: Record<string, ThrottlerModuleOptions>): MethodDecorator & ClassDecorator;
}

declare module '@nestjs/serve-static' {
  import { DynamicModule } from '@nestjs/common';
  export class ServeStaticModule {
    static forRoot(options: {
      rootPath: string;
      exclude?: string[];
    }): DynamicModule;
  }
}
