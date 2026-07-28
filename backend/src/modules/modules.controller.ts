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
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RequirePermissions } from '../common/auth/permissions.decorator';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequireRoles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { PolicyGuard } from '../common/policy/policy.guard';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModulesService } from './modules.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@RequireRoles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PolicyGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @RequirePermissions('modules:read')
  findAll() {
    return this.modulesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('modules:read')
  findOne(@Param('id', UUIDv4) id: string) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @RequirePermissions('modules:write')
  create(@Body() dto: CreateModuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.modulesService.create(dto, user.sub);
  }

  @Put(':id')
  @RequirePermissions('modules:write')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissions('modules:delete')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.remove(id, user.sub);
  }
}
