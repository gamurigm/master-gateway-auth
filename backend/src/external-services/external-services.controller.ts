import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { RequireRoles } from '../common/auth/roles.decorator';
import { RolesGuard } from '../common/auth/roles.guard';
import { CreateExternalServiceDto } from './dto/create-external-service.dto';
import { ProbeServiceDto } from './dto/probe-service.dto';
import { ProvisionServiceDto } from './dto/provision-service.dto';
import { UpdateExternalServiceDto } from './dto/update-external-service.dto';
import { ExternalServicesService } from './external-services.service';

const UUIDv4 = new ParseUUIDPipe({ version: '4' });

@RequireRoles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('external-services')
export class ExternalServicesController {
  constructor(
    private readonly externalServicesService: ExternalServicesService,
  ) {}

  @Get()
  findAll() {
    return this.externalServicesService.findAll();
  }

  /**
   * Comprueba la disponibilidad de un servicio SIN registrarlo.
   *
   * Throttle propio y estricto: provoca peticiones salientes desde el Master,
   * asi que un limite alto lo convertiria en un escaner de puertos de la red
   * interna.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('probe')
  @HttpCode(HttpStatus.OK)
  probe(@Body() dto: ProbeServiceDto) {
    return this.externalServicesService.probe(dto);
  }

  @Get(':id')
  findOne(@Param('id', UUIDv4) id: string) {
    return this.externalServicesService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateExternalServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalServicesService.create(dto, user.sub);
  }

  /** Re-verifica un servicio ya registrado y persiste el resultado. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/probe')
  @HttpCode(HttpStatus.OK)
  probeExisting(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalServicesService.probeExisting(id, user.sub);
  }

  /** Genera modulo, menus y asignaciones de rol para el servicio. */
  @Post(':id/provision')
  provision(
    @Param('id', UUIDv4) id: string,
    @Body() dto: ProvisionServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalServicesService.provision(id, dto, user.sub);
  }

  @Put(':id')
  update(
    @Param('id', UUIDv4) id: string,
    @Body() dto: UpdateExternalServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalServicesService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(
    @Param('id', UUIDv4) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.externalServicesService.remove(id, user.sub);
  }
}
