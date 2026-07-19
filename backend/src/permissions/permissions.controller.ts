import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PolicyGuard } from '../common/policy/policy.guard';
import { RequirePermission } from '../common/policy/require-permission.decorator';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, PolicyGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermission('permissions:read')
  findAll() {
    return this.permissionsService.findAll();
  }
}
