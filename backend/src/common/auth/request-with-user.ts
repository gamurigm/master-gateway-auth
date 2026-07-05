import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

export type RequestWithUser = Request & {
  user?: AuthenticatedUser;
};

