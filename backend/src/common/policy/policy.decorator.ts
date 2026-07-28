import { SetMetadata } from '@nestjs/common';

export const POLICY_ACTION_KEY = 'policy:action';
export const POLICY_RESOURCE_KEY = 'policy:resource';

export const Policy = (action: string, resource?: string) =>
  SetMetadata(POLICY_ACTION_KEY, { action, resource: resource ?? '' });
