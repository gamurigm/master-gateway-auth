import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { omitPassword } from '../common/utils/omit-password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';
const DEFAULT_USER_ROLE = 'USER';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { estado: Estado.ACTIVO },
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: {
            where: { estado: Estado.ACTIVO, role: { estado: Estado.ACTIVO } },
            include: { role: true },
          },
        },
      }),
      this.prisma.user.count({ where: { estado: Estado.ACTIVO } }),
    ]);

    return {
      items: items.map(omitPassword),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, estado: Estado.ACTIVO },
      include: {
        roles: { where: { estado: Estado.ACTIVO }, include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return omitPassword(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          passwordHash: await argon2.hash(dto.password, {
            type: argon2.argon2id,
          }),
          createdBy: actorId,
        },
      });

      const defaultRole = await tx.role.findFirst({
        where: { name: DEFAULT_USER_ROLE, estado: Estado.ACTIVO },
        select: { id: true },
      });

      if (!defaultRole) {
        throw new NotFoundException('Rol USER no encontrado');
      }

      await tx.userRole.upsert({
        where: {
          userId_roleId: { userId: createdUser.id, roleId: defaultRole.id },
        },
        update: { estado: Estado.ACTIVO, updatedBy: actorId },
        create: {
          userId: createdUser.id,
          roleId: defaultRole.id,
          estado: Estado.ACTIVO,
          createdBy: actorId,
        },
      });

      return createdUser;
    });

    return omitPassword(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    await this.ensureActive(id);
    const data: Record<string, unknown> = {
      updatedBy: actorId,
    };

    if (dto.email !== undefined) data.email = dto.email;
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.password !== undefined) {
      data.passwordHash = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return omitPassword(user);
  }

  async remove(id: string, actorId: string, actorRoleName = '') {
    await this.ensureActive(id);

    if (id === actorId) {
      throw new ForbiddenException('No puedes eliminar tu propio usuario');
    }

    if (actorRoleName === SUPER_ADMIN_ROLE) {
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.deleteMany({ where: { userId: id } });
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      });

      return { success: true };
    }

    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, revokedAt, updatedBy: actorId },
      });
      await tx.userRole.updateMany({
        where: { userId: id, estado: Estado.ACTIVO },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
      await tx.user.update({
        where: { id },
        data: { estado: Estado.INACTIVO, updatedBy: actorId },
      });
    });

    return { success: true };
  }

  private async ensureActive(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, estado: Estado.ACTIVO },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }
}
