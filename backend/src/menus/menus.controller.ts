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
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@UseGuards(JwtAuthGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get('tree')
  tree(@CurrentUser() user: AuthenticatedUser) {
    return this.menusService.treeForRole(user.roleId, user.roleName);
  }

  @Get()
  @RequireRoles('ADMIN')
  @RequirePermissions('menus:read')
  @UseGuards(RolesGuard, PermissionsGuard, PolicyGuard)
  findAll() {
    return this.menusService.findAll();
  }

  // El formulario de edicion ya llamaba a GET /menus/:id, pero el endpoint no
  // existia: la peticion devolvia 404 y el formulario se quedaba vacio.
  // Declarado DESPUES de `tree` para que `/menus/tree` no se interprete como id.
  @Get(':id')
  @RequireRoles('ADMIN')
  @RequirePermissions('menus:read')
  @UseGuards(RolesGuard, PermissionsGuard, PolicyGuard)
  findOne(@Param('id', UUIDv4) id: string) {
    return this.menusService.findOne(id);
  }

  @Post()
  @RequireRoles('ADMIN')
  @RequirePermissions('menus:write')
  @UseGuards(RolesGuard, PermissionsGuard, PolicyGuard)
  create(@Body() dto: CreateMenuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.menusService.create(dto, user.sub);
  }

  @Put(':id')
  @RequireRoles('ADMIN')
  @RequirePermissions('menus:write')
  @UseGuards(RolesGuard, PermissionsGuard, PolicyGuard)
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menusService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequireRoles('ADMIN')
  @RequirePermissions('menus:delete')
  @UseGuards(RolesGuard, PermissionsGuard, PolicyGuard)
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menusService.remove(id, user.sub);
  }
}
