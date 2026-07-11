import { Transform } from 'class-transformer';

function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/<[^>]*>/g, '')
    .replace(/[\0\\b\\n\\r\\t\\x1a]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function Sanitize(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') return sanitizeString(value);
    return value;
  });
}
