// Stripe stores amounts in the smallest currency unit. Most currencies use 2
// decimals; a handful are zero-decimal. See:
// https://docs.stripe.com/currencies#zero-decimal
const ZERO_DECIMAL = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
  "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function toMajorUnits(amountMinor: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase())
    ? amountMinor
    : amountMinor / 100;
}

export function formatAmount(amountMinor: number, currency: string): string {
  const major = toMajorUnits(amountMinor, currency);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency.toUpperCase()}`;
  }
}
