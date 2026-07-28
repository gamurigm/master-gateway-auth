import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado, Permission, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';
const PROTECTED_SUPER_ADMIN_ROLES = new Set([SUPER_ADMIN_ROLE, 'SUPERADMIN']);
const PRIVILEGED_USER_ASSIGNMENT_ROLES = new Set([
  SUPER_ADMIN_ROLE,
  'SUPERADMIN',
  'ADMIN',
]);

type PermissionMutation = 'assign' | 'unassign';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateRoleDto, actorId: string, actorRoleName = '') {
    this.assertCanUseProtectedRoleName(dto.name, actorRoleName);

    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('El rol ya existe');
    }

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdBy: actorId,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(id);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    this.assertCanUseProtectedRoleName(dto.name, actorRoleName);

    return this.prisma.role.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
    });
  }

  async remove(id: string, actorId: string, actorRoleName = '') {
    const targetRole = await this.ensureActiveRole(id);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
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
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  async assignUser(
    roleId: string,
    userId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    this.assertCanAssignPrivilegedRole(targetRole, actorRoleName);
    await this.ensureActiveUser(userId);

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { userId, roleId, createdBy: actorId },
    });
  }

  async unassignUser(
    roleId: string,
    userId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    this.assertCanAssignPrivilegedRole(targetRole, actorRoleName);
    await this.ensureActiveUser(userId);

    await this.prisma.userRole.update({
      where: { userId_roleId: { userId, roleId } },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  async assignModule(
    roleId: string,
    moduleId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    await this.ensureActiveModule(moduleId);

    return this.prisma.roleModule.upsert({
      where: { roleId_moduleId: { roleId, moduleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { roleId, moduleId, createdBy: actorId },
    });
  }

  async assignMenu(
    roleId: string,
    menuId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    await this.ensureActiveMenu(menuId);

    return this.prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId, menuId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { roleId, menuId, createdBy: actorId },
    });
  }

  async unassignModule(
    roleId: string,
    moduleId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    await this.ensureActiveModule(moduleId);

    await this.prisma.roleModule.update({
      where: { roleId_moduleId: { roleId, moduleId } },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  async unassignMenu(
    roleId: string,
    menuId: string,
    actorId: string,
    actorRoleName = '',
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    this.assertCanManageProtectedRole(targetRole, actorRoleName);
    await this.ensureActiveMenu(menuId);

    await this.prisma.roleMenu.update({
      where: { roleId_menuId: { roleId, menuId } },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  async assignPermission(
    roleId: string,
    permissionId: string,
    actorId: string,
    actorRoleId: string,
    actorRoleName: string,
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    const targetPermission = await this.ensureActivePermission(permissionId);
    await this.assertCanMutateRolePermission({
      mutation: 'assign',
      actorRoleId,
      actorRoleName,
      targetRole,
      targetPermission,
    });

    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { roleId, permissionId, createdBy: actorId },
    });
  }

  async unassignPermission(
    roleId: string,
    permissionId: string,
    actorId: string,
    actorRoleId: string,
    actorRoleName: string,
  ) {
    const targetRole = await this.ensureActiveRole(roleId);
    const targetPermission = await this.ensureActivePermission(permissionId);
    await this.assertCanMutateRolePermission({
      mutation: 'unassign',
      actorRoleId,
      actorRoleName,
      targetRole,
      targetPermission,
    });

    await this.prisma.rolePermission.update({
      where: { roleId_permissionId: { roleId, permissionId } },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
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

  private async assertCanMutateRolePermission(params: {
    mutation: PermissionMutation;
    actorRoleId: string;
    actorRoleName: string;
    targetRole: Role;
    targetPermission: Permission;
  }) {
    if (params.targetRole.id === params.actorRoleId) {
      throw new ForbiddenException(
        'No puedes modificar permisos del rol con el que estas autenticado',
      );
    }

    if (this.isSuperAdminActor(params.actorRoleName)) {
      return;
    }

    if (this.isProtectedSuperAdminRole(params.targetRole.name)) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede modificar permisos de SUPER_ADMIN',
      );
    }

    const requiredPermission =
      params.mutation === 'assign'
        ? 'roles:assign_permission'
        : 'roles:unassign_permission';
    await this.ensureActorHasPermission(params.actorRoleId, requiredPermission);
    await this.ensureActorHasPermission(
      params.actorRoleId,
      params.targetPermission.code,
    );

    if (params.mutation === 'assign' && !params.targetPermission.delegable) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede asignar permisos no delegables',
      );
    }
  }

  private async ensureActorHasPermission(
    roleId: string,
    permissionCode: string,
  ) {
    const assignment = await this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        estado: Estado.ACTIVO,
        role: { estado: Estado.ACTIVO },
        permission: { code: permissionCode, estado: Estado.ACTIVO },
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        `Tu rol no tiene el permiso ${permissionCode}`,
      );
    }
  }

  private assertCanUseProtectedRoleName(
    roleName: string | undefined,
    actorRoleName: string,
  ) {
    if (!roleName || !this.isProtectedSuperAdminRole(roleName)) {
      return;
    }

    if (!this.isSuperAdminActor(actorRoleName)) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede crear o renombrar roles protegidos',
      );
    }
  }

  private assertCanAssignPrivilegedRole(role: Role, actorRoleName: string) {
    if (!this.isPrivilegedUserAssignmentRole(role.name)) {
      return;
    }

    if (!this.isSuperAdminActor(actorRoleName)) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede asignar o remover roles privilegiados',
      );
    }
  }
  private assertCanManageProtectedRole(role: Role, actorRoleName: string) {
    if (!this.isProtectedSuperAdminRole(role.name)) {
      return;
    }

    if (!this.isSuperAdminActor(actorRoleName)) {
      throw new ForbiddenException(
        'Solo SUPER_ADMIN puede modificar el rol SUPER_ADMIN',
      );
    }
  }

  private isSuperAdminActor(roleName: string) {
    return roleName === SUPER_ADMIN_ROLE;
  }

  private isPrivilegedUserAssignmentRole(roleName: string) {
    return PRIVILEGED_USER_ASSIGNMENT_ROLES.has(roleName.toUpperCase());
  }

  private isProtectedSuperAdminRole(roleName: string) {
    return PROTECTED_SUPER_ADMIN_ROLES.has(roleName);
  }
}
