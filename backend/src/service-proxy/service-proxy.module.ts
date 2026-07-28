import { Module } from '@nestjs/common';
import { ExternalServicesModule } from '../external-services/external-services.module';
import { ServiceProxyController } from './service-proxy.controller';
import { ServiceProxyService } from './service-proxy.service';
import { ServiceIdentityService } from './service-identity.service';

@Module({
  imports: [ExternalServicesModule],
  controllers: [ServiceProxyController],
  providers: [ServiceProxyService, ServiceIdentityService],
  exports: [ServiceIdentityService],
})
export class ServiceProxyModule {}
