import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
    return permission;
  }

  async create(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('El permiso ya existe');
    }

    return this.prisma.permission.create({ data: dto });
  }

  async update(id: string, dto: UpdatePermissionDto) {
    await this.ensureActive(id);
    return this.prisma.permission.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureActive(id);
    return this.prisma.permission.update({
      where: { id },
      data: { estado: Estado.INACTIVO },
    });
  }

  private async ensureActive(id: string) {
    const permission = await this.prisma.permission.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!permission) throw new NotFoundException('Permiso no encontrado');
  }
}
