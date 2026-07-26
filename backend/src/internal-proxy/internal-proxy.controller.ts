import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../common/auth/authenticated-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { InternalProxyService } from './internal-proxy.service';

@UseGuards(JwtAuthGuard)
@Controller('proxy')
export class InternalProxyController {
  constructor(private readonly internalProxyService: InternalProxyService) {}

  @All(':moduleCode/*')
  async proxyAll(
    @Param() params: Record<string, string | undefined>,
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const moduleCode = params['moduleCode'];
    if (!moduleCode) {
      res.status(400).json({ message: 'Codigo de modulo requerido' });
      return;
    }

    const wildcardPath = params['0'] ?? '';
    const queryIndex = wildcardPath.indexOf('?');
    const path =
      queryIndex !== -1 ? wildcardPath.slice(0, queryIndex) : wildcardPath;

    const method = req.method;
    const query = req.query as Record<string, unknown>;
    const headers = req.headers as Record<string, string>;
    const body = req.body as unknown;

    const result = await this.internalProxyService.proxyRequest(
      moduleCode,
      path,
      method,
      query,
      headers,
      body,
      user,
    );

    for (const [key, value] of Object.entries(result.headers)) {
      res.setHeader(key, value);
    }

    res.status(result.status);

    if (typeof result.body === 'string') {
      res.send(result.body);
    } else {
      res.json(result.body);
    }
  }
}
