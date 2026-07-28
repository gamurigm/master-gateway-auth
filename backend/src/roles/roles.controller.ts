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
import { AssignMenuDto } from './dto/assign-menu.dto';
import { AssignModuleDto } from './dto/assign-module.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@RequireRoles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, PolicyGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles:read')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermissions('roles:read')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions('roles:create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.create(dto, user.sub, user.roleName);
  }

  @Put(':id')
  @RequirePermissions('roles:write')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.update(id, dto, user.sub, user.roleName);
  }

  @Delete(':id')
  @RequirePermissions('roles:delete')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.remove(id, user.sub, user.roleName);
  }

  @Post(':id/users')
  @RequirePermissions('roles:assign_user')
  assignUser(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignUser(
      id,
      dto.userId,
      user.sub,
      user.roleName,
    );
  }

  @Delete(':id/users/:userId')
  @RequirePermissions('roles:unassign_user')
  unassignUser(
    @Param('id', UUIDv4) id: string,
    @Param('userId', UUIDv4) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignUser(id, userId, user.sub, user.roleName);
  }

  @Post(':id/modules')
  @RequirePermissions('roles:write')
  assignModule(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignModule(
      id,
      dto.moduleId,
      user.sub,
      user.roleName,
    );
  }

  @Post(':id/menus')
  @RequirePermissions('roles:write')
  assignMenu(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignMenu(
      id,
      dto.menuId,
      user.sub,
      user.roleName,
    );
  }

  @Delete(':id/modules/:moduleId')
  @RequirePermissions('roles:write')
  unassignModule(
    @Param('id', UUIDv4) id: string,
    @Param('moduleId', UUIDv4) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignModule(
      id,
      moduleId,
      user.sub,
      user.roleName,
    );
  }

  @Delete(':id/menus/:menuId')
  @RequirePermissions('roles:write')
  unassignMenu(
    @Param('id', UUIDv4) id: string,
    @Param('menuId', UUIDv4) menuId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignMenu(id, menuId, user.sub, user.roleName);
  }

  @Post(':id/permissions')
  @RequirePermissions('roles:assign_permission')
  assignPermission(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignPermission(
      id,
      dto.permissionId,
      user.sub,
      user.roleId,
      user.roleName,
    );
  }

  @Delete(':id/permissions/:permissionId')
  @RequirePermissions('roles:unassign_permission')
  unassignPermission(
    @Param('id', UUIDv4) id: string,
    @Param('permissionId', UUIDv4) permissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignPermission(
      id,
      permissionId,
      user.sub,
      user.roleId,
      user.roleName,
    );
  }
}
