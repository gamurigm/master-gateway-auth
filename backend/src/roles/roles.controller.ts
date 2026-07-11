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
import { RequireRoles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { AssignMenuDto } from './dto/assign-menu.dto';
import { AssignModuleDto } from './dto/assign-module.dto';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@RequireRoles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.create(dto, user.sub);
  }

  @Put(':id')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id', UUIDv4) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.remove(id, user.sub);
  }

  @Post(':id/users')
  assignUser(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignUser(id, dto.userId, user.sub);
  }

  @Delete(':id/users/:userId')
  unassignUser(
    @Param('id', UUIDv4) id: string,
    @Param('userId', UUIDv4) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignUser(id, userId, user.sub);
  }

  @Post(':id/modules')
  assignModule(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignModule(id, dto.moduleId, user.sub);
  }

  @Post(':id/menus')
  assignMenu(
    @Param('id', UUIDv4) id: string,
    @Body() dto: AssignMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.assignMenu(id, dto.menuId, user.sub);
  }

  @Delete(':id/modules/:moduleId')
  unassignModule(
    @Param('id', UUIDv4) id: string,
    @Param('moduleId', UUIDv4) moduleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignModule(id, moduleId, user.sub);
  }

  @Delete(':id/menus/:menuId')
  unassignMenu(
    @Param('id', UUIDv4) id: string,
    @Param('menuId', UUIDv4) menuId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rolesService.unassignMenu(id, menuId, user.sub);
  }
}
