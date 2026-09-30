import { TransformFnParams } from 'class-transformer';

/** Trims strings; turns blank optional strings into undefined. */
export const trimToUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** Trims strings but keeps "" so @IsNotEmpty can reject it. */
export const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;
