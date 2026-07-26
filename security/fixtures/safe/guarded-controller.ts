// FIXTURE SEGURO - contraparte correcta de vulnerable/missing-authorization.ts
// No debe producir ningun hallazgo.
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../backend/src/common/auth/jwt-auth.guard';
import { RolesGuard } from '../../../backend/src/common/auth/roles.guard';
import { RequireRoles } from '../../../backend/src/common/auth/roles.decorator';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireRoles('ADMIN')
export class GuardedUsersController {
  @Get()
  findAll() {
    return { users: [] };
  }

  @Post()
  create(@Body() payload: unknown) {
    return payload;
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return { removed: id };
  }
}
