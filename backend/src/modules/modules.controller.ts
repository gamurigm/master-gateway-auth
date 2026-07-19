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
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ModulesService } from './modules.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @RequirePermission('modules:read')
  findAll() {
    return this.modulesService.findAll();
  }

  @Get(':id')
  @RequirePermission('modules:read')
  findOne(@Param('id', UUIDv4) id: string) {
    return this.modulesService.findOne(id);
  }

  @Post()
  @RequirePermission('modules:create')
  create(@Body() dto: CreateModuleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.modulesService.create(dto, user.sub);
  }

  @Put(':id')
  @RequirePermission('modules:update')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermission('modules:delete_soft')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.modulesService.remove(id, user.sub);
  }
}
