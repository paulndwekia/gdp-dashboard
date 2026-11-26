import { cache } from "react";

type JsonRecord = Record<string, any>;
const WB_API = "https://api.worldbank.org/v2";
const YEARS_MAX = new Date().getUTCFullYear() + 5;
const CATALOG_PAGE_SIZE = 4000;

async function getJson(url: string, revalidate: number) {
  const response = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`World Bank request failed (${response.status}).`);
  return response.json();
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const getIndicatorCatalog = cache(async () => {
  const all: JsonRecord[] = [];
  let page = 1;
  let pages = 1;
  while (page <= pages && page <= 12) {
    const payload = await getJson(`${WB_API}/indicator?format=json&source=2&per_page=${CATALOG_PAGE_SIZE}&page=${page}`, 86400);
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error("The World Bank indicator catalogue returned an unexpected response.");
    }
    pages = Math.max(1, Number(payload[0]?.pages) || 1);
    all.push(...payload[1]);
    page += 1;
  }
  if (!all.length) throw new Error("The World Bank indicator catalogue is empty.");
  return all;
});

const getCountryCatalog = cache(async () => {
  const payload = await getJson(`${WB_API}/country?format=json&per_page=400`, 86400);
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error("The World Bank country catalogue returned an unexpected response.");
  }
  return (payload[1] as JsonRecord[])
    .flatMap((item) => {
      const code = cleanText(item.id).toUpperCase();
      const name = cleanText(item.name);
      if (!/^[A-Z]{3}$/.test(code) || !name || cleanText(item.region?.id) === "NA") return [];
      return [{ code, name, region: cleanText(item.region?.value) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

function scoreIndicator(item: JsonRecord, query: string) {
  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const id = cleanText(item.id).toLowerCase();
  const name = cleanText(item.name).toLowerCase();
  const note = cleanText(item.sourceNote).toLowerCase();
  const organization = cleanText(item.sourceOrganization).toLowerCase();
  const topics = (item.topics || []).map((topic: JsonRecord) => cleanText(topic.value).toLowerCase()).join(" ");
  const searchable = [name, id, note, organization, topics].join(" ");
  if (id === q) return 120;
  if (name === q) return 110;
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 90;
  if (id.includes(q)) return 80;
  if (tokens.length > 1 && tokens.every((token) => searchable.includes(token))) return 70;
  if (topics.includes(q)) return 65;
  if (note.includes(q)) return 45;
  if (organization.includes(q)) return 25;
  const matchedTokens = tokens.filter((token) => searchable.includes(token)).length;
  return matchedTokens ? Math.round(20 * matchedTokens / tokens.length) : 0;
}

async function searchIndicators(query: string) {
  const catalog = await getIndicatorCatalog();
  return catalog
    .map((item) => ({ item, score: scoreIndicator(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || cleanText(a.item.name).localeCompare(cleanText(b.item.name)))
    .slice(0, 40)
    .map(({ item }) => ({
      id: cleanText(item.id),
      name: cleanText(item.name),
      unit: cleanText(item.unit),
      source: cleanText(item.source?.value || item.source?.name),
      sourceNote: cleanText(item.sourceNote),
      sourceOrganization: cleanText(item.sourceOrganization),
      topics: (item.topics || []).map((topic: JsonRecord) => cleanText(topic.value)).filter(Boolean),
    }));
}

async function fetchIndicatorSeries(indicator: string, country: string, startYear: number, endYear: number) {
  const url = `${WB_API}/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=500&page=1&date=${startYear}:${endYear}&source=2`;
  const payload = await getJson(url, 21600);
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
    throw new Error("The World Bank returned an unexpected indicator response.");
  }
  const metadata = payload[0] as JsonRecord;
  const rows = payload[1] as JsonRecord[];
  return { rows, sourceUpdated: cleanText(metadata.lastupdated) || null };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = cleanText(params.get("q")).slice(0, 80);
  const indicator = cleanText(params.get("indicator")).toUpperCase();
  const country = cleanText(params.get("country") || "KEN").toUpperCase();
  const startYear = Number(params.get("start") || 1960);
  const endYear = Number(params.get("end") || YEARS_MAX);

  if (params.get("countries") === "1") {
    try {
      const countries = await getCountryCatalog();
      return Response.json({ countries, count: countries.length, retrievedAt: new Date().toISOString() }, {
        headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
      });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "The country catalogue could not be loaded.",
      }, { status: 502 });
    }
  }

  if (indicator) {
    if (!/^[A-Z0-9_.]{3,40}$/.test(indicator)) {
      return Response.json({ error: "That indicator code is not valid." }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(country)) {
      return Response.json({ error: "Choose a valid three-letter country code." }, { status: 400 });
    }
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) ||
        startYear < 1900 || endYear > YEARS_MAX || startYear > endYear) {
      return Response.json({ error: "Choose a valid year range." }, { status: 400 });
    }

    try {
      const [seriesResult, metaPayload] = await Promise.all([
        fetchIndicatorSeries(indicator, country, startYear, endYear),
        getJson(`${WB_API}/indicator/${encodeURIComponent(indicator)}?format=json&per_page=50&source=2`, 86400).catch(() => null),
      ]);
      const meta = Array.isArray(metaPayload) && Array.isArray(metaPayload[1])
        ? (metaPayload[1] as JsonRecord[]).find((item) => cleanText(item.id).toUpperCase() === indicator) || metaPayload[1][0]
        : null;

      const series = seriesResult.rows.flatMap((record) => {
        const code = cleanText(record.countryiso3code).toUpperCase() || country;
        const name = cleanText(record.country?.value) || country;
        const year = Number(record.date);
        const value = record.value === null || record.value === undefined ? NaN : Number(record.value);
        if (!Number.isInteger(year) || !Number.isFinite(value)) return [];
        const sourceFlag = cleanText(record.obs_status);
        return [{
          code, name, year, value,
          status: sourceFlag.toUpperCase() === "F"
            ? "Forecast (source flag F)"
            : sourceFlag ? "Flagged source observation (" + sourceFlag + ")" : "Reported source observation",
          footnote: sourceFlag,
        }];
      }).sort((a, b) => a.year - b.year);

      return Response.json({
        indicator: {
          id: indicator,
          name: cleanText(meta?.name) || indicator,
          unit: cleanText(meta?.unit),
          source: cleanText(meta?.source?.value) || "World Bank Open Data · World Development Indicators",
          sourceNote: cleanText(meta?.sourceNote),
          sourceOrganization: cleanText(meta?.sourceOrganization),
          topics: (meta?.topics || []).map((topic: JsonRecord) => cleanText(topic.value)).filter(Boolean),
        },
        country: { code: country, name: cleanText(series[0]?.name) || country },
        series,
        sourceUpdated: seriesResult.sourceUpdated,
        retrievedAt: new Date().toISOString(),
        firstYear: series.length ? Math.min(...series.map((row) => row.year)) : null,
        lastYear: series.length ? Math.max(...series.map((row) => row.year)) : null,
        observationCount: series.length,
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
    return Response.json({ query, count: results.length, results, retrievedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The indicator catalogue could not be searched.",
    }, { status: 502 });
  }
}
