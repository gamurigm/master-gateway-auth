import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { RequestWithUser } from '../common/auth/request-with-user';
import { ServiceProxyService } from './service-proxy.service';

@UseGuards(JwtAuthGuard)
@Controller('proxy')
export class ServiceProxyController {
  constructor(private readonly serviceProxyService: ServiceProxyService) {}

  @All('*path')
  async forward(@Req() request: RequestWithUser, @Res() response: Response) {
    const result = await this.serviceProxyService.forward(request);

    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value);
    }

    response.status(result.statusCode).send(result.body);
  }
}
