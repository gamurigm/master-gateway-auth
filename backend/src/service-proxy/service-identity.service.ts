import { Injectable, Logger } from '@nestjs/common';
import { ExternalService } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServiceIdentityService {
  private readonly logger = new Logger(ServiceIdentityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getApiKey(serviceId: string): Promise<string | null> {
    const svc = await this.prisma.externalService.findUnique({
      where: { id: serviceId },
      select: { apiKey: true },
    });
    return svc?.apiKey ?? null;
  }

  buildIdentityHeaders(service: ExternalService): Record<string, string> {
    const headers: Record<string, string> = {};

    headers['x-gateway-service-id'] = service.id;
    headers['x-gateway-service-code'] = service.code;

    if (service.apiKey) {
      headers['x-gateway-api-key'] = service.apiKey;
    }

    return headers;
  }
}
