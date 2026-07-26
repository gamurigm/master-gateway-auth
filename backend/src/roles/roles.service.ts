import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado, type Permission } from '@prisma/client';
import { AuthenticatedUser } from '../common/auth/authenticated-user';
import { PolicyService } from '../common/policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: { name: 'asc' },
      include: {
        users: {
          where: {
            estado: Estado.ACTIVO,
            user: { estado: Estado.ACTIVO },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                estado: true,
              },
            },
          },
        },
        modules: {
          where: {
            estado: Estado.ACTIVO,
            module: { estado: Estado.ACTIVO },
          },
          include: { module: true },
        },
        menus: {
          where: {
            estado: Estado.ACTIVO,
            menu: { estado: Estado.ACTIVO },
          },
          include: { menu: { include: { module: true } } },
        },
        permissions: {
          where: {
            estado: Estado.ACTIVO,
            permission: { estado: Estado.ACTIVO },
          },
          include: { permission: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, estado: Estado.ACTIVO },
      include: {
        users: {
          where: { estado: Estado.ACTIVO, user: { estado: Estado.ACTIVO } },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        modules: {
          where: { estado: Estado.ACTIVO, module: { estado: Estado.ACTIVO } },
          include: {
            module: {
              select: { id: true, code: true, name: true, description: true },
            },
          },
        },
        menus: {
          where: { estado: Estado.ACTIVO, menu: { estado: Estado.ACTIVO } },
          include: {
            menu: {
              select: {
                id: true,
                name: true,
                url: true,
                icon: true,
                order: true,
              },
            },
          },
        },
        permissions: {
          where: {
            estado: Estado.ACTIVO,
            permission: { estado: Estado.ACTIVO },
          },
          include: { permission: true },
        },
      },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  async create(dto: CreateRoleDto, actor: AuthenticatedUser) {
    await this.policyService.assertAllowed(actor, 'roles:create', {
      role_name: dto.name,
    });

    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('El rol ya existe');
    }

    const permissions: Permission[] = [];
    for (const permissionId of dto.permissionIds ?? []) {
      const permission = await this.ensureActivePermission(permissionId);
      await this.policyService.assertAllowed(actor, 'roles:assign_permission', {
        role_name: dto.name,
        permission_code: permission.code,
        permission_delegable: permission.delegable,
      });
      permissions.push(permission);
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdBy: actor.sub,
        },
      });

      for (const permission of permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: createdRole.id,
            permissionId: permission.id,
            createdBy: actor.sub,
          },
        });
      }

      return createdRole;
    });

    return this.findOne(role.id);
  }

  async update(id: string, dto: UpdateRoleDto, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(id);
    await this.policyService.assertAllowed(actor, 'roles:update', {
      role_name: role.name,
    });

    return this.prisma.role.update({
      where: { id },
      data: { ...dto, updatedBy: actor.sub },
    });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(id);
    await this.policyService.assertAllowed(actor, 'roles:delete_soft', {
      role_name: role.name,
    });

    const activeAssignments = await this.prisma.userRole.count({
      where: {
        roleId: id,
        estado: Estado.ACTIVO,
        user: { estado: Estado.ACTIVO },
      },
    });

    if (activeAssignments > 0) {
      throw new BadRequestException(
        'No se puede inactivar un rol asignado a usuarios activos',
      );
    }

    await this.prisma.role.update({
      where: { id },
      data: { estado: Estado.INACTIVO, updatedBy: actor.sub },
    });

    return { success: true };
  }

  async assignUser(roleId: string, userId: string, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveUser(userId);
    await this.policyService.assertAllowed(actor, 'roles:assign_user', {
      role_name: role.name,
    });

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actor.sub },
      create: { userId, roleId, createdBy: actor.sub },
    });
  }

  async unassignUser(roleId: string, userId: string, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveUser(userId);
    await this.policyService.assertAllowed(actor, 'roles:unassign_user', {
      role_name: role.name,
    });

    await this.prisma.userRole.update({
      where: { userId_roleId: { userId, roleId } },
      data: { estado: Estado.INACTIVO, updatedBy: actor.sub },
    });

    return { success: true };
  }

  async assignModule(
    roleId: string,
    moduleId: string,
    actor: AuthenticatedUser,
  ) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveModule(moduleId);
    await this.policyService.assertAllowed(actor, 'roles:assign_module', {
      role_name: role.name,
    });

    return this.prisma.roleModule.upsert({
      where: { roleId_moduleId: { roleId, moduleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actor.sub },
      create: { roleId, moduleId, createdBy: actor.sub },
    });
  }

  async assignMenu(roleId: string, menuId: string, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveMenu(menuId);
    await this.policyService.assertAllowed(actor, 'roles:assign_menu', {
      role_name: role.name,
    });

    return this.prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId, menuId } },
      update: { estado: Estado.ACTIVO, updatedBy: actor.sub },
      create: { roleId, menuId, createdBy: actor.sub },
    });
  }

  async unassignModule(
    roleId: string,
    moduleId: string,
    actor: AuthenticatedUser,
  ) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveModule(moduleId);
    await this.policyService.assertAllowed(actor, 'roles:unassign_module', {
      role_name: role.name,
    });

    await this.prisma.roleModule.update({
      where: { roleId_moduleId: { roleId, moduleId } },
      data: { estado: Estado.INACTIVO, updatedBy: actor.sub },
    });

    return { success: true };
  }

  async unassignMenu(roleId: string, menuId: string, actor: AuthenticatedUser) {
    const role = await this.ensureActiveRole(roleId);
    await this.ensureActiveMenu(menuId);
    await this.policyService.assertAllowed(actor, 'roles:unassign_menu', {
      role_name: role.name,
    });

    await this.prisma.roleMenu.update({
      where: { roleId_menuId: { roleId, menuId } },
      data: { estado: Estado.INACTIVO, updatedBy: actor.sub },
    });

    return { success: true };
  }

  async assignPermission(
    roleId: string,
    permissionId: string,
    actor: AuthenticatedUser,
  ) {
    const role = await this.ensureActiveRole(roleId);
    const permission = await this.ensureActivePermission(permissionId);
    await this.policyService.assertAllowed(actor, 'roles:assign_permission', {
      role_name: role.name,
      permission_code: permission.code,
      permission_delegable: permission.delegable,
    });

    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: { estado: Estado.ACTIVO, updatedBy: actor.sub },
      create: { roleId, permissionId, createdBy: actor.sub },
    });
  }

  async unassignPermission(
    roleId: string,
    permissionId: string,
    actor: AuthenticatedUser,
  ) {
    const role = await this.ensureActiveRole(roleId);
    const permission = await this.ensureActivePermission(permissionId);
    await this.policyService.assertAllowed(actor, 'roles:unassign_permission', {
      role_name: role.name,
      permission_code: permission.code,
    });

    await this.prisma.rolePermission.update({
      where: { roleId_permissionId: { roleId, permissionId } },
      data: { estado: Estado.INACTIVO, updatedBy: actor.sub },
    });

    return { success: true };
  }

  private async ensureActiveRole(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return role;
  }

  private async ensureActiveUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
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
  }

  private async ensureActivePermission(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
    return permission;
  }
}
