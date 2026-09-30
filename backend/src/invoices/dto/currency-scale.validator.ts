import { registerDecorator, ValidationArguments } from 'class-validator';
import { isSupportedCurrency, minorUnitsOf, type CurrencyCode } from '../domain/currency';
import { decimalPlacesOf } from '../domain/money';

/**
 * Amounts must not have more decimals than the invoice currency allows (ISO 4217 minor units):
 * 19.99 is fine for AUD, but VND has no minor units so 1000.50 VND is invalid.
 * Cross-field (needs the sibling `currency`), so it lives on the parent DTO.
 */

function fits(value: unknown, currency: CurrencyCode): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return true; // type rules report it
  return decimalPlacesOf(value) <= minorUnitsOf(currency);
}

function scaleMessage(path: string, currency: CurrencyCode): string {
  const units = minorUnitsOf(currency);
  return units === 0
    ? `${path} must be a whole number for ${currency} (no minor units)`
    : `${path} must have at most ${units} decimal places for ${currency}`;
}

const currencyOf = (args: ValidationArguments) => (args.object as { currency?: unknown }).currency;

/** For a single amount on the invoice, e.g. `discount`. */
export function FitsCurrencyScale(): PropertyDecorator {
  return (object: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'fitsCurrencyScale',
      target: object.constructor,
      propertyName: String(propertyName),
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const currency = currencyOf(args);
          return !isSupportedCurrency(currency) || fits(value, currency);
        },
        defaultMessage: (args: ValidationArguments) =>
          scaleMessage(args.property, currencyOf(args) as CurrencyCode),
      },
    });
}

/** For every line item's `rate`. */
export function ItemRatesFitCurrencyScale(): PropertyDecorator {
  const firstBadIndex = (items: unknown, currency: CurrencyCode) =>
    Array.isArray(items)
      ? items.findIndex((item: { rate?: unknown }) => !fits(item?.rate, currency))
      : -1;

  return (object: object, propertyName: string | symbol) =>
    registerDecorator({
      name: 'itemRatesFitCurrencyScale',
      target: object.constructor,
      propertyName: String(propertyName),
      validator: {
        validate: (items: unknown, args: ValidationArguments) => {
          const currency = currencyOf(args);
          return !isSupportedCurrency(currency) || firstBadIndex(items, currency) === -1;
        },
        defaultMessage: (args: ValidationArguments) => {
          const currency = currencyOf(args) as CurrencyCode;
          return scaleMessage(
            `${args.property}.${firstBadIndex(args.value, currency)}.rate`,
            currency,
          );
        },
      },
    });
}
