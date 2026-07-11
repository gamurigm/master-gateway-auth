import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

export type RequestWithUser = Request & {
  requestId?: string;
  user?: AuthenticatedUser;
};
