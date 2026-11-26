import { INDICATORS, type IndicatorKey } from "./indicators";

export function formatCompact(value: number, prefix = "") {
  const absolute = Math.abs(value);
  if (absolute >= 1e12) return prefix + (value / 1e12).toFixed(2) + "T";
  if (absolute >= 1e9) return prefix + (value / 1e9).toFixed(2) + "B";
  if (absolute >= 1e6) return prefix + (value / 1e6).toFixed(2) + "M";
  if (absolute >= 1e3) return prefix + (value / 1e3).toFixed(1) + "K";
  return prefix + new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

export function formatIndicatorValue(value: number, indicator: IndicatorKey) {
  if (indicator === "growth") return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) + "%";
  const prefix = indicator === "gdpPpp" || indicator === "perCapitaPpp" ? "I$" : "$";
  return formatCompact(value, prefix);
}

export function latestRecord<T extends { year: number; value: number }>(records: T[]) {
  return [...records].sort((a, b) => b.year - a.year)[0];
}

export function indicatorDescription(key: IndicatorKey) {
  return INDICATORS[key].description;
}