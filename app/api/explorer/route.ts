import { cache } from "react";

type JsonRecord = Record<string, any>;
const WB_API = "https://api.worldbank.org/v2";
const YEARS_MIN = 1960;
const YEARS_MAX = new Date().getUTCFullYear() + 5;

async function getJson(url: string, revalidate: number) {
  const response = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`World Bank request failed (${response.status}).`);
  return response.json();
}

const getIndicatorCatalog = cache(async () => {
  const all: JsonRecord[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 12) {
    const payload = await getJson(`${WB_API}/indicator?format=json&source=2&per_page=20000&page=${page}`, 86400);
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error("The World Bank indicator catalogue returned an unexpected response.");
    }
    pages = Math.max(1, Number(payload[0]?.pages) || 1);
    all.push(...payload[1]);
    page += 1;
  }
  return all;
});

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function scoreIndicator(item: JsonRecord, query: string) {
  const q = query.toLowerCase();
  const id = cleanText(item.id).toLowerCase();
  const name = cleanText(item.name).toLowerCase();
  const note = cleanText(item.sourceNote).toLowerCase();
  const topics = (item.topics || []).map((topic: JsonRecord) => cleanText(topic.value).toLowerCase()).join(" ");
  if (id === q) return 100;
  if (name === q) return 95;
  if (name.startsWith(q)) return 85;
  if (name.includes(q)) return 75;
  if (id.includes(q)) return 65;
  if (topics.includes(q)) return 55;
  if (note.includes(q)) return 25;
  return 0;
}

async function searchIndicators(query: string) {
  const catalog = await getIndicatorCatalog();
  const results = catalog
    .map((item) => ({ item, score: scoreIndicator(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || cleanText(a.item.name).localeCompare(cleanText(b.item.name)))
    .slice(0, 35)
    .map(({ item }) => ({
      id: cleanText(item.id),
      name: cleanText(item.name),
      unit: cleanText(item.unit),
      source: cleanText(item.source?.value || item.source?.name),
      sourceNote: cleanText(item.sourceNote),
      sourceOrganization: cleanText(item.sourceOrganization),
      topics: (item.topics || []).map((topic: JsonRecord) => cleanText(topic.value)).filter(Boolean),
    }));
  return results;
}

async function fetchIndicatorSeries(indicator: string, startYear: number, endYear: number) {
  const rows: JsonRecord[] = [];
  let page = 1;
  let pages = 1;
  let sourceUpdated: string | null = null;
  while (page <= pages && page <= 12) {
    const url = `${WB_API}/country/all/indicator/${encodeURIComponent(indicator)}?format=json&per_page=20000&page=${page}&date=${startYear}:${endYear}`;
    const payload = await getJson(url, 21600);
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error("The World Bank returned an unexpected indicator response.");
    }
    pages = Math.max(1, Number(payload[0]?.pages) || 1);
    sourceUpdated = cleanText(payload[0]?.lastupdated) || sourceUpdated;
    rows.push(...payload[1]);
    page += 1;
  }
  return { rows, sourceUpdated };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = cleanText(params.get("q")).slice(0, 80);
  const indicator = cleanText(params.get("indicator")).toUpperCase();
  const country = cleanText(params.get("country")).toUpperCase();
  const startYear = Number(params.get("start") || YEARS_MIN);
  const endYear = Number(params.get("end") || YEARS_MAX);

  if (indicator) {
    if (!/^[A-Z0-9_.]{3,40}$/.test(indicator)) {
      return Response.json({ error: "That indicator code is not valid." }, { status: 400 });
    }
    if (country && !/^[A-Z0-9]{2,5}$/.test(country)) {
      return Response.json({ error: "Use a valid country code." }, { status: 400 });
    }
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) ||
        startYear < 1900 || endYear > YEARS_MAX || startYear > endYear) {
      return Response.json({ error: "Choose a valid year range." }, { status: 400 });
    }

    try {
      const [seriesResult, metaPayload] = await Promise.all([
        fetchIndicatorSeries(indicator, startYear, endYear),
        getJson(`${WB_API}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=50`, 86400).catch(() => null),
      ]);
      const meta = Array.isArray(metaPayload) && Array.isArray(metaPayload[1]) ? metaPayload[1][0] : null;
      const series = seriesResult.rows.flatMap((record) => {
        const code = cleanText(record.countryiso3code).toUpperCase();
        const name = cleanText(record.country?.value);
        const year = Number(record.date);
        const value = record.value === null || record.value === undefined ? NaN : Number(record.value);
        if (!code || !name || !Number.isInteger(year) || !Number.isFinite(value)) return [];
        if (country && code !== country) return [];
        return [{
          code,
          name,
          year,
          value,
          status: cleanText(record.obs_status).toUpperCase() === "F"
            ? "Forecast (source flag F)"
            : cleanText(record.obs_status)
              ? "Flagged source observation (" + cleanText(record.obs_status) + ")"
              : "Reported source observation",
          footnote: cleanText(record.obs_status),
        }];
      }).sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));

      return Response.json({
        indicator: {
          id: indicator,
          name: cleanText(meta?.name) || indicator,
          unit: cleanText(meta?.unit),
          source: cleanText(meta?.source?.value) || "World Bank Open Data",
          sourceNote: cleanText(meta?.sourceNote),
          sourceOrganization: cleanText(meta?.sourceOrganization),
          topics: (meta?.topics || []).map((topic: JsonRecord) => cleanText(topic.value)).filter(Boolean),
        },
        series,
        sourceUpdated: seriesResult.sourceUpdated,
        retrievedAt: new Date().toISOString(),
        firstYear: series.length ? Math.min(...series.map((row) => row.year)) : null,
        lastYear: series.length ? Math.max(...series.map((row) => row.year)) : null,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "The indicator could not be loaded.",
      }, { status: 502 });
    }
  }

  if (query.length < 2) {
    return Response.json({ error: "Enter at least two letters to search the indicator catalogue." }, { status: 400 });
  }

  try {
    const results = await searchIndicators(query);
    return Response.json({
      query,
      count: results.length,
      results,
      retrievedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The indicator catalogue could not be searched.",
    }, { status: 502 });
  }
}
