const CURRENCY_DECIMALS: Record<string, number> = {
  TZS: 0,
  UGX: 0,
  KES: 2,
  RWF: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
};

/** Format a number as money, e.g. "Sh 125,000" for TZS. */
export function formatMoney(amount: number | null | undefined, currency = "TZS"): string {
  const value = Number(amount ?? 0);
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

/** Compact money for stat cards: 1.2M, 45k */
export function formatMoneyCompact(amount: number | null | undefined, currency = "TZS"): string {
  const value = Number(amount ?? 0);
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = `${currency === "TZS" ? "Sh" : currency} `;
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}k`;
  return `${sign}${prefix}${abs.toLocaleString()}`;
}

export function parseAmount(input: string): number {
  const n = Number(String(input).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
