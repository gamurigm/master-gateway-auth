// FIXTURE VULNERABLE - CWE-862 (Missing Authorization) - OWASP 2025 A01
// Regla esperada: TS-MISSING-AUTHZ
// NO USAR EN PRODUCCION.
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

// Sin @UseGuards(JwtAuthGuard) ni @RequireRoles('ADMIN'):
// cualquiera puede listar, crear y borrar usuarios.
@Controller('admin/users')
export class UnguardedUsersController {
  @Get()
  findAll() {
    return { users: [] };
  }

  @Post()
  create(@Body() payload: unknown) {
    return payload;
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return { removed: id };
  }
}
