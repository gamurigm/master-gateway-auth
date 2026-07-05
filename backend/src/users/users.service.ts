import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Estado } from '@prisma/client';
import * as argon2 from 'argon2';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { omitPassword } from '../common/utils/omit-password';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
      include: { roles: { where: { estado: Estado.ACTIVO }, include: { role: true } } },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return omitPassword(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
        createdBy: actorId,
      },
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
      data.passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    }

    const user = await this.prisma.user.update({ where: { id }, data });
    return omitPassword(user);
  }

  async remove(id: string, actorId: string) {
    await this.ensureActive(id);
    await this.prisma.user.update({
      where: { id },
      data: { estado: Estado.INACTIVO, updatedBy: actorId },
    });

    return { success: true };
  }

  private async ensureActive(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, estado: Estado.ACTIVO } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }
}
