import { NextRequest, NextResponse } from "next/server";
import { INDICATORS, isIndicatorKey } from "@/lib/indicators";

const YEAR_PATTERN = /^[0-9]{4}(?::[0-9]{4})?$/;
const CODE_PATTERN = /^[A-Z0-9]{3}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = params.get("indicator") ?? "gdp";
  const countriesParam = (params.get("countries") ?? "WLD").trim();
  const latest = params.get("latest") === "true";
  const from = params.get("from") ?? "1960";
  const to = params.get("to") ?? String(new Date().getUTCFullYear());
  const date = params.get("date");

  if (!isIndicatorKey(key)) {
    return NextResponse.json({ error: "Unsupported economic indicator." }, { status: 400 });
  }

  let countryPath = "WLD";
  if (countriesParam.toLowerCase() === "all") {
    countryPath = "all";
  } else {
    const codes = countriesParam.split(/[;,]/).map((code) => code.trim().toUpperCase());
    if (codes.length < 1 || codes.length > 12 || codes.some((code) => !CODE_PATTERN.test(code))) {
      return NextResponse.json({ error: "Use between 1 and 12 valid three-character country or aggregate codes." }, { status: 400 });
    }
    countryPath = codes.join(";");
  }

  const dateRange = date ?? from + ":" + to;
  if (!latest && !YEAR_PATTERN.test(dateRange)) {
    return NextResponse.json({ error: "The year range must look like 1990 or 1990:2025." }, { status: 400 });
  }
  if (!latest && dateRange.includes(":")) {
    const years = dateRange.split(":").map(Number);
    const startYear = years[0];
    const endYear = years[1];
    if (startYear > endYear || endYear - startYear > 100 || startYear < 1960 || endYear > new Date().getUTCFullYear()) {
      return NextResponse.json({ error: "Choose a valid range between 1960 and the current year, with a maximum span of 100 years." }, { status: 400 });
    }
  }

  const indicator = INDICATORS[key];
  const upstreamParams = new URLSearchParams({ format: "json", per_page: "20000" });
  if (latest) {
    upstreamParams.set("mrv", "1");
    upstreamParams.set("gapfill", "Y");
  } else {
    upstreamParams.set("date", dateRange);
  }

  const upstreamUrl = "https://api.worldbank.org/v2/country/" + countryPath + "/indicator/" + indicator.id + "?" + upstreamParams.toString();

  try {
    const response = await fetch(upstreamUrl, {
      headers: { Accept: "application/json", "User-Agent": "GDP-Atlas/1.0" },
      next: { revalidate: latest ? 21600 : 86400 },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      return NextResponse.json({ error: "The World Bank data service is temporarily unavailable." }, { status: 502 });
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      return NextResponse.json({ error: "The World Bank returned an unexpected data response." }, { status: 502 });
    }

    const records = payload[1]
      .filter((row: unknown) => {
        if (!row || typeof row !== "object") return false;
        const item = row as Record<string, unknown>;
        return typeof item.value === "number" && Number.isFinite(item.value);
      })
      .map((row: Record<string, unknown>) => {
        const country = row.country as Record<string, unknown> | undefined;
        const indicatorInfo = row.indicator as Record<string, unknown> | undefined;
        return {
          countryCode: String(country?.id ?? ""),
          country: String(country?.value ?? ""),
          year: Number(row.date),
          value: Number(row.value),
          indicatorCode: String(indicatorInfo?.id ?? indicator.id),
          indicator: String(indicatorInfo?.value ?? indicator.label),
          unit: indicator.unit
        };
      })
      .filter((row: { countryCode: string; year: number; value: number }) =>
        CODE_PATTERN.test(row.countryCode) && Number.isInteger(row.year) && Number.isFinite(row.value)
      );

    const result = NextResponse.json({
      indicator: { code: indicator.id, name: indicator.label, unit: indicator.unit },
      total: records.length,
      records,
      source: "World Bank, World Development Indicators"
    });
    result.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return result;
  } catch {
    return NextResponse.json({ error: "Could not reach the World Bank data service. Please retry shortly." }, { status: 502 });
  }
}