import { Module } from '@nestjs/common';
import { ServiceProxyController } from './service-proxy.controller';
import { ServiceProxyService } from './service-proxy.service';
import { ServiceIdentityService } from './service-identity.service';

@Module({
  controllers: [ServiceProxyController],
  providers: [ServiceProxyService, ServiceIdentityService],
  exports: [ServiceIdentityService],
})
export class ServiceProxyModule {}
