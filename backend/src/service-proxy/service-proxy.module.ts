import { Module } from '@nestjs/common';
import { ExternalServicesModule } from '../external-services/external-services.module';
import { ServiceProxyController } from './service-proxy.controller';
import { ServiceProxyService } from './service-proxy.service';

@Module({
  imports: [ExternalServicesModule],
  controllers: [ServiceProxyController],
  providers: [ServiceProxyService],
})
export class ServiceProxyModule {}
