import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequireRoles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { PolicyGuard } from '../common/policy/policy.guard';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsService } from './permissions.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@RequireRoles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PolicyGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions('permissions:read')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('permissions:read')
  findOne(@Param('id', UUIDv4) id: string) {
    return this.permissionsService.findOne(id);
  }

  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('permissions:write')
  @Post()
  create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('permissions:write')
  @Put(':id')
  update(@Param('id', UUIDv4) id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @RequireRoles('SUPER_ADMIN')
  @RequirePermissions('permissions:delete')
  @Delete(':id')
  remove(@Param('id', UUIDv4) id: string) {
    return this.permissionsService.remove(id);
  }
}
