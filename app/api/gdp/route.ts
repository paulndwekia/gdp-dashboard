import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export const revalidate = 86400;

type SourceRow = Record<string, string>;

export async function GET() {
  const filePath = path.join(process.cwd(), "data", "gdp_data.csv");
  const csv = await readFile(filePath, "utf8");
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
  }) as SourceRow[];

  if (!records.length) {
    return Response.json({ error: "The GDP source file is empty." }, { status: 500 });
  }

  const years = Object.keys(records[0])
    .filter((key) => /^\d{4}$/.test(key))
    .map(Number)
    .sort((a, b) => a - b);

  const series = records.flatMap((record) => {
    const code = String(record["Country Code"] || "").trim().toUpperCase();
    const name = String(record["Country Name"] || "").trim();

    if (!code || !name) return [];

    return years.flatMap((year) => {
      const raw = record[String(year)];
      if (raw === undefined || raw === null || raw === "") return [];
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return [];
      return [{ code, name, year, gdp: value }];
    });
  });

  return Response.json(
    {
      source: "World Bank Open Data",
      indicator: "NY.GDP.MKTP.CD",
      unit: "current US dollars",
      firstYear: years[0],
      lastYear: years[years.length - 1],
      series,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}