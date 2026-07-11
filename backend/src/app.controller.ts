import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
