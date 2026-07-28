import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

export type MenuTreeNode = {
  id: string;
  name: string;
  url: string | null;
  icon: string | null;
  order: number;
  children: MenuTreeNode[];
};

const HIDDEN_SERVICE_PREFIX = '_route_';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.menu.findMany({
      where: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
      include: { module: true, parent: true },
      orderBy: [{ moduleId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    });
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

    if (dto.targetUrl) {
      return this.createWithRoute(
        dto as CreateMenuDto & { targetUrl: string; methods?: string[] },
        actorId,
      );
    }

    return this.prisma.menu.create({
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
  }

  async update(id: string, dto: UpdateMenuDto, actorId: string) {
    const current = await this.ensureActiveMenu(id);
    const nextModuleId = dto.moduleId ?? current.moduleId;

    await this.ensureActiveModule(nextModuleId);
    if (dto.parentId !== undefined && dto.parentId !== null) {
      await this.assertNoCycle(id, dto.parentId);
      await this.ensureParentInModule(dto.parentId, nextModuleId);
    }

    const existingRoute = await this.prisma.externalServiceRoute.findFirst({
      where: { menuId: id, estado: Estado.ACTIVO },
      include: { service: true },
    });

    if (dto.targetUrl !== undefined) {
      if (dto.targetUrl) {
        const url = new URL(dto.targetUrl);
        const targetPath = url.pathname;

        if (existingRoute) {
          await this.prisma.$transaction(async (tx) => {
            await tx.externalServiceRoute.update({
              where: { id: existingRoute.id },
              data: {
                targetPath,
                methods: dto.methods ?? existingRoute.methods,
                updatedBy: actorId,
              },
            });
            await tx.externalService.update({
              where: { id: existingRoute.serviceId },
              data: {
                baseUrl: `${url.protocol}//${url.host}`,
                updatedBy: actorId,
              },
            });
            await tx.menu.update({
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
          });
          return this.prisma.menu.findUnique({ where: { id } });
        }

        return this.createWithRoute(
          {
            name: dto.name ?? current.name,
            url: dto.url ?? current.url ?? undefined,
            icon: dto.icon ?? current.icon ?? undefined,
            order: dto.order ?? current.order,
            moduleId: nextModuleId,
            parentId: dto.parentId ?? current.parentId ?? undefined,
            targetUrl: dto.targetUrl,
            methods: dto.methods,
          },
          actorId,
          id,
        );
      }

      if (existingRoute) {
        await this.prisma.$transaction(async (tx) => {
          await tx.externalServiceRoute.update({
            where: { id: existingRoute.id },
            data: { estado: Estado.INACTIVO, updatedBy: actorId },
          });
          if (existingRoute.service.code.startsWith(HIDDEN_SERVICE_PREFIX)) {
            await tx.externalService.update({
              where: { id: existingRoute.serviceId },
              data: { estado: Estado.INACTIVO, updatedBy: actorId },
            });
          }
          await tx.menu.update({
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
        });
        return this.prisma.menu.findUnique({ where: { id } });
      }
    }

    return this.prisma.menu.update({
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
  }

  private async createWithRoute(
    dto: CreateMenuDto & { targetUrl: string; methods?: string[] },
    actorId: string,
    existingMenuId?: string,
  ) {
    const url = new URL(dto.targetUrl);
    const baseUrl = `${url.protocol}//${url.host}`;
    const targetPath = url.pathname;
    const publicPath = this.toProxyPublicPath(dto.url ?? targetPath);
    const methods = dto.methods ?? ['GET'];

    return this.prisma.$transaction(async (tx) => {
      const serviceCode = `${HIDDEN_SERVICE_PREFIX}${existingMenuId ?? crypto.randomUUID()}`;

      const externalService = await tx.externalService.create({
        data: {
          code: serviceCode,
          name: `Ruta: ${dto.name}`,
          baseUrl,
          healthPath: '/health',
          estado: Estado.ACTIVO,
          createdBy: actorId,
        },
      });

      const menu = existingMenuId
        ? await tx.menu.update({
            where: { id: existingMenuId },
            data: {
              name: dto.name,
              url: dto.url,
              icon: dto.icon,
              order: dto.order,
              moduleId: dto.moduleId,
              parentId: dto.parentId,
              updatedBy: actorId,
            },
          })
        : await tx.menu.create({
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

      await tx.externalServiceRoute.create({
        data: {
          serviceId: externalService.id,
          menuId: menu.id,
          publicPath,
          targetPath,
          methods,
          createdBy: actorId,
        },
      });

      return menu;
    });
  }

  async remove(id: string, actorId: string) {
    await this.ensureActiveMenu(id);
    const menuIds = await this.collectActiveSubtreeIds(id);

    await this.prisma.$transaction(async (tx) => {
      const routes = await tx.externalServiceRoute.findMany({
        where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
        include: { service: true },
      });

      await tx.roleMenu.updateMany({
        where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });

      await tx.externalServiceRoute.updateMany({
        where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });

      const hiddenServiceIds = routes
        .filter((r) => r.service.code.startsWith(HIDDEN_SERVICE_PREFIX))
        .map((r) => r.service.id);

      if (hiddenServiceIds.length > 0) {
        await tx.externalService.updateMany({
          where: { id: { in: hiddenServiceIds }, estado: Estado.ACTIVO },
          data: { estado: Estado.INACTIVO, updatedBy: actorId },
        });
      }

      await tx.menu.updateMany({
        where: { id: { in: menuIds }, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
    });

    return { success: true };
  }

  private toProxyPublicPath(menuUrl: string) {
    return `/${menuUrl.replace(/^\/app\/?/, '').replace(/^\/+/, '')}`;
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
