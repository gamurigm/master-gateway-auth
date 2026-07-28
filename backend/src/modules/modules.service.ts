import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.systemModule.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const module = await this.prisma.systemModule.findFirst({
      where: { id, estado: Estado.ACTIVO },
      include: { menus: { where: { estado: Estado.ACTIVO } } },
    });

    if (!module) {
      throw new NotFoundException('Modulo no encontrado');
    }

    return module;
  }

  async create(dto: CreateModuleDto, actorId: string) {
    const existing = await this.prisma.systemModule.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('El codigo de modulo ya existe');
    }

    return this.prisma.systemModule.create({
      data: { ...dto, createdBy: actorId },
    });
  }

  async update(id: string, dto: UpdateModuleDto, actorId: string) {
    await this.ensureActive(id);
    return this.prisma.systemModule.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
    });
  }

  async remove(id: string, actorId: string) {
    await this.ensureActive(id);
    await this.prisma.$transaction(async (tx) => {
      const menus = await tx.menu.findMany({
        where: { moduleId: id, estado: Estado.ACTIVO },
        select: { id: true },
      });
      const menuIds = menus.map((menu) => menu.id);

      if (menuIds.length > 0) {
        await tx.roleMenu.updateMany({
          where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
          data: { estado: Estado.INACTIVO, updatedBy: actorId },
        });
        await tx.externalServiceRoute.updateMany({
          where: { menuId: { in: menuIds }, estado: Estado.ACTIVO },
          data: { estado: Estado.INACTIVO, updatedBy: actorId },
        });
      }

      await tx.menu.updateMany({
        where: { moduleId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
      await tx.roleModule.updateMany({
        where: { moduleId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
      await tx.systemModule.update({
        where: { id },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
    });

    return { success: true };
  }

  private async ensureActive(id: string) {
    const module = await this.prisma.systemModule.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!module) {
      throw new NotFoundException('Modulo no encontrado');
    }
  }
}
