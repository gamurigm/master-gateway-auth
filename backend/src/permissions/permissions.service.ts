import { Injectable } from '@nestjs/common';
import { Estado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany({
      where: { estado: Estado.ACTIVO },
      orderBy: [{ resource: 'asc' }, { action: 'asc' }, { code: 'asc' }],
    });
  }
}
