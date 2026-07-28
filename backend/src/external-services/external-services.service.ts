import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExternalServiceDto } from './dto/create-external-service.dto';
import { ProbeServiceDto } from './dto/probe-service.dto';
import { ProvisionServiceDto } from './dto/provision-service.dto';
import { UpdateExternalServiceDto } from './dto/update-external-service.dto';
import { assertSafeProbeTarget } from './ssrf-guard';

/** Tiempo maximo que se espera a un servicio externo antes de darlo por caido. */
const PROBE_TIMEOUT_MS = 5_000;
/** Tope de cuerpo leido del OpenAPI, para no agotar memoria con una respuesta enorme. */
const MAX_BODY_BYTES = 512 * 1024;

export interface DiscoveredEndpoint {
  name: string;
  path: string;
  method: string;
}

export interface ServiceMetadata {
  name: string;
  version: string;
  description?: string;
  vendor?: string;
  /** Endpoints expuestos que pueden convertirse en menús. */
  endpoints?: Array<{
    name: string;
    path: string;
    method: string;
    description?: string;
  }>;
  /** Permisos que el servicio registra automáticamente. */
  permissions?: Array<{
    code: string;
    resource: string;
    action: string;
    description?: string;
  }>;
  /** Capacidades adicionales del servicio. */
  capabilities?: string[];
  openApiUrl?: string;
  healthEndpoint?: string;
}

export interface ProbeResult {
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number;
  resolvedAddress: string;
  error: string | null;
  discoveredEndpoints: DiscoveredEndpoint[];
  /** Metadata obtenida de /internal/metadata si el servicio la expone. */
  metadata?: ServiceMetadata | null;
}

@Injectable()
export class ExternalServicesService {
  private readonly logger = new Logger(ExternalServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.externalService.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: { name: 'asc' },
      include: { module: true },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.externalService.findFirst({
      where: { id, estado: Estado.ACTIVO },
      include: {
        module: { include: { menus: { where: { estado: Estado.ACTIVO } } } },
      },
    });

    if (!service) {
      throw new NotFoundException('Servicio externo no encontrado');
    }

    return service;
  }

  /**
   * Comprueba que el servicio responde SIN persistir nada.
   *
   * Es el paso previo obligatorio del alta: permite verificar que los endpoints
   * se pueden consultar antes de crear el modulo y los menus asociados.
   */
  async probe(dto: ProbeServiceDto): Promise<ProbeResult> {
    const healthPath = dto.healthPath ?? '/health';
    const target = `${dto.baseUrl.replace(/\/+$/, '')}${healthPath}`;

    // Valida protocolo, credenciales embebidas y la IP resuelta (anti-SSRF).
    const { address } = await assertSafeProbeTarget(target);

    const startedAt = Date.now();
    try {
      const response = await this.fetchWithTimeout(target);
      const latencyMs = Date.now() - startedAt;
      const reachable = response.ok;

      const [discoveredEndpoints, metadata] = await Promise.all([
        this.discoverEndpoints(dto.baseUrl, dto.openApiPath),
        this.discoverMetadata(dto.baseUrl),
      ]);

      return {
        reachable,
        statusCode: response.status,
        latencyMs,
        resolvedAddress: address,
        error: reachable ? null : `El servicio respondio ${response.status}`,
        discoveredEndpoints,
        metadata,
      };
    } catch (error) {
      return {
        reachable: false,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        resolvedAddress: address,
        error: this.describeError(error),
        discoveredEndpoints: [],
      };
    }
  }

  /** Re-verifica un servicio ya registrado y guarda el resultado. */
  async probeExisting(id: string, actorId: string) {
    const service = await this.findOne(id);

    const result = await this.probe({
      baseUrl: service.baseUrl,
      healthPath: service.healthPath,
      ...(service.openApiPath ? { openApiPath: service.openApiPath } : {}),
    });

    await this.prisma.externalService.update({
      where: { id },
      data: {
        lastProbeAt: new Date(),
        lastProbeOk: result.reachable,
        lastProbeMs: result.latencyMs,
        updatedBy: actorId,
      },
    });

    return result;
  }

  async create(dto: CreateExternalServiceDto, actorId: string) {
    const existing = await this.prisma.externalService.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('El codigo de servicio ya existe');
    }

    const result = await this.probe({
      baseUrl: dto.baseUrl,
      ...(dto.healthPath ? { healthPath: dto.healthPath } : {}),
      ...(dto.openApiPath ? { openApiPath: dto.openApiPath } : {}),
    });

    if (!result.reachable) {
      throw new BadRequestException(
        `El servicio no responde en ${dto.baseUrl}${dto.healthPath ?? '/health'}: ${result.error}`,
      );
    }

    // Si el servicio expuso metadata, usamos name desde allí si no se especificó
    const name = dto.name || result.metadata?.name || dto.code;

    return this.prisma.externalService.create({
      data: {
        ...dto,
        name,
        lastProbeAt: new Date(),
        lastProbeOk: true,
        lastProbeMs: result.latencyMs,
        createdBy: actorId,
      },
    });
  }

  async update(id: string, dto: UpdateExternalServiceDto, actorId: string) {
    await this.findOne(id);
    return this.prisma.externalService.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
    });
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.externalService.update({
      where: { id },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  /**
   * Genera el modulo, el arbol de menus y las asignaciones de rol del servicio.
   *
   * Todo ocurre en una transaccion: si algo falla no queda un modulo sin menus
   * ni menus sin permisos.
   *
   * La jerarquia sigue el patron del PDF: un nodo raiz agrupador SIN url, y un
   * nodo hoja por endpoint, que es el unico que lleva url.
   */
  async provision(id: string, dto: ProvisionServiceDto, actorId: string) {
    const service = await this.findOne(id);

    if (service.moduleId) {
      throw new ConflictException(
        'El servicio ya fue aprovisionado. Elimina el modulo antes de volver a generarlo.',
      );
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds }, estado: Estado.ACTIVO },
      select: { id: true },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException(
        'Alguno de los roles indicados no existe o esta inactivo',
      );
    }

    const existingModule = await this.prisma.systemModule.findUnique({
      where: { code: service.code },
    });
    if (existingModule) {
      throw new ConflictException(
        `Ya existe un modulo con el codigo ${service.code}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const systemModule = await tx.systemModule.create({
        data: {
          code: service.code,
          name: service.name,
          description:
            service.description ?? `Modulo generado desde ${service.baseUrl}`,
          createdBy: actorId,
        },
      });

      // Nodo raiz agrupador: sin url, solo agrupa (seccion 4.1 del PDF).
      const rootMenu = await tx.menu.create({
        data: {
          name: service.name,
          url: null,
          icon: 'plug',
          order: 0,
          moduleId: systemModule.id,
          parentId: null,
          createdBy: actorId,
        },
      });

      const leafMenus = [];
      for (const [index, item] of dto.items.entries()) {
        const leafMenu = await tx.menu.create({
          data: {
            name: item.name,
            url: item.path,
            icon: item.icon ?? 'link',
            order: index + 1,
            moduleId: systemModule.id,
            parentId: rootMenu.id,
            createdBy: actorId,
          },
        });

        await tx.externalServiceRoute.create({
          data: {
            serviceId: service.id,
            menuId: leafMenu.id,
            publicPath: this.toProxyPublicPath(item.path),
            targetPath:
              item.targetPath ?? this.inferTargetPath(item.path, service.code),
            methods: this.normalizeMethods(item.methods),
            createdBy: actorId,
          },
        });

        leafMenus.push(leafMenu);
      }

      const menuIds = [rootMenu.id, ...leafMenus.map((menu) => menu.id)];

      for (const role of roles) {
        await tx.roleModule.create({
          data: {
            roleId: role.id,
            moduleId: systemModule.id,
            createdBy: actorId,
          },
        });
        for (const menuId of menuIds) {
          await tx.roleMenu.create({
            data: { roleId: role.id, menuId, createdBy: actorId },
          });
        }
      }

      const updated = await tx.externalService.update({
        where: { id },
        data: { moduleId: systemModule.id, updatedBy: actorId },
      });

      this.logger.log(
        JSON.stringify({
          event: 'external_service.provisioned',
          serviceId: id,
          moduleId: systemModule.id,
          menus: menuIds.length,
          routes: leafMenus.length,
          roles: roles.length,
        }),
      );

      return {
        service: updated,
        module: systemModule,
        menus: menuIds.length,
        routes: leafMenus.length,
      };
    });
  }

  private toProxyPublicPath(menuPath: string) {
    return `/${menuPath.replace(/^\/app\/?/, '').replace(/^\/+/, '')}`;
  }

  private inferTargetPath(menuPath: string, serviceCode: string) {
    const proxyPath = this.toProxyPublicPath(menuPath);
    const serviceSlug = serviceCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const withoutService = proxyPath.replace(
      new RegExp(`^/${serviceSlug}(?=/|$)`),
      '',
    );
    return withoutService || proxyPath;
  }

  private normalizeMethods(methods: string[] | undefined) {
    const normalized = [
      ...new Set(
        (methods?.length ? methods : ['GET']).map((method) =>
          method.toUpperCase(),
        ),
      ),
    ];
    return normalized;
  }
  /**
   * Descubre endpoints leyendo el documento OpenAPI del servicio, si lo expone.
   * Es informativo: el administrador decide en la UI cuales convertir en menu.
   */
  private async discoverEndpoints(
    baseUrl: string,
    openApiPath: string | undefined,
  ): Promise<DiscoveredEndpoint[]> {
    if (!openApiPath) {
      return [];
    }

    const target = `${baseUrl.replace(/\/+$/, '')}${openApiPath}`;

    try {
      await assertSafeProbeTarget(target);
      const response = await this.fetchWithTimeout(target);
      if (!response.ok) {
        return [];
      }

      const raw = await this.readCapped(response);
      const document = JSON.parse(raw) as {
        paths?: Record<
          string,
          Record<string, { summary?: string; operationId?: string }>
        >;
      };

      const endpoints: DiscoveredEndpoint[] = [];
      for (const [path, operations] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(operations ?? {})) {
          if (method.toLowerCase() !== 'get') {
            continue; // Solo los GET tienen sentido como destino de un menu.
          }
          endpoints.push({
            name: operation?.summary ?? operation?.operationId ?? path,
            path,
            method: method.toUpperCase(),
          });
        }
      }
      return endpoints;
    } catch (error) {
      // El descubrimiento es opcional: que falle no invalida el probe de salud.
      this.logger.warn(
        JSON.stringify({
          event: 'external_service.discovery_failed',
          reason: this.describeError(error),
        }),
      );
      return [];
    }
  }

  /**
   * Descubre metadata del servicio via contrato /internal/metadata.
   * Si el servicio implementa el contrato, devuelve información estructurada
   * (módulos, menús, permisos, capacidades). Es el reemplazo moderno de
   * discoverEndpoints basado en OpenAPI.
   */
  private async discoverMetadata(
    baseUrl: string,
  ): Promise<ServiceMetadata | null> {
    const target = `${baseUrl.replace(/\/+$/, '')}/internal/metadata`;

    try {
      await assertSafeProbeTarget(target);
      const response = await this.fetchWithTimeout(target);
      if (!response.ok) {
        return null;
      }

      const raw = await this.readCapped(response);
      const metadata = JSON.parse(raw) as ServiceMetadata;

      if (!metadata.name || !metadata.version) {
        this.logger.warn(
          `Metadata incompleta en ${target}: faltan name o version`,
        );
        return null;
      }

      return metadata;
    } catch (error) {
      this.logger.debug(
        `Servicio no expone /internal/metadata (${this.describeError(error)})`,
      );
      return null;
    }
  }

  private async fetchWithTimeout(target: string): Promise<Response> {
    return fetch(target, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      // No se siguen redirecciones: un 302 hacia 169.254.169.254 saltaria la
      // validacion anti-SSRF, que solo se aplico a la URL original.
      redirect: 'manual',
      headers: { accept: 'application/json' },
    });
  }

  private async readCapped(response: Response): Promise<string> {
    const raw = await response.text();
    return raw.slice(0, MAX_BODY_BYTES);
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.name === 'TimeoutError'
        ? `Sin respuesta en ${PROBE_TIMEOUT_MS} ms`
        : error.message;
    }
    return 'Error desconocido al contactar el servicio';
  }
}
