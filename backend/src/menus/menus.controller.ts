import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RequireRoles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenusService } from './menus.service';

@UseGuards(JwtAuthGuard)
@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get('tree')
  tree(@CurrentUser() user: AuthenticatedUser) {
    return this.menusService.treeForRole(user.roleId);
  }

  @Get()
  @RequireRoles('ADMIN')
  @UseGuards(RolesGuard)
  findAll() {
    return this.menusService.findAll();
  }

  @Post()
  @RequireRoles('ADMIN')
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateMenuDto, @CurrentUser() user: AuthenticatedUser) {
    return this.menusService.create(dto, user.sub);
  }

  @Put(':id')
  @RequireRoles('ADMIN')
  @UseGuards(RolesGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menusService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequireRoles('ADMIN')
  @UseGuards(RolesGuard)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.menusService.remove(id, user.sub);
  }
}
