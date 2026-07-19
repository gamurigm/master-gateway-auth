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
import { PolicyGuard } from '../common/policy/policy.guard';
import { RequirePermission } from '../common/policy/require-permission.decorator';
import { AssignMenuDto } from './dto/assign-menu.dto';
import { AssignModuleDto } from './dto/assign-module.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('roles:read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermission('roles:read')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermission('roles:create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('roles:update')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('roles:delete_soft')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.remove(id, user);
  }

  @Post(':id/users')
  @RequirePermission('roles:assign_user')
  assignUser(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignUser(id, dto.userId, user);
  }

  @Delete(':id/users/:userId')
  @RequirePermission('roles:unassign_user')
  unassignUser(
    @Param('id', UUIDv4) id: string,
    @Param('userId', UUIDv4) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignUser(id, userId, user);
  }

  @Post(':id/modules')
  @RequirePermission('roles:assign_module')
  assignModule(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignModule(id, dto.moduleId, user);
  }

  @Post(':id/menus')
  @RequirePermission('roles:assign_menu')
  assignMenu(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignMenu(id, dto.menuId, user);
  }

  @Post(':id/permissions')
  assignPermission(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignPermission(id, dto.permissionId, user);
  }

  @Delete(':id/modules/:moduleId')
  @RequirePermission('roles:unassign_module')
  unassignModule(
    @Param('id', UUIDv4) id: string,
    @Param('moduleId', UUIDv4) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignModule(id, moduleId, user);
  }

  @Delete(':id/menus/:menuId')
  @RequirePermission('roles:unassign_menu')
  unassignMenu(
    @Param('id', UUIDv4) id: string,
    @Param('menuId', UUIDv4) menuId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignMenu(id, menuId, user);
  }

  @Delete(':id/permissions/:permissionId')
  unassignPermission(
    @Param('id', UUIDv4) id: string,
    @Param('permissionId', UUIDv4) permissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignPermission(id, permissionId, user);
  }
}
