import Decimal from "decimal.js";

/**
 * Money.
 *
 * Non-negotiable #4: Decimal(14,2) on the server, decimal.js on the client.
 * Never Float, anywhere, ever (decision A10). Binary floating point cannot
 * represent 0.1, and a budget that is off by a centavo after enough additions
 * is a budget the user stops trusting.
 *
 * v1 is single-currency, but the currency code is stored on Account and
 * Transaction so multi-currency becomes a feature rather than a migration.
 */

/** ISO 4217. The app enforces a single value in v1. */
export const DEFAULT_CURRENCY = "PHP";

const SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  EUR: "€",
};

export type MoneyInput = string | number | Decimal;

/** Parses any wire representation into a Decimal at 2 decimal places. */
export function money(value: MoneyInput): Decimal {
  return new Decimal(value instanceof Decimal ? value : String(value)).toDecimalPlaces(2);
}

export function add(...values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((sum, v) => sum.plus(money(v)), new Decimal(0));
}

export function subtract(a: MoneyInput, b: MoneyInput): Decimal {
  return money(a).minus(money(b));
}

/** The wire/DB form: a fixed 2-decimal string. Never a JS number. */
export function toStorage(value: MoneyInput): string {
  return money(value).toFixed(2);
}

/**
 * Formats for display with a single currency symbol and thousands separators
 * (product spec §9). Whole amounts drop the decimals, matching the mockup's
 * "₱3,580" rather than "₱3,580.00".
 */
export function formatMoney(
  value: MoneyInput,
  currency: string = DEFAULT_CURRENCY,
): string {
  const amount = money(value);
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const negative = amount.isNegative();
  const absolute = amount.abs();
  const whole = absolute.isInteger();

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absolute.toNumber());

  return `${negative ? "−" : ""}${symbol}${formatted}`;
}

/**
 * Product spec §9: a negative balance must read as a warning state rather
 * than a bare negative number the user might skim past.
 */
export function isOverdrawn(value: MoneyInput): boolean {
  return money(value).isNegative();
}

/**
 * Progress of spend against a cap, clamped at the bottom but NOT at the top —
 * product spec §8 and §9 both want an overspend to read as over, not as a
 * full bar. Returns a 0..n fraction.
 */
export function progress(spent: MoneyInput, limit: MoneyInput): number {
  const cap = money(limit);
  if (cap.isZero() || cap.isNegative()) return 0;
  return Math.max(0, money(spent).dividedBy(cap).toNumber());
}
