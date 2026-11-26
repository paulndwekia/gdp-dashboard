import { NextResponse } from "next/server";
import type { Country } from "@/lib/types";

export async function GET() {
  try {
    const response = await fetch("https://api.worldbank.org/v2/country?format=json&per_page=400", {
      headers: { Accept: "application/json", "User-Agent": "GDP-Atlas/1.0" },
      next: { revalidate: 604800 },
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      return NextResponse.json({ error: "The country directory is temporarily unavailable." }, { status: 502 });
    }

    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      return NextResponse.json({ error: "The country directory returned an unexpected response." }, { status: 502 });
    }

    const countries: Country[] = payload[1]
      .filter((item: Record<string, unknown>) => {
        const region = item.region as Record<string, unknown> | undefined;
        return typeof item.id === "string" && /^[A-Z0-9]{3}$/.test(item.id) && region?.id !== "NA";
      })
      .map((item: Record<string, unknown>) => {
        const region = item.region as Record<string, unknown>;
        const income = item.incomeLevel as Record<string, unknown> | undefined;
        return {
          code: String(item.id),
          iso2Code: String(item.iso2Code ?? ""),
          name: String(item.name ?? item.id),
          regionCode: String(region.id),
          region: String(region.value),
          incomeLevel: String(income?.value ?? "Not classified"),
          capitalCity: String(item.capitalCity ?? "")
        };
      })
      .sort((a: Country, b: Country) => a.name.localeCompare(b.name));

    const result = NextResponse.json({ countries, source: "World Bank country metadata" });
    result.headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return result;
  } catch {
    return NextResponse.json({ error: "Could not reach the World Bank country directory." }, { status: 502 });
  }
}