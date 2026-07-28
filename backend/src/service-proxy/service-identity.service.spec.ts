import { ServiceIdentityService } from './service-identity.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ServiceIdentityService', () => {
  let prisma: { externalService: { findUnique: jest.Mock } };
  let service: ServiceIdentityService;

  beforeEach(() => {
    prisma = {
      externalService: {
        findUnique: jest.fn(),
      },
    };
    service = new ServiceIdentityService(prisma as unknown as PrismaService);
  });

  describe('getApiKey', () => {
    it('returns the apiKey when the service has one', async () => {
      prisma.externalService.findUnique.mockResolvedValue({
        apiKey: 'sk-service-abc123',
      });
      await expect(service.getApiKey('svc-1')).resolves.toBe(
        'sk-service-abc123',
      );
      expect(prisma.externalService.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-1' },
        select: { apiKey: true },
      });
    });

    it('returns null when the service has no apiKey', async () => {
      prisma.externalService.findUnique.mockResolvedValue({ apiKey: null });
      await expect(service.getApiKey('svc-2')).resolves.toBeNull();
    });

    it('returns null when the service does not exist', async () => {
      prisma.externalService.findUnique.mockResolvedValue(null);
      await expect(service.getApiKey('svc-missing')).resolves.toBeNull();
    });
  });

  describe('buildIdentityHeaders', () => {
    it('includes service id and code when no apiKey is set', () => {
      const svc = {
        id: 'svc-1',
        code: 'VENTAS',
        apiKey: null,
      } as any;

      const headers = service.buildIdentityHeaders(svc);

      expect(headers).toEqual({
        'x-gateway-service-id': 'svc-1',
        'x-gateway-service-code': 'VENTAS',
      });
    });

    it('includes x-gateway-api-key when the service has one', () => {
      const svc = {
        id: 'svc-2',
        code: 'INVENTARIO',
        apiKey: 'sk-inv-secret',
      } as any;

      const headers = service.buildIdentityHeaders(svc);

      expect(headers).toEqual({
        'x-gateway-service-id': 'svc-2',
        'x-gateway-service-code': 'INVENTARIO',
        'x-gateway-api-key': 'sk-inv-secret',
      });
    });

    it('does not include x-gateway-api-key when apiKey is empty string', () => {
      const svc = {
        id: 'svc-3',
        code: 'REPORTES',
        apiKey: '',
      } as any;

      const headers = service.buildIdentityHeaders(svc);

      expect(headers).toEqual({
        'x-gateway-service-id': 'svc-3',
        'x-gateway-service-code': 'REPORTES',
      });
      expect(headers['x-gateway-api-key']).toBeUndefined();
    });
  });
});
