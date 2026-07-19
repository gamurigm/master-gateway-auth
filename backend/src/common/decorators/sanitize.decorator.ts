import { Transform } from 'class-transformer';

const CONTROL_CHARACTER_CODES = new Set([0, 8, 9, 10, 13, 26]);

function replaceControlCharacters(value: string): string {
  return [...value]
    .map((character) =>
      CONTROL_CHARACTER_CODES.has(character.charCodeAt(0)) ? ' ' : character,
    )
    .join('');
}

function sanitizeString(value: string): string {
  const withoutTags = value.trim().replace(/<[^>]*>/g, '');

  return replaceControlCharacters(withoutTags).replace(/\s+/g, ' ').trim();
}

export function Sanitize(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }): unknown => {
    if (typeof value === 'string') return sanitizeString(value);
    return value;
  });
}
