type EntityWithPassword = {
  passwordHash?: string;
  [key: string]: unknown;
};

export function omitPassword<T extends EntityWithPassword>(entity: T) {
  const { passwordHash: _passwordHash, ...safeEntity } = entity;
  return safeEntity;
}
