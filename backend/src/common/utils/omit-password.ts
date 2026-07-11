type EntityWithPassword = {
  passwordHash?: string;
  [key: string]: unknown;
};

export function omitPassword<T extends EntityWithPassword>(entity: T) {
  const safeEntity = { ...entity };
  delete safeEntity.passwordHash;

  return safeEntity;
}
