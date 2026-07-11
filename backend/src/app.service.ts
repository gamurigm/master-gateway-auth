import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'master-gateway';
  }

  async getDatabaseHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'postgresql',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('Base de datos no disponible');
    }
  }
}
