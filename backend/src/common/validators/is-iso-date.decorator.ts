import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches, registerDecorator } from 'class-validator';
import { ISO_DATE_REGEX } from '../utils/date.util';

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2999;

/**
 * Plausibility window for business dates (same as the UI date filters); catches typos like
 * 20266-01-01 or 0202-01-01. Registered under its own name: class-validator keys constraints
 * by name, so a second @Matches would silently replace the format message.
 */
function IsPlausibleYear(): PropertyDecorator {
  return (object: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'isPlausibleYear',
      target: object.constructor,
      propertyName: String(propertyName),
      options: { message: `$property year must be between ${MIN_YEAR} and ${MAX_YEAR}` },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || !ISO_DATE_REGEX.test(value)) return true; // format rule reports it
          const year = Number(value.slice(0, 4));
          return year >= MIN_YEAR && year <= MAX_YEAR;
        },
      },
    });
}

/** A real calendar date in strict "YYYY-MM-DD" form (rejects 2026-02-30, timestamps, etc.). */
export function IsIsoDate() {
  return applyDecorators(
    Matches(ISO_DATE_REGEX, { message: '$property must be in YYYY-MM-DD format' }),
    IsISO8601({ strict: true }, { message: '$property must be a valid date' }),
    IsPlausibleYear(),
  );
}
