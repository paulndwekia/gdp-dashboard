import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type JsonRecord = Record<string, any>;
type Observation = {
  code: string;
  name: string;
  year: number;
  gdp: number;
  isAggregate?: boolean;
  realGrowth?: number | null;
};

const WORLD_BANK_INDICATOR = "NY.GDP.MKTP.CD";
const IMF_BASE = "https://www.imf.org/external/datamapper/api/v2";
const REFRESH_SECONDS = 6 * 60 * 60;

// Used only if the World Bank country catalogue is temporarily unavailable.
const KNOWN_AGGREGATE_CODES = new Set([
  "AFE", "AFW", "ARB", "CEB", "CSS", "EAP", "EAS", "ECS", "EMU", "EUU",
  "FCS", "HIC", "IBD", "IBT", "IDA", "IDB", "IDX", "LAC", "LCN", "LDC",
  "LIC", "LMC", "LMY", "MEA", "MIC", "MNA", "NAC", "OED", "OSS", "PRE",
  "PSS", "PST", "SAS", "SSA", "SSF", "SST", "TEA", "TEC", "TLA", "TMN",
  "TSA", "TSS", "UMC", "WLD",
]);

async function getJson(url: string, forceRefresh: boolean, revalidate = REFRESH_SECONDS, timeoutMs = 20000) {
  // IMF's DataMapper edge rejects Node/Undici's default User-Agent from some
  // cloud regions. A normal browser-style UA and JSON Accept header are used
  // consistently for public read-only source requests.
  const headers = {
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": "https://www.imf.org/external/datamapper/",
  };
  const response = await fetch(
    url,
    forceRefresh
      ? { cache: "no-store", headers, signal: AbortSignal.timeout(timeoutMs) }
      : { next: { revalidate }, headers, signal: AbortSignal.timeout(timeoutMs) }
  );
  if (!response.ok) {
    throw new Error(`Source request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function labelForCountry(meta: unknown, fallback: string) {
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  if (meta && typeof meta === "object") {
    const value = meta as JsonRecord;
    return String(value.label || value.name || value.description || fallback);
  }
  return fallback;
}

function indicatorMetadata(payload: unknown, indicator: string) {
  if (!payload || typeof payload !== "object") return undefined;
  const root = payload as JsonRecord;
  return root.indicators?.[indicator] || root.data?.indicators?.[indicator] || root[indicator];
}

function sourceEdition(meta: unknown) {
  if (!meta || typeof meta !== "object") return "IMF World Economic Outlook vintage";
  const value = meta as JsonRecord;
  const text = [
    value.source,
    value.dataset,
    value.edition,
    value.description,
    value.label,
  ].map((part) => typeof part === "string" ? part : JSON.stringify(part || "")).join(" ");
  const match = text.match(/(April|October)\s+20\d{2}/i);
  return match ? `${match[1]} ${match[0].split(/\s+/).pop()} World Economic Outlook` : String(value.source || "IMF World Economic Outlook vintage");
}

function extractImfSdmxValues(payload: unknown, indicator: string): Record<string, Record<string, number>> {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as JsonRecord;
  const message = (root.data || root) as JsonRecord;
  const dataset = message.dataSets?.[0] as JsonRecord | undefined;
  const structure = message.structures?.[0] as JsonRecord | undefined;
  const dimensions = structure?.dimensions?.series as JsonRecord[] | undefined;
  const periods = structure?.dimensions?.observation?.[0]?.values as JsonRecord[] | undefined;
  const series = dataset?.series as Record<string, JsonRecord> | undefined;
  if (!Array.isArray(dimensions) || !Array.isArray(periods) || !series) return {};

  const countryPosition = dimensions.findIndex((dimension) => dimension.id === "COUNTRY");
  const indicatorPosition = dimensions.findIndex((dimension) => dimension.id === "INDICATOR");
  if (countryPosition < 0 || indicatorPosition < 0) return {};

  const values: Record<string, Record<string, number>> = {};
  for (const [key, row] of Object.entries(series)) {
    const indexes = key.split(":").map(Number);
    const countryCode = String(dimensions[countryPosition]?.values?.[indexes[countryPosition]]?.id || "").toUpperCase();
    const indicatorCode = String(dimensions[indicatorPosition]?.values?.[indexes[indicatorPosition]]?.id || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(countryCode) || indicatorCode !== indicator) continue;

    const observations = row?.observations as Record<string, unknown[]> | undefined;
    if (!observations) continue;
    for (const [periodIndex, tuple] of Object.entries(observations)) {
      const period = periods[Number(periodIndex)];
      const year = String(period?.value || period?.id || "");
      const value = Number(Array.isArray(tuple) ? tuple[0] : tuple);
      if (!/^\\d{4}$/.test(year) || !Number.isFinite(value)) continue;
      (values[countryCode] ||= {})[year] = value;
    }
  }
  return values;
}

function countryLabel(payload: unknown, code: string, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const root = payload as JsonRecord;
  const entry = root.countries?.[code] || root.data?.countries?.[code] || root[code];
  return labelForCountry(entry, fallback);
}

async function fetchWorldBankSeries(forceRefresh: boolean) {
  const rows: Observation[] = [];
  let lastUpdated: string | null = null;
  const pageSize = 3000;

  const fetchPage = async (page: number) => {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${WORLD_BANK_INDICATOR}?format=json&per_page=${pageSize}&date=1960:2035&source=2&page=${page}`;
    return getJson(url, forceRefresh);
  };

  const [firstPayload, countryCatalogPayload] = await Promise.all([
    fetchPage(1),
    getJson("https://api.worldbank.org/v2/country?format=json&per_page=400", forceRefresh, 86400, 8000).catch(() => null),
  ]);
  if (!Array.isArray(firstPayload) || !Array.isArray(firstPayload[1])) {
    throw new Error("World Bank returned an unexpected GDP response.");
  }

  const aggregateCodes = new Set<string>(KNOWN_AGGREGATE_CODES);
  if (Array.isArray(countryCatalogPayload) && Array.isArray(countryCatalogPayload[1])) {
    for (const country of countryCatalogPayload[1] as JsonRecord[]) {
      const code = String(country.id || "").trim().toUpperCase();
      // World Bank assigns region "NA" to regional, income and other aggregate groups.
      if (/^[A-Z0-9]{3}$/.test(code) && String(country.region?.id || "").toUpperCase() === "NA") {
        aggregateCodes.add(code);
      } else if (/^[A-Z0-9]{3}$/.test(code)) {
        aggregateCodes.delete(code);
      }
    }
  }

  const firstMeta = firstPayload[0] as JsonRecord;
  const totalPages = Math.max(1, Number(firstMeta.pages) || 1);
  if (totalPages > 12) {
    throw new Error(`World Bank GDP feed returned an unexpected ${totalPages}-page response; refusing to publish a partial extract.`);
  }
  lastUpdated = firstMeta.lastupdated || null;

  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => fetchPage(index + 2))
  );
  const payloads = [firstPayload, ...remainingPages];

  for (const payload of payloads) {
    if (!Array.isArray(payload) || !Array.isArray(payload[1])) {
      throw new Error("World Bank returned an incomplete GDP page.");
    }
    const metadata = payload[0] as JsonRecord;
    lastUpdated = metadata.lastupdated || lastUpdated;
    rows.push(...(payload[1] as JsonRecord[]).flatMap((record) => {
      const code = String(record.countryiso3code || "").trim().toUpperCase();
      const name = String(record.country?.value || "").trim();
      const year = Number(record.date);
      const gdp = record.value === null || record.value === undefined ? NaN : Number(record.value);
      const observationStatus = String(record.obs_status || "").toUpperCase();
      if (observationStatus === "F" || !code || !name || !Number.isInteger(year) || !Number.isFinite(gdp) || gdp <= 0) return [];
      return [{ code, name, year, gdp, isAggregate: aggregateCodes.has(code) }];
    }));
  }

  if (!rows.length) throw new Error("World Bank returned no usable GDP observations.");
  return {
    rows: rows.sort((a, b) => a.code.localeCompare(b.code) || a.year - b.year),
    lastUpdated,
    aggregateCodes,
  };
}
async function readBundledFallback(): Promise<Observation[]> {
  const filePath = path.join(process.cwd(), "data", "gdp_data.csv");
  const csv = await readFile(filePath, "utf8");
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
  }) as JsonRecord[];

  const years = Object.keys(records[0] || {})
    .filter((key) => /^\d{4}$/.test(key))
    .map(Number)
    .sort((a, b) => a - b);

  return records.flatMap((record) => {
    const code = String(record["Country Code"] || "").trim().toUpperCase();
    const name = String(record["Country Name"] || "").trim();
    if (!code || !name) return [];
    return years.flatMap((year) => {
      const raw = record[String(year)];
      if (raw === undefined || raw === null || raw === "") return [];
      const gdp = Number(raw);
      return Number.isFinite(gdp) && gdp > 0
        ? [{ code, name, year, gdp, isAggregate: KNOWN_AGGREGATE_CODES.has(code) }]
        : [];
    });
  });
}

function extractImfValues(payload: unknown, indicator: string) {
  if (!payload || typeof payload !== "object") return {} as Record<string, Record<string, number>>;
  const values = (payload as JsonRecord).values;
  const series = values && values[indicator];
  return series && typeof series === "object"
    ? series as Record<string, Record<string, number>>
    : {};
}

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  const warnings: string[] = [];
  let series: Observation[] = [];
  let worldBankStatus: "live" | "fallback" = "live";
  let worldBankLastUpdated: string | null = null;

  const worldBankPromise = fetchWorldBankSeries(forceRefresh)
    .then((liveWorldBank) => {
      series = liveWorldBank.rows;
      worldBankLastUpdated = liveWorldBank.lastUpdated;
    })
    .catch(async (error) => {
      worldBankStatus = "fallback";
      warnings.push(error instanceof Error ? error.message : "World Bank data could not be reached.");
      series = await readBundledFallback();
    });

  // The Outlook panel only uses the latest estimate and forward projection years.
  // Requesting just this compact window reduces cold-start payload size and provider latency.
  const currentYear = new Date().getUTCFullYear();
  const imfPeriods = Array.from({ length: 7 }, (_, index) => currentYear - 1 + index).join(",");
  const imfPeriodQuery = `?startPeriod=${currentYear - 1}&endPeriod=${currentYear + 5}&format=jsondata`;
  const imfPromise = Promise.allSettled([
    getJson(`https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/+/*.NGDPD.A${imfPeriodQuery}`, forceRefresh, REFRESH_SECONDS, 30000),
    getJson(`https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/+/*.NGDP_RPCH.A${imfPeriodQuery}`, forceRefresh, REFRESH_SECONDS, 30000),
  ]);

  const [, imfResults] = await Promise.all([worldBankPromise, imfPromise]);
  const [imfGdpResult, imfGrowthResult] = imfResults;

  let outlook: Observation[] = [];
  let imfEdition = "IMF World Economic Outlook · SDMX 3.0";
  let imfLastModified: string | null = null;
  let imfStatus: "live" | "unavailable" = "unavailable";

  if (imfGdpResult.status === "fulfilled") {
    const gdpValues = extractImfSdmxValues(imfGdpResult.value, "NGDPD");
    const growthValues = imfGrowthResult.status === "fulfilled"
      ? extractImfSdmxValues(imfGrowthResult.value, "NGDP_RPCH")
      : {};

    if (imfGrowthResult.status === "rejected") {
      warnings.push("IMF real GDP growth values could not be retrieved; nominal GDP estimates and projections are shown without the companion real-growth measure.");
    }

    if (Object.keys(gdpValues).length > 0) {
      imfStatus = "live";
      const latestWorldBankYear = new Map<string, number>();
      const worldBankNames = new Map<string, string>();
      const actualCountryCodes = new Set<string>();
      for (const row of series) {
        latestWorldBankYear.set(row.code, Math.max(latestWorldBankYear.get(row.code) || 0, row.year));
        worldBankNames.set(row.code, row.name);
        if (!row.isAggregate) actualCountryCodes.add(row.code);
      }

      outlook = Object.entries(gdpValues).flatMap(([rawCode, annualValues]) => {
        const code = rawCode.toUpperCase();
        if (!/^[A-Z]{3}$/.test(code) || !actualCountryCodes.has(code) || !annualValues || typeof annualValues !== "object") return [];
        const name = worldBankNames.get(code) || code;
        return Object.entries(annualValues).flatMap(([rawYear, rawValue]) => {
          const year = Number(rawYear);
          const currentUsd = Number(rawValue);
          const latestReported = latestWorldBankYear.get(code);
          if (!latestReported || !Number.isInteger(year) || year <= latestReported || !Number.isFinite(currentUsd) || currentUsd <= 0) return [];
          const growth = Number(growthValues?.[code]?.[rawYear]);
          return [{
            code,
            name,
            year,
            // IMF SDMX WEO NGDPD is already expressed in current US dollars.
            gdp: currentUsd,
            realGrowth: Number.isFinite(growth) ? growth : null,
            isAggregate: false,
          }];
        });
      }).sort((a, b) => a.code.localeCompare(b.code) || a.year - b.year);

      if (!outlook.length) {
        warnings.push("The IMF WEO feed responded, but did not return estimates or projections beyond the latest World Bank reported years.");
      }
    } else {
      warnings.push("The IMF WEO SDMX endpoint responded without a usable NGDPD country series.");
    }
  } else {
    const imfGdpError = imfGdpResult.reason instanceof Error ? imfGdpResult.reason.message : "Unknown source error";
    warnings.push("IMF World Economic Outlook request failed: " + imfGdpError);
  }

  const years = series.map((row) => row.year);
  const lastYear = Math.max(...years);
  const latestOutlookYear = outlook.length ? Math.max(...outlook.map((row) => row.year)) : null;
  return Response.json(
    {
      source: "World Bank Open Data",
      indicator: WORLD_BANK_INDICATOR,
      unit: "current US dollars",
      firstYear: Math.min(...years),
      lastYear,
      series,
      outlook,
      outlookSource: "International Monetary Fund · World Economic Outlook",
      outlookIndicator: "NGDPD",
      outlookUnit: "billions of current US dollars, converted to US dollars",
      outlookEdition: imfEdition,
      outlookLastYear: latestOutlookYear,
      growthIndicator: "NGDP_RPCH",
      growthDefinition: "Real GDP growth, annual percent change",
      updatedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      worldBankLastUpdated,
      imfLastModified,
      refreshIntervalHours: REFRESH_SECONDS / 3600,
      worldBankStatus,
      imfStatus,
      warnings,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
