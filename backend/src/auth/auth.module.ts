import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { KeysModule } from '../common/keys/keys.module';
import { GatewaySessionService } from '../common/auth/gateway-session.service';
import { KeysService } from '../common/keys/keys.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    KeysModule,
    JwtModule.registerAsync({
      inject: [KeysService, ConfigService],
      useFactory: (keys: KeysService, config: ConfigService) => ({
        privateKey: keys.getPrivateKey(),
        publicKey: keys.getPublicKey(),
        signOptions: {
          algorithm: 'RS256',
          issuer: config.get<string>('JWT_ISSUER') ?? 'master-gateway',
          audience:
            config.get<string>('JWT_AUDIENCE') ?? 'master-gateway-clients',
        },
        verifyOptions: {
          algorithms: ['RS256'],
          issuer: config.get<string>('JWT_ISSUER') ?? 'master-gateway',
          audience:
            config.get<string>('JWT_AUDIENCE') ?? 'master-gateway-clients',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GatewaySessionService],
  exports: [AuthService, GatewaySessionService, JwtModule],
})
export class AuthModule {}
