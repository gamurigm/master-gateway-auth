import { Module } from '@nestjs/common';
import { ExternalServicesController } from './external-services.controller';
import { ExternalServicesService } from './external-services.service';
import { ServiceIdentityService } from './service-identity.service';

@Module({
  controllers: [ExternalServicesController],
  providers: [ExternalServicesService, ServiceIdentityService],
  // El proxy necesita la identidad de servicio para firmar sus llamadas
  // salientes hacia los microservicios.
  exports: [ServiceIdentityService],
})
export class ExternalServicesModule {}
