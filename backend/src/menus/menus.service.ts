import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado, Prisma } from '@prisma/client';
import { assertSafeProbeTarget } from '../external-services/ssrf-guard';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { IMPLICIT_ROUTE_SERVICE_PREFIX } from './dto/proxy-route.constants';

/** Datos derivados de `targetUrl` para montar servicio + ruta de proxy. */
type ProxyRoutePlan = {
  /** Origen del microservicio, p. ej. `http://inventario:3007`. */
  baseUrl: string;
  /** Ruta dentro del microservicio, p. ej. `/inventario/productos`. */
  targetPath: string;
  /** Ruta publica que resuelve `/api/proxy/...`, p. ej. `/inventario/productos`. */
  publicPath: string;
  methods: string[];
};

export type MenuTreeNode = {
  id: string;
  name: string;
  url: string | null;
  icon: string | null;
  order: number;
  children: MenuTreeNode[];
};

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const menus = await this.prisma.menu.findMany({
      where: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
      include: {
        module: true,
        parent: true,
        proxyRoute: { include: { service: true } },
      },
      orderBy: [{ moduleId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });

    return menus.map((menu) => this.withTargetUrl(menu));
  }

  async findOne(id: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id, estado: Estado.ACTIVO },
      include: {
        module: true,
        parent: true,
        proxyRoute: { include: { service: true } },
      },
    });

    if (!menu) throw new NotFoundException('Menu no encontrado');

    return this.withTargetUrl(menu);
  }

  /**
   * Recompone `targetUrl` a partir del servicio y la ruta para que el
   * formulario de edicion pueda mostrarlo tal como se introdujo.
   */
  private withTargetUrl<
    T extends {
      proxyRoute?: {
        estado: Estado;
        targetPath: string;
        methods: string[];
        service: { baseUrl: string };
      } | null;
    },
  >(menu: T) {
    const route = menu.proxyRoute;
    const active = route && route.estado === Estado.ACTIVO ? route : null;

    return {
      ...menu,
      targetUrl: active
        ? `${active.service.baseUrl.replace(/\/+$/, '')}${active.targetPath}`
        : null,
      methods: active ? active.methods : [],
    };
  }

  async treeForRole(roleId: string) {
    const roleMenus = await this.prisma.roleMenu.findMany({
      where: {
        roleId,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
        menu: {
          estado: Estado.ACTIVO,
          module: {
            estado: Estado.ACTIVO,
            roles: { some: { roleId, estado: Estado.ACTIVO } },
          },
        },
      },
      include: { menu: { include: { module: true } } },
      orderBy: { menu: { order: 'asc' } },
    });

    const modules = new Map<
      string,
      { id: string; code: string; name: string; menus: MenuTreeNode[] }
    >();
    const nodes = new Map<
      string,
      MenuTreeNode & { parentId: string | null; moduleId: string }
    >();

    for (const roleMenu of roleMenus) {
      const { menu } = roleMenu;
      modules.set(menu.moduleId, {
        id: menu.module.id,
        code: menu.module.code,
        name: menu.module.name,
        menus: modules.get(menu.moduleId)?.menus ?? [],
      });
      nodes.set(menu.id, {
        id: menu.id,
        name: menu.name,
        url: menu.url,
        icon: menu.icon,
        order: menu.order,
        parentId: menu.parentId,
        moduleId: menu.moduleId,
        children: [],
      });
    }

    const sortedNodes = [...nodes.values()].sort(
      (a, b) => a.order - b.order || a.name.localeCompare(b.name),
    );
    for (const node of sortedNodes) {
      if (node.parentId) {
        const parent = nodes.get(node.parentId);
        if (parent) {
          parent.children.push(node);
        }
        continue;
      }

      modules.get(node.moduleId)?.menus.push(node);
    }

    return [...modules.values()].filter((module) => module.menus.length > 0);
  }

  async create(dto: CreateMenuDto, actorId: string) {
    await this.ensureActiveModule(dto.moduleId);
    if (dto.parentId) {
      await this.ensureParentInModule(dto.parentId, dto.moduleId);
    }

    // Se valida ANTES de abrir la transaccion: `assertSafeProbeTarget` resuelve
    // DNS y no conviene tener una transaccion abierta durante una operacion de
    // red.
    const plan = dto.targetUrl
      ? await this.buildProxyPlan(dto.url, dto.targetUrl, dto.methods)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const menu = await tx.menu.create({
        data: {
          name: dto.name,
          url: dto.url,
          icon: dto.icon,
          order: dto.order,
          moduleId: dto.moduleId,
          parentId: dto.parentId,
          createdBy: actorId,
        },
      });

      if (!plan) {
        return menu;
      }

      // El menu se crea PRIMERO porque el codigo del servicio implicito se
      // deriva de su id, y la ruta necesita ambos.
      await this.attachProxyRoute(tx, menu.id, menu.name, plan, actorId);

      return tx.menu.findUniqueOrThrow({
        where: { id: menu.id },
        include: { proxyRoute: { include: { service: true } } },
      });
    });
  }

  /**
   * Traduce `targetUrl` a los datos que necesitan `ExternalService` y
   * `ExternalServiceRoute`, validando que el destino sea alcanzable de forma
   * segura.
   */
  private async buildProxyPlan(
    menuUrl: string | null | undefined,
    targetUrl: string,
    methods: string[] | undefined,
  ): Promise<ProxyRoutePlan> {
    if (!menuUrl?.startsWith('/app/')) {
      throw new BadRequestException(
        'Para enrutar a un microservicio, la ruta del menu debe empezar por /app/',
      );
    }

    // Mismo guard que usa el modulo External Services. Sin el, `menus:write`
    // seria una puerta mas debil para el mismo poder: apuntar el proxy del
    // Master a la red interna o al servicio de metadatos de la nube (SSRF).
    const { url } = await assertSafeProbeTarget(targetUrl);

    const targetPath = url.pathname === '/' ? '/' : url.pathname;

    return {
      baseUrl: url.origin,
      targetPath,
      publicPath: this.toProxyPublicPath(menuUrl),
      methods: this.normalizeMethods(methods),
    };
  }

  /** `/app/inventario/productos` -> `/inventario/productos`. */
  private toProxyPublicPath(menuUrl: string) {
    return `/${menuUrl.replace(/^\/app\/?/, '').replace(/^\/+/, '')}`;
  }

  private normalizeMethods(methods: string[] | undefined) {
    return [
      ...new Set(
        (methods?.length ? methods : ['GET']).map((method) =>
          method.toUpperCase(),
        ),
      ),
    ];
  }

  /**
   * Crea el `ExternalService` implicito y su ruta para un menu.
   *
   * `publicPath` es UNICO a nivel de tabla, con independencia del `estado`, asi
   * que una ruta ya desactivada seguiria reservando el valor y haria imposible
   * volver a crear ese menu. Antes de insertar se libera el hueco.
   */
  private async attachProxyRoute(
    tx: Prisma.TransactionClient,
    menuId: string,
    menuName: string,
    plan: ProxyRoutePlan,
    actorId: string,
  ) {
    await this.ensurePublicPathAvailable(tx, plan.publicPath, menuId);

    const service = await tx.externalService.create({
      data: {
        code: `${IMPLICIT_ROUTE_SERVICE_PREFIX}${menuId}`,
        name: `Ruta: ${menuName}`,
        description:
          'Servicio creado automaticamente al enrutar un menu a un microservicio.',
        baseUrl: plan.baseUrl,
        createdBy: actorId,
      },
    });

    return tx.externalServiceRoute.create({
      data: {
        serviceId: service.id,
        menuId,
        publicPath: plan.publicPath,
        targetPath: plan.targetPath,
        methods: plan.methods,
        createdBy: actorId,
      },
    });
  }

  private async ensurePublicPathAvailable(
    tx: Prisma.TransactionClient,
    publicPath: string,
    menuId: string,
  ) {
    const clash = await tx.externalServiceRoute.findUnique({
      where: { publicPath },
    });

    if (!clash || clash.menuId === menuId) {
      return;
    }

    if (clash.estado === Estado.ACTIVO) {
      throw new ConflictException(
        `La ruta publica ${publicPath} ya esta en uso por otro menu`,
      );
    }

    // Ruta ya desactivada: se conserva la fila por auditoria, pero se le cambia
    // el `publicPath` a un valor lapida para liberar la restriccion unica. El
    // proxy nunca la resuelve porque solo mira rutas ACTIVO.
    await tx.externalServiceRoute.update({
      where: { id: clash.id },
      data: { publicPath: `${publicPath}#retirada-${clash.id}` },
    });
  }

  async update(id: string, dto: UpdateMenuDto, actorId: string) {
    const current = await this.ensureActiveMenu(id);
    const nextModuleId = dto.moduleId ?? current.moduleId;

    await this.ensureActiveModule(nextModuleId);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.assertNoCycle(id, dto.parentId);
      await this.ensureParentInModule(dto.parentId, nextModuleId);
    }

    // Cadena vacia y null significan lo mismo aqui: quitar el enrutado.
    const clearsRoute = dto.targetUrl === null || dto.targetUrl === '';
    const setsRoute = typeof dto.targetUrl === 'string' && dto.targetUrl !== '';

    // Si solo cambian los metodos, se conserva el destino que ya tenia.
    const existingRoute = await this.prisma.externalServiceRoute.findUnique({
      where: { menuId: id },
      include: { service: true },
    });

    const nextMenuUrl = dto.url === undefined ? current.url : dto.url;
    const plan = setsRoute
      ? await this.buildProxyPlan(nextMenuUrl, dto.targetUrl!, dto.methods)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const menu = await tx.menu.update({
        where: { id },
        data: {
          name: dto.name,
          url: dto.url,
          icon: dto.icon,
          order: dto.order,
          moduleId: dto.moduleId,
          parentId: dto.parentId,
          updatedBy: actorId,
        },
      });

      if (clearsRoute && existingRoute) {
        await this.detachProxyRoute(tx, existingRoute.id, actorId);
      } else if (plan) {
        if (existingRoute) {
          await this.ensurePublicPathAvailable(tx, plan.publicPath, id);
          await tx.externalServiceRoute.update({
            where: { id: existingRoute.id },
            data: {
              publicPath: plan.publicPath,
              targetPath: plan.targetPath,
              methods: plan.methods,
              estado: Estado.ACTIVO,
              updatedBy: actorId,
            },
          });
          // Solo se reapunta el servicio si es uno implicito de este menu; los
          // registrados a mano en External Services no se tocan.
          if (this.isImplicitService(existingRoute.service.code, id)) {
            await tx.externalService.update({
              where: { id: existingRoute.serviceId },
              data: {
                baseUrl: plan.baseUrl,
                estado: Estado.ACTIVO,
                updatedBy: actorId,
              },
            });
          }
        } else {
          await this.attachProxyRoute(tx, id, menu.name, plan, actorId);
        }
      } else if (existingRoute && dto.methods?.length) {
        await tx.externalServiceRoute.update({
          where: { id: existingRoute.id },
          data: {
            methods: this.normalizeMethods(dto.methods),
            updatedBy: actorId,
          },
        });
      }

      return tx.menu.findUniqueOrThrow({
        where: { id },
        include: { proxyRoute: { include: { service: true } } },
      });
    });
  }

  private isImplicitService(serviceCode: string, menuId: string) {
    return serviceCode === `${IMPLICIT_ROUTE_SERVICE_PREFIX}${menuId}`;
  }

  /**
   * Desactiva una ruta de proxy y libera su `publicPath`.
   *
   * La fila se conserva (soft delete, §9), pero su `publicPath` pasa a un valor
   * lapida: si no, la restriccion unica impediria para siempre volver a crear
   * un menu con esa misma ruta.
   */
  private async detachProxyRoute(
    tx: Prisma.TransactionClient,
    routeId: string,
    actorId: string,
  ) {
    const route = await tx.externalServiceRoute.findUniqueOrThrow({
      where: { id: routeId },
      include: { service: true },
    });

    await tx.externalServiceRoute.update({
      where: { id: routeId },
      data: {
        estado: Estado.INACTIVO,
        publicPath: route.publicPath.includes('#retirada-')
          ? route.publicPath
          : `${route.publicPath}#retirada-${routeId}`,
        updatedBy: actorId,
      },
    });

    if (this.isImplicitService(route.service.code, route.menuId)) {
      await tx.externalService.update({
        where: { id: route.serviceId },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
    }
  }

  async remove(id: string, actorId: string) {
    await this.ensureActiveMenu(id);
    const menuIds = await this.collectActiveSubtreeIds(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.roleMenu.updateMany({
        where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });

      // Se recorren una a una en vez de con `updateMany` porque cada ruta debe
      // liberar su `publicPath` y arrastrar su servicio implicito.
      const routes = await tx.externalServiceRoute.findMany({
        where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
        select: { id: true },
      });
      for (const route of routes) {
        await this.detachProxyRoute(tx, route.id, actorId);
      }

      await tx.menu.updateMany({
        where: { id: { in: menuIds }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
    });

    return { success: true };
  }

  private async collectActiveSubtreeIds(rootId: string) {
    const ids: string[] = [];
    let pending = [rootId];

    while (pending.length > 0) {
      ids.push(...pending);
      const children = await this.prisma.menu.findMany({
        where: { parentId: { in: pending }, estado: Estado.ACTIVO },
        select: { id: true },
      });
      pending = children.map((child) => child.id);
    }

    return ids;
  }
  private async ensureActiveModule(id: string) {
    const module = await this.prisma.systemModule.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!module) throw new NotFoundException('Modulo no encontrado');
  }

  private async ensureActiveMenu(id: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!menu) throw new NotFoundException('Menu no encontrado');
    return menu;
  }

  private async ensureParentInModule(parentId: string, moduleId: string) {
    const parent = await this.prisma.menu.findFirst({
      where: { id: parentId, estado: Estado.ACTIVO },
    });

    if (!parent) throw new NotFoundException('Menu padre no encontrado');
    if (parent.moduleId !== moduleId) {
      throw new BadRequestException(
        'El menu padre debe pertenecer al mismo modulo',
      );
    }
  }

  private async assertNoCycle(menuId: string, parentId: string) {
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      if (currentParentId === menuId) {
        throw new BadRequestException(
          'La jerarquia de menu no puede ser ciclica',
        );
      }

      const parent: { parentId: string | null } | null =
        await this.prisma.menu.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });

      currentParentId = parent?.parentId ?? null;
    }
  }
}
