import { Module } from '@nestjs/common';
import { ServiceProxyController } from './service-proxy.controller';
import { ServiceProxyService } from './service-proxy.service';

@Module({
  controllers: [ServiceProxyController],
  providers: [ServiceProxyService],
})
export class ServiceProxyModule {}
