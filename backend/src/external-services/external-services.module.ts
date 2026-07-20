import { Module } from '@nestjs/common';
import { ExternalServicesController } from './external-services.controller';
import { ExternalServicesService } from './external-services.service';

@Module({
  controllers: [ExternalServicesController],
  providers: [ExternalServicesService],
})
export class ExternalServicesModule {}
