import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// sast-ignore: TS-MISSING-AUTHZ los endpoints de liveness/readiness deben ser
// alcanzables sin token para que el orquestador (Docker, Kubernetes, Render)
// pueda sondear el servicio. No exponen datos de negocio.
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  index() {
    return {
      status: 'ok',
      service: this.appService.getHello(),
      api: '/api',
      health: '/api/health',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: this.appService.getHello(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health/db')
  databaseHealth() {
    return this.appService.getDatabaseHealth();
  }
}
