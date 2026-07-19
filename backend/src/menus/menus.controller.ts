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
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get('tree')
  tree(@CurrentUser() user: AuthenticatedUser) {
    return this.menusService.treeForRole(user.roleId);
  }

  @Get()
  @RequirePermission('menus:read')
  findAll() {
    return this.menusService.findAll();
  }

  @Post()
  @RequirePermission('menus:create')
  create(@Body() dto: CreateMenuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.menusService.create(dto, user.sub);
  }

  @Put(':id')
  @RequirePermission('menus:update')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menusService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('menus:delete_soft')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menusService.remove(id, user.sub);
  }
}
