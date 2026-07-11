import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateRoleDto, actorId: string) {
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

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    await this.ensureActiveRole(id);
    return this.prisma.role.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
    });
  }

  async remove(id: string, actorId: string) {
    await this.ensureActiveRole(id);
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

  async assignUser(roleId: string, userId: string, actorId: string) {
    await this.ensureActiveRole(roleId);
    await this.ensureActiveUser(userId);

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { userId, roleId, createdBy: actorId },
    });
  }

  async unassignUser(roleId: string, userId: string, actorId: string) {
    await this.ensureActiveRole(roleId);
    await this.ensureActiveUser(userId);

    await this.prisma.userRole.update({
      where: { userId_roleId: { userId, roleId } },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  async assignModule(roleId: string, moduleId: string, actorId: string) {
    await this.ensureActiveRole(roleId);
    await this.ensureActiveModule(moduleId);

    return this.prisma.roleModule.upsert({
      where: { roleId_moduleId: { roleId, moduleId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { roleId, moduleId, createdBy: actorId },
    });
  }

  async assignMenu(roleId: string, menuId: string, actorId: string) {
    await this.ensureActiveRole(roleId);
    await this.ensureActiveMenu(menuId);

    return this.prisma.roleMenu.upsert({
      where: { roleId_menuId: { roleId, menuId } },
      update: { estado: Estado.ACTIVO, updatedBy: actorId },
      create: { roleId, menuId, createdBy: actorId },
    });
  }

  private async ensureActiveRole(id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');
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
}
