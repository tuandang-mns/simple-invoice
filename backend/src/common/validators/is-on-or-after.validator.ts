import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ISO_DATE_REGEX } from '../utils/date.util';

const isIsoDateString = (v: unknown): v is string =>
  typeof v === 'string' && ISO_DATE_REGEX.test(v);

/**
 * Cross-field rule: this date must be on or after another date property on the same object.
 * Both values are "YYYY-MM-DD" strings (lexicographic order == chronological order).
 * If either side is missing/invalid the rule passes — the field's own validators report that.
 */
@ValidatorConstraint({ name: 'isOnOrAfter', async: false })
export class IsOnOrAfterConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedProperty] = args.constraints as [string];
    const related = (args.object as Record<string, unknown>)[relatedProperty];
    // Only compare two well-formed dates; otherwise the fields' own format rules report the problem
    // (avoids a misleading "must be on or after" next to "must be in YYYY-MM-DD format").
    if (!isIsoDateString(value) || !isIsoDateString(related)) return true;
    return value >= related;
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedProperty] = args.constraints as [string];
    return `${args.property} must be on or after ${relatedProperty}`;
  }
}

export function IsOnOrAfter(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [property],
      validator: IsOnOrAfterConstraint,
    });
}
