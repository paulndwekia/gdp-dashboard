"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DataExplorer from "./components/DataExplorer";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Observation = {
  code: string;
  name: string;
  year: number;
  gdp: number;
  isAggregate?: boolean;
};

type OutlookObservation = Observation & { realGrowth?: number | null };
type Dataset = {
  source: string;
  indicator: string;
  unit: string;
  firstYear: number;
  lastYear: number;
  series: Observation[];
  outlook: OutlookObservation[];
  outlookSource: string;
  outlookIndicator: string;
  outlookUnit: string;
  outlookEdition: string;
  outlookLastYear: number | null;
  growthIndicator: string;
  growthDefinition: string;
  updatedAt: string;
  refreshIntervalHours: number;
  worldBankStatus: "live" | "fallback";
  imfStatus: "live" | "unavailable";
  worldBankLastUpdated: string | null;
  imfLastModified: string | null;
  checkedAt: string;
  warnings: string[];
};

type PageKey =
  | "Overview"
  | "Country profile"
  | "Compare economies"
  | "Regional monitor"
  | "Growth analytics"
  | "Data Explorer"
  | "Rankings"
  | "Forecast lab"
  | "Methodology";

const NAV: PageKey[] = [
  "Overview",
  "Country profile",
  "Compare economies",
  "Regional monitor",
  "Growth analytics",
  "Data Explorer",
  "Rankings",
  "Forecast lab",
  "Methodology",
];

const NAV_GROUPS: Array<{ label: string; items: PageKey[] }> = [
  {
    label: "RESEARCH",
    items: ["Overview", "Country profile", "Compare economies", "Regional monitor"],
  },
  {
    label: "ANALYSIS",
    items: ["Growth analytics", "Data Explorer", "Rankings"],
  },
  {
    label: "TOOLS & REFERENCE",
    items: ["Forecast lab", "Methodology"],
  },
];

const COLORS = ["#14804A", "#0D9488", "#2563EB", "#C05C4D", "#8B5CF6", "#65A30D", "#0891B2", "#DB2777"];
const AGGREGATES = new Set([
  "AFE", "AFW", "ARB", "CEB", "CSS", "EAP", "EAS", "ECS", "EMU", "EUU",
  "FCS", "HIC", "IBD", "IBT", "IDA", "IDB", "IDX", "LAC", "LCN", "LDC",
  "LIC", "LMC", "LMY", "MEA", "MIC", "MNA", "NAC", "OED", "OSS", "PRE",
  "PSS", "PST", "SAS", "SSA", "SSF", "SST", "TEA", "TEC", "TLA", "TMN",
  "TSA", "TSS", "UMC", "WLD",
]);
const REGION_NAMES: Record<string, string> = {
  AFE: "Africa Eastern & Southern",
  AFW: "Africa Western & Central",
  ARB: "Arab World",
  EAS: "East Asia & Pacific",
  ECS: "Europe & Central Asia",
  LCN: "Latin America & Caribbean",
  MEA: "Middle East & North Africa",
  NAC: "North America",
  SAS: "South Asia",
  SSF: "Sub-Saharan Africa",
  WLD: "World",
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return "$" + (value / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return "$" + (value / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return "$" + (value / 1e6).toFixed(1) + "M";
  return "$" + Math.round(value).toLocaleString("en-US");
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

function pctChange(current: number, previous: number) {
  return previous > 0 ? ((current / previous) - 1) * 100 : null;
}

function cagr(start: number, end: number, years: number) {
  if (years <= 0 || start <= 0 || end <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function latestByCode(rows: Observation[]) {
  const latest = new Map<string, Observation>();
  for (const row of rows) {
    const prior = latest.get(row.code);
    if (!prior || row.year > prior.year) latest.set(row.code, row);
  }
  return Array.from(latest.values());
}

function tickMoney(value: number) {
  if (Math.abs(value) >= 1e12) return "$" + (value / 1e12).toFixed(0) + "T";
  if (Math.abs(value) >= 1e9) return "$" + (value / 1e9).toFixed(0) + "B";
  if (Math.abs(value) >= 1e6) return "$" + (value / 1e6).toFixed(0) + "M";
  return value.toLocaleString("en-US");
}

function AppChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tooltip-year">{label}</div>
      {payload.map((item: any, index: number) => (
        <div className="tooltip-row" key={index}>
          <span className="tooltip-dot" style={{ background: item.color || item.fill }} />
          <span>{item.name || item.dataKey}</span>
          <strong>{typeof item.value === "number" ? money(item.value) : item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function Metric({ label, value, footnote, accent = "gold" }: { label: string; value: string; footnote: string; accent?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className={"metric-foot " + accent}>{footnote}</div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState("");
  const lastCheckRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [outlookYear, setOutlookYear] = useState(new Date().getFullYear());
  const [active, setActive] = useState<PageKey>("Overview");
  const [navQuery, setNavQuery] = useState("");
  const [country, setCountry] = useState("Kenya");
  const [rangeStart, setRangeStart] = useState(2000);
  const [rangeEnd, setRangeEnd] = useState(2022);
  const [compareNames, setCompareNames] = useState<string[]>(["Kenya", "United States", "China", "India"]);
  const [compareSearch, setCompareSearch] = useState("");
  const [compareMode, setCompareMode] = useState<"level" | "index">("level");
  const [regionCodes, setRegionCodes] = useState<string[]>(["AFE", "AFW", "EAS", "ECS", "LCN", "SAS"]);
  const [rankMode, setRankMode] = useState<"size" | "change" | "cagr">("size");
  const [rankYearStart, setRankYearStart] = useState(2012);
  const [forecastRate, setForecastRate] = useState(5);
  const [forecastYears, setForecastYears] = useState(5);

  useEffect(() => {
    let alive = true;
    fetch("/api/gdp")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the live GDP sources.");
        return response.json();
      })
      .then((result: Dataset) => {
        if (!alive) return;
        const availableCountries = result.series.filter((row) => !row.isAggregate && !AGGREGATES.has(row.code));
        const years = availableCountries.map((row) => row.year).filter(Number.isFinite);
        if (!availableCountries.length || !years.length) {
          throw new Error("The GDP source returned no usable national observations. Refresh the page to retry the source.");
        }
        setData(result);
        lastCheckRef.current = Date.now();
        const kenya = availableCountries.some((row) => row.name === "Kenya");
        setCountry(kenya ? "Kenya" : (availableCountries[0]?.name || ""));
        setRangeEnd(Math.max(...years));
        setRangeStart(Math.max(Math.min(...years), Math.max(...years) - 22));
        setRankYearStart(Math.max(Math.min(...years), Math.max(...years) - 10));
        const currentOutlook = result.outlook.map((row) => row.year).filter((year) => year >= new Date().getFullYear());
        if (currentOutlook.length) setOutlookYear(Math.min(...currentOutlook));
      })
      .catch((error) => {
        if (alive) setLoadError(error instanceof Error ? error.message : "Dataset loading failed.");
      });
    return () => { alive = false; };
  }, []);

  async function refreshDataset() {
    setRefreshing(true);
    setRefreshMessage("");
    try {
      const response = await fetch("/api/gdp?refresh=1", { signal: AbortSignal.timeout(55000) });
      if (!response.ok) throw new Error("The live data sources did not respond. Please try again.");
      const result = await response.json() as Dataset;
      if (!result.series?.length) throw new Error("The source returned no GDP observations. The previous data has been kept.");
      setData(result);
      setLoadError("");
      lastCheckRef.current = Date.now();
      setRangeEnd((current) => Math.max(current, result.lastYear));
      if (result.warnings.length) {
        setRefreshMessage("Some feeds are unavailable. Source status is shown below.");
      } else {
        setRefreshMessage("Sources checked successfully.");
      }
      const currentOutlook = result.outlook.map((row) => row.year).filter((year) => year >= new Date().getFullYear());
      if (currentOutlook.length) setOutlookYear((current) => currentOutlook.includes(current) ? current : Math.min(...currentOutlook));
    } catch (error) {
      setRefreshMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const checkSources = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/gdp?refresh=1", { signal: AbortSignal.timeout(55000) });
        if (!response.ok) throw new Error("Background source check failed.");
        const result = await response.json() as Dataset;
        setData(result);
        lastCheckRef.current = Date.now();
        setRefreshMessage("Sources checked automatically.");
      } catch {
        // A temporary source outage must not replace the last successful observations.
        setRefreshMessage("Automatic source check could not complete. Showing the last successful data.");
      }
    };
    const timer = window.setInterval(checkSources, 6 * 60 * 60 * 1000);
    const onFocus = () => {
      if (lastCheckRef.current > 0 && Date.now() - lastCheckRef.current >= 6 * 60 * 60 * 1000) void checkSources();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const rows = data?.series || [];
  const countryRows = useMemo(() => rows.filter((row) => !row.isAggregate && !AGGREGATES.has(row.code)), [rows]);
  const aggregateRows = useMemo(() => rows.filter((row) => row.isAggregate || AGGREGATES.has(row.code)), [rows]);
  const countryNames = useMemo(
    () => Array.from(new Set(countryRows.map((row) => row.name))).sort((a, b) => a.localeCompare(b)),
    [countryRows]
  );
  const latestCountries = useMemo(() => latestByCode(countryRows), [countryRows]);
  const visibleCompareCountries = useMemo(
    () => countryNames.filter((name) => name.toLowerCase().includes(compareSearch.trim().toLowerCase())),
    [countryNames, compareSearch]
  );
  const worldRows = useMemo(
    () => aggregateRows.filter((row) => row.code === "WLD").sort((a, b) => a.year - b.year),
    [aggregateRows]
  );
  const latestWorld = worldRows[worldRows.length - 1];
  const priorWorld = worldRows.length > 1 && worldRows[worldRows.length - 1].year - worldRows[worldRows.length - 2].year === 1
    ? worldRows[worldRows.length - 2]
    : null;
  const worldChange = latestWorld && priorWorld ? pctChange(latestWorld.gdp, priorWorld.gdp) : null;
  const worldStart = worldRows.find((row) => row.year >= (latestWorld?.year || 2022) - 10);
  const worldCagr = latestWorld && worldStart
    ? cagr(worldStart.gdp, latestWorld.gdp, latestWorld.year - worldStart.year)
    : null;
  const topEconomies = [...latestCountries].sort((a, b) => b.gdp - a.gdp).slice(0, 10);
  const outlookYears = useMemo(
    () => Array.from(new Set((data?.outlook || []).map((row) => row.year))).sort((a, b) => a - b),
    [data?.outlook]
  );
  const selectedOutlook = useMemo(
    () => (data?.outlook || [])
      .filter((row) => row.year === outlookYear && !AGGREGATES.has(row.code))
      .sort((a, b) => b.gdp - a.gdp)
      .slice(0, 12),
    [data?.outlook, outlookYear]
  );

  const activeCountryRows = useMemo(
    () => countryRows.filter((row) => row.name === country && row.year >= rangeStart && row.year <= rangeEnd).sort((a, b) => a.year - b.year),
    [countryRows, country, rangeStart, rangeEnd]
  );
  const selectedCompareRows = useMemo(
    () => countryRows.filter((row) => compareNames.includes(row.name)),
    [countryRows, compareNames]
  );
  const indexedCompareRows = useMemo(() => {
    if (compareMode === "level") return selectedCompareRows;
    const firstByName = new Map<string, number>();
    for (const row of selectedCompareRows) {
      if (!firstByName.has(row.name)) firstByName.set(row.name, row.gdp);
    }
    return selectedCompareRows.map((row) => ({
      ...row,
      index: (row.gdp / (firstByName.get(row.name) || row.gdp)) * 100,
    }));
  }, [selectedCompareRows, compareMode]);
  const regionRows = useMemo(
    () => aggregateRows.filter((row) => regionCodes.includes(row.code)).map((row) => ({ ...row, name: REGION_NAMES[row.code] || row.name })),
    [aggregateRows, regionCodes]
  );

  const growthRows = useMemo(() => {
    const sorted = [...countryRows].sort((a, b) => a.code.localeCompare(b.code) || a.year - b.year);
    const values: Array<{ name: string; code: string; year: number; change: number }> = [];
    const last = new Map<string, Observation>();
    for (const row of sorted) {
      const previous = last.get(row.code);
      if (previous && row.year - previous.year === 1) {
        const change = pctChange(row.gdp, previous.gdp);
        if (change !== null && Number.isFinite(change)) values.push({ name: row.name, code: row.code, year: row.year, change });
      }
      last.set(row.code, row);
    }
    return values;
  }, [countryRows]);

  const latestGrowth = useMemo(() => {
    const last = new Map<string, { name: string; code: string; year: number; change: number }>();
    for (const row of growthRows) {
      const previous = last.get(row.code);
      if (!previous || row.year > previous.year) last.set(row.code, row);
    }
    return Array.from(last.values());
  }, [growthRows]);

  const rankings = useMemo(() => {
    if (rankMode === "size") return [...latestCountries].sort((a, b) => b.gdp - a.gdp).slice(0, 15).reverse()
      .map((row) => ({ name: row.name, year: row.year, value: row.gdp, label: money(row.gdp) }));
    if (rankMode === "change") return [...latestGrowth].sort((a, b) => b.change - a.change).slice(0, 15).reverse()
      .map((row) => ({ name: row.name, year: row.year, value: row.change, label: percent(row.change) }));
    const results: Array<{ name: string; year: number; value: number; label: string }> = [];
    for (const name of countryNames) {
      const series = countryRows.filter((row) => row.name === name && row.year >= rankYearStart).sort((a, b) => a.year - b.year);
      if (series.length < 2) continue;
      const first = series[0];
      const last = series[series.length - 1];
      const rate = cagr(first.gdp, last.gdp, last.year - first.year);
      if (rate !== null) results.push({ name, year: last.year, value: rate, label: percent(rate) });
    }
    return results.sort((a, b) => b.value - a.value).slice(0, 15).reverse();
  }, [rankMode, latestCountries, latestGrowth, countryNames, countryRows, rankYearStart]);

  const yearMin = data?.firstYear || 1960;
  const yearMax = data?.lastYear || 2022;
  const profileLatest = activeCountryRows[activeCountryRows.length - 1];
  const profilePrevious = activeCountryRows.length > 1 ? activeCountryRows[activeCountryRows.length - 2] : null;
  const profileGrowth = profileLatest && profilePrevious && profileLatest.year - profilePrevious.year === 1
    ? pctChange(profileLatest.gdp, profilePrevious.gdp)
    : null;
  const profileCagr = activeCountryRows.length > 1
    ? cagr(activeCountryRows[0].gdp, activeCountryRows[activeCountryRows.length - 1].gdp,
      activeCountryRows[activeCountryRows.length - 1].year - activeCountryRows[0].year)
    : null;

  function selectProfileCountry(name: string) {
    setCountry(name);
    const observations = countryRows.filter((row) => row.name === name).sort((a, b) => a.year - b.year);
    if (observations.length) {
      const first = observations[0].year;
      const last = observations[observations.length - 1].year;
      setRangeStart(Math.max(first, last - 22));
      setRangeEnd(last);
    }
  }

  function toggleCompare(name: string) {
    setCompareNames((current) =>
      current.includes(name)
        ? current.filter((item) => item !== name)
        : current.length < 8 ? [...current, name] : current
    );
  }

  function toggleRegion(code: string) {
    setRegionCodes((current) =>
      current.includes(code) ? current.filter((item) => item !== code) : [...current, code]
    );
  }

  const pageDescription: Record<PageKey, string> = {
    "Overview": "A considered view of the global economy and the largest national economies.",
    "Country profile": "Follow an economy's recorded GDP history and see how its nominal value has changed.",
    "Compare economies": "Compare economic scale or align different economies to a common starting point.",
    "Regional monitor": "Explore regional aggregates from the source dataset without mixing them into country rankings.",
    "Growth analytics": "Study the distribution and latest recorded annual nominal changes across countries.",
    "Data Explorer": "Search the World Bank indicator library, find the series you need, and inspect its country and year coverage.",
    "Rankings": "Rank national economies using transparent measures and their own latest available observations.",
    "Forecast lab": "Build simple, assumption-led scenarios from the last recorded GDP observation.",
    "Methodology": "Review the source, coverage, definitions and limits behind every calculation.",
  };

  if (loadError && !data) {
    return (
      <main className="loading-shell">
        <div className="eyebrow">GDP Research</div>
        <h1>Dataset unavailable</h1>
        <p>{loadError}</p>
        <button className="refresh-button" onClick={refreshDataset} disabled={refreshing}>
          {refreshing ? "Retrying…" : "Retry data connection"}
        </button>
      </main>
    );
  }
  if (!data) {
    return <main className="loading-shell"><div className="brand-mark">GR</div><div className="eyebrow">Independent economic research</div><h1>GDP Research</h1><p>Preparing the historical dataset…</p><div className="loading-line" /></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">GR</div>
          <div>
            <div className="brand-title">GDP Research</div>
            <div className="brand-subtitle">Global economic monitor</div>
          </div>
        </div>
        <div className="nav-caption">RESEARCH WORKSPACE</div>
        <label className="nav-search">
          <span className="sr-only">Search dashboard sections</span>
          <input
            type="search"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
            placeholder="Find a section…"
            aria-label="Find a dashboard section"
          />
          <span className="nav-search-shortcut" aria-hidden="true">⌕</span>
        </label>
        <nav className="nav-list" aria-label="Main navigation">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              item.toLowerCase().includes(navQuery.trim().toLowerCase())
            );
            if (!visibleItems.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {visibleItems.map((item) => (
                  <button
                    key={item}
                    onClick={() => setActive(item)}
                    className={"nav-item" + (active === item ? " active" : "")}
                    aria-current={active === item ? "page" : undefined}
                  >
                    <span className="nav-indicator" aria-hidden="true" />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {NAV_GROUPS.every((group) => !group.items.some((item) =>
            item.toLowerCase().includes(navQuery.trim().toLowerCase())
          )) && <div className="nav-empty">No matching section</div>}
        </nav>
        <div className="sidebar-foot">
          <div className="source-line">SOURCE</div>
          <div>World Bank + IMF WEO</div>
          <div className="sidebar-range">{data.firstYear} — {data.lastYear}</div>
          <div className="sidebar-separation">Independent project · Separate data</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">RESEARCH <span>/</span> {active.toUpperCase()}</div>
          <label className="mobile-nav-switcher">
            <span>GO TO</span>
            <select
              aria-label="Go to dashboard section"
              value={active}
              onChange={(event) => setActive(event.target.value as PageKey)}
            >
              {NAV.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="topbar-right">
            <span className={"status-dot" + (data.worldBankStatus === "live" && data.imfStatus === "live" ? "" : " warning")} />
            <span>{data.worldBankStatus === "live" ? "World Bank API" : "World Bank fallback"}</span>
            <span className="topbar-divider" />
            <span>{data.imfStatus === "live" ? "IMF WEO" : "IMF unavailable"}</span>
            <span className="topbar-divider" />
            <span>Checked {new Date(data.checkedAt || data.updatedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
            <button className="refresh-button" onClick={refreshDataset} disabled={refreshing}>
              <span className={refreshing ? "refresh-symbol spinning" : "refresh-symbol"}>↻</span>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        <div className="content-area">
          <div className="section-heading">
            <div className="eyebrow">GDP RESEARCH / {String(NAV.indexOf(active) + 1).padStart(2, "0")}</div>
            <h1>{active === "Overview" ? "The global economy, in numbers" : active}</h1>
            <p>{pageDescription[active]}</p>
          </div>
          {refreshMessage && <p className="refresh-message" role="status">{refreshMessage}</p>}

          {active === "Overview" && (
            <>
              <section className="panel source-freshness-panel">
                <div className="panel-header">
                  <div><div className="panel-kicker">SOURCE FRESHNESS</div><h2>When the source data last changed</h2></div>
                  <span className="panel-unit">CHECKED EVERY 6 HOURS</span>
                </div>
                <div className="freshness-grid">
                  <div>
                    <span className="freshness-label">WORLD BANK · REPORTED GDP</span>
                    <strong>{data.worldBankLastUpdated || "Update date not supplied"}</strong>
                    <small>{data.worldBankStatus === "live" ? "Live source connected" : "Using a clearly flagged local fallback"} · Most recent year in the source extract: {data.lastYear}</small>
                  </div>
                  <div>
                    <span className="freshness-label">IMF · OUTLOOK</span>
                    <strong>{data.imfStatus === "live" ? data.outlookEdition : "IMF outlook feed unavailable"}</strong>
                    <small>{data.imfStatus === "live"
                      ? (data.imfLastModified ? "Indicator last modified " + data.imfLastModified : "Release vintage supplied by the source") + " · Estimates and projections are kept separate from reported data"
                      : "Historical World Bank GDP remains available. The latest IMF estimate and projection feed could not be retrieved."}</small>
                  </div>
                  <div>
                    <span className="freshness-label">THIS DASHBOARD</span>
                    <strong>{new Date(data.checkedAt || data.updatedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</strong>
                    <small>Last refresh processed by this dashboard</small>
                  </div>
                </div>
              </section>
              <div className="metric-grid">
                <Metric label="WORLD GDP · LATEST" value={money(latestWorld?.gdp)} footnote={"Recorded in " + (latestWorld?.year || "—")} />
                <Metric label="ANNUAL NOMINAL CHANGE" value={percent(worldChange)} footnote="Latest consecutive years" accent="teal" />
                <Metric label="10-YEAR NOMINAL CAGR" value={percent(worldCagr)} footnote="Approximate historical pace" accent="blue" />
                <Metric label="COUNTRY SERIES" value={String(latestCountries.length)} footnote="Excludes source aggregates" accent="muted" />
              </div>

              <div className="chart-grid overview-grid">
                <section className="panel panel-large">
                  <div className="panel-header">
                    <div><div className="panel-kicker">GLOBAL OUTPUT</div><h2>World GDP over time</h2></div>
                    <span className="panel-unit">CURRENT US$</span>
                  </div>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={worldRows}>
                        <defs><linearGradient id="worldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14804A" stopOpacity={0.22} /><stop offset="100%" stopColor="#14804A" stopOpacity={0.01} /></linearGradient></defs>
                        <CartesianGrid stroke="#E0E9E3" vertical={false} />
                        <XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={35} />
                        <YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={65} />
                        <Tooltip content={<AppChartTooltip />} />
                        <Area type="monotone" dataKey="gdp" name="World GDP" stroke="#14804A" strokeWidth={2.3} fill="url(#worldFill)" activeDot={{ r: 4, fill: "#14804A" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-note">World aggregate series · nominal values in current US dollars</div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div><div className="panel-kicker">ECONOMIC SCALE</div><h2>Largest economies</h2></div>
                    <span className="panel-unit">LATEST AVAILABLE</span>
                  </div>
                  <div className="chart-wrap tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...topEconomies].reverse()} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 4 }}>
                        <CartesianGrid stroke="#E0E9E3" horizontal={false} />
                        <XAxis type="number" tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#47584D", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<AppChartTooltip />} />
                        <Bar dataKey="gdp" name="GDP" fill="#0D9488" barSize={13} radius={[0, 2, 2, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-note">Each economy uses its latest non-missing year.</div>
                </section>
              </div>

              <section className="panel outlook-panel">
                <div className="panel-header panel-header-wrap">
                  <div>
                    <div className="panel-kicker">CURRENT OUTLOOK · IMF WEO</div>
                    <h2>Nominal GDP estimates & projections</h2>
                    <p className="outlook-subtitle">{data.outlookEdition} · Published estimates and projections, not real-time readings</p>
                  </div>
                  <div className="inline-select">
                    <label htmlFor="outlook-year">OUTLOOK YEAR</label>
                    <select id="outlook-year" value={String(outlookYear)} disabled={!outlookYears.length} onChange={(event) => setOutlookYear(Number(event.target.value))}>
                      {outlookYears.length
                        ? outlookYears.map((year) => <option key={year} value={year}>{year}{year === new Date().getFullYear() ? " · current-year estimate" : year > new Date().getFullYear() ? " · projection" : ""}</option>)
                        : <option value={String(outlookYear)}>No outlook years available</option>}
                    </select>
                  </div>
                </div>
                {selectedOutlook.length ? (
                  <>
                    <div className="chart-wrap tall">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[...selectedOutlook].reverse()} layout="vertical" margin={{ left: 8, right: 18, top: 4, bottom: 4 }}>
                          <CartesianGrid stroke="#E0E9E3" horizontal={false} />
                          <XAxis type="number" tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#47584D", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(value: any) => money(Number(value))} />
                          <Bar dataKey="gdp" name="GDP estimate / projection" fill="#14804A" barSize={14} radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>ECONOMY</th><th>YEAR</th><th>GDP · CURRENT US$</th><th>IMF REAL GDP GROWTH</th></tr></thead>
                        <tbody>{selectedOutlook.map((row) => <tr key={row.code}><td>{row.name}</td><td>{row.year}</td><td>{money(row.gdp)}</td><td>{percent(row.realGrowth)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="chart-note">{data.imfStatus === "live"
                    ? "The IMF feed is connected, but it returned no GDP estimates or projections beyond the World Bank reported series for the selected year."
                    : "The IMF outlook feed is unavailable. No estimates or projections are displayed as if they were official. Use Refresh to check the source again."}</p>
                )}
                <p className="chart-note">Annual GDP at current prices. IMF values are shown separately from World Bank reported observations. Real GDP growth is the IMF indicator NGDP_RPCH and is not nominal GDP growth.</p>
              </section>
              {data.warnings.length > 0 && (
                <div className="method-strip warning"><strong>Source notice</strong><span>{data.warnings.join(" ")}</span></div>
              )}
              <section className="panel">
                <div className="panel-header panel-header-wrap">
                  <div><div className="panel-kicker">COUNTRY COMPARISON</div><h2>How major economies have evolved</h2></div>
                  <div className="inline-select"><label htmlFor="overview-countries">Select economies</label>
                    <select id="overview-countries" multiple value={compareNames} onChange={(event) => setCompareNames(Array.from(event.target.selectedOptions, (option) => option.value).slice(0, 8))}>
                      {countryNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="chart-wrap medium">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={mergeSeries(selectedCompareRows)}>
                      <CartesianGrid stroke="#E0E9E3" vertical={false} />
                      <XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={65} />
                      <Tooltip content={<AppChartTooltip />} />
                      <Legend wrapperStyle={{ color: "#65766B", fontSize: 11 }} />
                      {compareNames.map((name, index) => <Line key={name} dataKey={name} name={name} type="monotone" stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} connectNulls={false} />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-note">Select several countries to compare their recorded nominal GDP paths.</div>
              </section>
              <div className="method-strip"><strong>Interpretation</strong><span>Current-US-dollar GDP includes price and exchange-rate effects. It is not the same as inflation-adjusted real GDP.</span></div>
            </>
          )}

          {active === "Country profile" && (
            <>
              <section className="panel filter-panel">
                <div className="filter-field"><label htmlFor="profile-country">ECONOMY</label><select id="profile-country" value={country} onChange={(event) => selectProfileCountry(event.target.value)}>{countryNames.map((name) => <option key={name}>{name}</option>)}</select></div>
                <div className="filter-field"><label htmlFor="profile-start">FROM YEAR · {rangeStart}</label><input id="profile-start" type="range" min={yearMin} max={rangeEnd} value={rangeStart} onChange={(event) => setRangeStart(Math.min(Number(event.target.value), rangeEnd))} /></div>
                <div className="filter-field"><label htmlFor="profile-end">TO YEAR · {rangeEnd}</label><input id="profile-end" type="range" min={rangeStart} max={yearMax} value={rangeEnd} onChange={(event) => setRangeEnd(Math.max(Number(event.target.value), rangeStart))} /></div>
              </section>
              {activeCountryRows.length === 0 && <div className="method-strip warning"><strong>No observations in this interval</strong><span>Choose another economy or widen the year range. The dashboard does not fill missing GDP years with estimates.</span></div>}
              <div className="metric-grid three">
                <Metric label="GDP · SELECTED END YEAR" value={money(profileLatest?.gdp)} footnote={profileLatest ? String(profileLatest.year) : "No observation"} />
                <Metric label="LATEST ANNUAL NOMINAL CHANGE" value={percent(profileGrowth)} footnote="Requires consecutive years" accent="teal" />
                <Metric label="PERIOD NOMINAL CAGR" value={percent(profileCagr)} footnote={activeCountryRows.length ? activeCountryRows[0].year + " to " + activeCountryRows[activeCountryRows.length - 1].year : "Insufficient observations"} accent="blue" />
              </div>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">HISTORICAL SERIES</div><h2>{country} · GDP path</h2></div><span className="panel-unit">CURRENT US$</span></div>
                <div className="chart-wrap tall">
                  <ResponsiveContainer width="100%" height="100%"><AreaChart data={activeCountryRows}>
                    <defs><linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0D9488" stopOpacity={0.2} /><stop offset="100%" stopColor="#0D9488" stopOpacity={0.01} /></linearGradient></defs>
                    <CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={70} /><Tooltip content={<AppChartTooltip />} />
                    <Area dataKey="gdp" name="GDP" type="monotone" stroke="#0D9488" strokeWidth={2.3} fill="url(#profileFill)" />
                  </AreaChart></ResponsiveContainer>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">OBSERVATION HISTORY</div><h2>Recorded values</h2></div><span className="panel-unit">{activeCountryRows.length} OBSERVATIONS</span></div>
                <div className="table-wrap"><table><thead><tr><th>YEAR</th><th>GDP · CURRENT US$</th><th>ANNUAL NOMINAL CHANGE</th></tr></thead><tbody>
                  {activeCountryRows.slice().reverse().map((row, index, list) => {
                    const previous = index + 1 < list.length ? list[index + 1] : null;
                    const change = previous && row.year - previous.year === 1 ? pctChange(row.gdp, previous.gdp) : null;
                    return <tr key={row.year}><td>{row.year}</td><td>{money(row.gdp)}</td><td>{percent(change)}</td></tr>;
                  })}
                </tbody></table></div>
              </section>
            </>
          )}

          {active === "Compare economies" && (
            <>
              <section className="panel">
                <div className="panel-header panel-header-wrap"><div><div className="panel-kicker">COMPARISON SET</div><h2>Choose economies</h2></div><span className="panel-unit">{compareNames.length} SELECTED · UP TO 8</span></div>
                <div className="compare-search-row"><input type="search" value={compareSearch} onChange={(event) => setCompareSearch(event.target.value)} placeholder="Find an economy…" aria-label="Search economies to compare" /><span>{compareNames.length} / 8 selected</span></div>
                <div className="choice-list">{visibleCompareCountries.map((name) => <label className="choice" key={name}><input type="checkbox" checked={compareNames.includes(name)} onChange={() => toggleCompare(name)} disabled={!compareNames.includes(name) && compareNames.length >= 8} /><span>{name}</span></label>)}</div>
                {visibleCompareCountries.length === 0 && <p className="chart-note">No economies match that search.</p>}
                <div className="segmented"><button className={compareMode === "level" ? "selected" : ""} onClick={() => setCompareMode("level")}>GDP level</button><button className={compareMode === "index" ? "selected" : ""} onClick={() => setCompareMode("index")}>Indexed · start = 100</button></div>
              </section>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">TIME SERIES COMPARISON</div><h2>{compareMode === "level" ? "Nominal GDP levels" : "Relative GDP paths"}</h2></div><span className="panel-unit">{compareMode === "level" ? "CURRENT US$" : "INDEX POINTS"}</span></div>
                <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%">
                  {compareMode === "level" ? <LineChart data={mergeSeries(selectedCompareRows)}><CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={65} /><Tooltip content={<AppChartTooltip />} /><Legend wrapperStyle={{ color: "#65766B", fontSize: 11 }} />{compareNames.map((name, index) => <Line key={name} dataKey={name} name={name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />)}</LineChart> :
                  <LineChart data={mergeIndexed(indexedCompareRows as Array<Observation & { index: number }>)}><CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><ReferenceLine y={100} stroke="#6B7D72" strokeDasharray="4 4" /><Tooltip /><Legend wrapperStyle={{ color: "#65766B", fontSize: 11 }} />{compareNames.map((name, index) => <Line key={name} dataKey={name} name={name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />)}</LineChart>}
                </ResponsiveContainer></div>
                {compareNames.length === 0 ? <p className="chart-note">Select at least one economy above to display a comparison.</p> : <p className="chart-note">Each indexed economy starts at its own first available observation. Starting years can differ, so compare the paths with their coverage in mind. The indexed view compares the pace of change, not absolute GDP size.</p>}
              </section>
            </>
          )}

          {active === "Regional monitor" && (
            <>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">REGIONAL SERIES</div><h2>Select regions</h2></div><span className="panel-unit">SOURCE AGGREGATES</span></div>
                <div className="region-grid">{Object.entries(REGION_NAMES).filter(([code]) => code !== "WLD").map(([code, name]) => <label className="choice" key={code}><input type="checkbox" checked={regionCodes.includes(code)} onChange={() => toggleRegion(code)} /><span>{name}</span></label>)}</div>
              </section>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">REGIONAL ECONOMIC SCALE</div><h2>GDP by region</h2></div><span className="panel-unit">CURRENT US$</span></div>
                {regionRows.length > 0 ? <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={mergeSeries(regionRows)}>
                  <CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={65} /><Tooltip content={<AppChartTooltip />} /><Legend wrapperStyle={{ color: "#65766B", fontSize: 11 }} />{Array.from(new Set(regionRows.map((row) => row.name))).map((name, index) => <Line key={name} dataKey={name} name={name} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />)}
                </LineChart></ResponsiveContainer></div> : <p className="chart-note">Select one or more regions above to view the source aggregates.</p>}
                <p className="chart-note">These regional aggregates are provided by the source. They are not calculated by adding the individual country observations displayed here.</p>
              </section>
            </>
          )}

          {active === "Growth analytics" && (
            <>
              <div className="metric-grid three">
                <Metric label="COUNTRY-YEAR OBSERVATIONS" value={growthRows.length.toLocaleString("en-US")} footnote="Consecutive years only" />
                <Metric label="MEDIAN NOMINAL CHANGE" value={growthRows.length ? percent(median(growthRows.map((row) => row.change))) : "—"} footnote="Across available observations" accent="teal" />
                <Metric label="NEGATIVE CHANGES" value={growthRows.length ? ((growthRows.filter((row) => row.change < 0).length / growthRows.length) * 100).toFixed(1) + "%" : "—"} footnote="Share of country-year observations" accent="blue" />
              </div>
              {growthRows.length === 0 && <div className="method-strip warning"><strong>Not enough consecutive observations</strong><span>Growth calculations require a reported observation in two adjacent years. No missing years are interpolated.</span></div>}
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-header"><div><div className="panel-kicker">DISTRIBUTION</div><h2>Annual nominal change</h2></div><span className="panel-unit">COUNTRY-YEAR · %</span></div>
                  <div className="chart-wrap medium"><ResponsiveContainer width="100%" height="100%"><BarChart data={growthHistogram(growthRows.map((row) => row.change))}><CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="bin" tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip /><ReferenceLine x="0–10%" stroke="#14804A" strokeDasharray="3 3" /><Bar dataKey="count" fill="#2563EB" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div>
                  <p className="chart-note">Values beyond the displayed range are grouped into the outer bins so the central distribution remains readable.</p>
                </section>
                <section className="panel">
                  <div className="panel-header"><div><div className="panel-kicker">YEARLY MEDIAN</div><h2>Nominal change through time</h2></div><span className="panel-unit">MEDIAN · %</span></div>
                  <div className="chart-wrap medium"><ResponsiveContainer width="100%" height="100%"><LineChart data={yearlyMedian(growthRows)}><CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} /><ReferenceLine y={0} stroke="#6B7D72" /><Tooltip /><Line dataKey="median" name="Median nominal change" stroke="#0D9488" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">LATEST AVAILABLE</div><h2>Highest and lowest nominal changes</h2></div></div>
                <div className="table-wrap"><table><thead><tr><th>ECONOMY</th><th>YEAR</th><th>ANNUAL NOMINAL CHANGE</th></tr></thead><tbody>{[...latestGrowth].sort((a, b) => b.change - a.change).slice(0, 8).map((row) => <tr key={row.code}><td>{row.name}</td><td>{row.year}</td><td>{percent(row.change)}</td></tr>)}{[...latestGrowth].sort((a, b) => a.change - b.change).slice(0, 8).map((row) => <tr key={row.code}><td>{row.name}</td><td>{row.year}</td><td>{percent(row.change)}</td></tr>)}</tbody></table></div>
              </section>
              <div className="method-strip"><strong>Important</strong><span>These are changes in nominal GDP measured in current US dollars, not inflation-adjusted real GDP growth.</span></div>
            </>
          )}

          {active === "Data Explorer" && (
            <DataExplorer />
          )}

          {active === "Rankings" && (
            <>
              <section className="panel filter-panel ranking-filters">
                <div className="filter-field"><label htmlFor="rank-measure">RANKING MEASURE</label><select id="rank-measure" value={rankMode} onChange={(event) => setRankMode(event.target.value as "size" | "change" | "cagr")}><option value="size">GDP size · latest available</option><option value="change">Annual nominal change · latest</option><option value="cagr">Nominal CAGR · selected window</option></select></div>
                {rankMode === "cagr" && <div className="filter-field"><label htmlFor="rank-period">PERIOD START · {rankYearStart}</label><input id="rank-period" type="range" min={yearMin} max={yearMax - 1} value={rankYearStart} onChange={(event) => setRankYearStart(Number(event.target.value))} /></div>}
              </section>
              <section className="panel">
                <div className="panel-header"><div><div className="panel-kicker">COUNTRY LEAGUE TABLE</div><h2>{rankMode === "size" ? "Largest national economies" : rankMode === "change" ? "Latest annual nominal changes" : "Nominal compound annual growth"}</h2></div><span className="panel-unit">TOP 15</span></div>
                <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><BarChart data={rankings} layout="vertical" margin={{ left: 8, right: 20 }}><CartesianGrid stroke="#E0E9E3" horizontal={false} /><XAxis type="number" tickFormatter={rankMode === "size" ? tickMoney : (value) => value + "%"} tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={145} tick={{ fill: "#47584D", fontSize: 11 }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: any) => rankMode === "size" ? money(Number(value)) : percent(Number(value))} /><Bar dataKey="value" fill={rankMode === "size" ? "#14804A" : "#0D9488"} barSize={14} radius={[0, 2, 2, 0]} /></BarChart></ResponsiveContainer></div>
                <div className="table-wrap"><table><thead><tr><th>ECONOMY</th><th>OBSERVATION YEAR</th><th>MEASURE</th></tr></thead><tbody>{[...rankings].reverse().map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.year}</td><td>{row.label}</td></tr>)}</tbody></table></div>
                {rankings.length === 0 ? <p className="chart-note">No countries have enough observations for this ranking measure and period.</p> : <p className="chart-note">Country rankings exclude regional and income-group aggregates. Each country uses its own latest available observation.</p>}
              </section>
            </>
          )}

          {active === "Forecast lab" && (
            <>
              <section className="panel filter-panel forecast-controls">
                <div className="filter-field"><label htmlFor="forecast-country">ECONOMY</label><select id="forecast-country" value={country} onChange={(event) => setCountry(event.target.value)}>{countryNames.map((name) => <option key={name}>{name}</option>)}</select></div>
                <div className="filter-field"><label htmlFor="forecast-rate">ANNUAL ASSUMPTION · {forecastRate.toFixed(1)}%</label><input id="forecast-rate" type="range" min={-10} max={20} step={0.5} value={forecastRate} onChange={(event) => setForecastRate(Number(event.target.value))} /></div>
                <div className="filter-field"><label htmlFor="forecast-horizon">HORIZON · {forecastYears} YEARS</label><input id="forecast-horizon" type="range" min={1} max={20} value={forecastYears} onChange={(event) => setForecastYears(Number(event.target.value))} /></div>
              </section>
              {(() => {
                const series = countryRows.filter((row) => row.name === country).sort((a, b) => a.year - b.year);
                const last = series[series.length - 1];
                if (!last) return <div className="panel"><p>No source observations are available for this selection.</p></div>;
                const recordedHistory = series.slice(-8).map((row) => ({
                  year: row.year,
                  observed: row.gdp,
                  scenario: row.year === last.year ? last.gdp : null,
                }));
                const scenarioPath = Array.from({ length: forecastYears }, (_, index) => ({
                  year: last.year + index + 1,
                  observed: null,
                  scenario: last.gdp * Math.pow(1 + forecastRate / 100, index + 1),
                }));
                const projection = [...recordedHistory, ...scenarioPath];
                const endpoint = last.gdp * Math.pow(1 + forecastRate / 100, forecastYears);
                return <>
                  <div className="metric-grid three"><Metric label="LAST OBSERVATION" value={money(last.gdp)} footnote={String(last.year)} /><Metric label="ASSUMED ANNUAL RATE" value={percent(forecastRate)} footnote="User-selected assumption" accent="teal" /><Metric label="ILLUSTRATIVE ENDPOINT" value={money(endpoint)} footnote={"Year " + (last.year + forecastYears)} accent="blue" /></div>
                  <section className="panel"><div className="panel-header"><div><div className="panel-kicker">ILLUSTRATIVE SCENARIO</div><h2>{country} · assumed GDP path</h2></div><span className="panel-unit">CURRENT US$</span></div>
                    <div className="chart-wrap tall"><ResponsiveContainer width="100%" height="100%"><LineChart data={projection}><CartesianGrid stroke="#E0E9E3" vertical={false} /><XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tickFormatter={tickMoney} tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} width={70} /><Tooltip content={<AppChartTooltip />} /><Line dataKey="observed" name="Recorded GDP" stroke="#64748B" strokeWidth={2.2} dot={false} connectNulls={false} />
                    <Line dataKey="scenario" name="Assumption-based scenario" stroke="#14804A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} /></LineChart></ResponsiveContainer></div>
                  </section>
                  <div className="method-strip warning"><strong>Scenario, not forecast</strong><span>This mechanical path compounds one nominal growth assumption. It is not an official forecast and does not isolate real output, inflation or exchange-rate effects.</span></div>
                </>;
              })()}
            </>
          )}

          {active === "Methodology" && (
            <>
              <div className="method-grid">
                <section className="panel method-card"><div className="panel-kicker">01 / WHERE THE NUMBERS COME FROM</div><h2>Start with the original source</h2><p>For the historical record, we go straight to the World Bank. Its GDP series is called <code>NY.GDP.MKTP.CD</code>. We pull the latest release, keep the year attached to every figure, and do not fill missing years with guesses.</p><a href="https://data.worldbank.org/indicator/NY.GDP.MKTP.CD" target="_blank" rel="noreferrer">See the World Bank GDP series ↗</a></section>
                <section className="panel method-card"><div className="panel-kicker">02 / ESTIMATES & PROJECTIONS</div><h2>IMF World Economic Outlook</h2><p>The IMF publishes a separate outlook. We use it to show the latest estimates and future projections when they go beyond the last reported World Bank year. These figures are useful for forward-looking analysis, but they are not presented as historical results.</p><a href="https://data.imf.org/en/datasets/IMF.RES%3AWEO" target="_blank" rel="noreferrer">Open latest WEO dataset ↗</a></section>
                <section className="panel method-card"><div className="panel-kicker">03 / GDP LEVEL</div><h2>Current US dollars</h2><p>Nominal GDP is the value of the economy measured at the prices and exchange rates of that year. It can rise because more is produced, because prices rise, or because the exchange rate changes. That is why nominal GDP is not the same as real economic growth.</p></section>
                <section className="panel method-card"><div className="panel-kicker">04 / ANNUAL CHANGE</div><h2>Consecutive observations</h2><p>We compare one year with the year immediately before it. The result tells you how much the dollar value changed, not how much real production grew. When a year is missing, we leave the comparison blank instead of pretending to know the change.</p></section>
                <section className="panel method-card"><div className="panel-kicker">05 / CAGR</div><h2>Compound annual rate</h2><p>Compound annual growth rate answers a practical question: if the change had happened at a steady rate each year, what rate would connect the start and end values? It smooths the journey, so it does not show the ups and downs in between.</p></section>
                <section className="panel method-card"><div className="panel-kicker">06 / INDEXING</div><h2>Common starting point</h2><p>Indexing gives every selected economy the same starting point of 100. It helps compare which economy grew faster over the chosen period, even when one economy started much larger than another.</p></section>
                <section className="panel method-card"><div className="panel-kicker">07 / SCENARIOS</div><h2>User-entered assumptions</h2><p>The scenario tool takes the latest reported number and applies the growth rate you choose. It is a simple “what if?” exercise. It does not know future shocks, policy changes, inflation or exchange rates, so it must not be read as an official forecast.</p></section>
                <section className="panel method-card"><div className="panel-kicker">08 / DATA FRESHNESS</div><h2>Annual releases, refreshed checks</h2><p>GDP is an annual national-accounts measure. The dashboard checks provider feeds periodically and refreshes after new source releases or revisions; it does not imply that GDP observations update minute by minute. The date the source last updated and the time this dashboard retrieved it are shown separately.</p></section>
              </div>
              <section className="panel source-panel"><div className="panel-kicker">DATA QUALITY & LIMITATIONS</div><h2>What the dashboard does — and does not — claim</h2><ul><li>Country rankings exclude source aggregates such as regional and income groups.</li><li>Every series uses its own latest available year; countries can have different coverage.</li><li>Missing observations remain missing. The application does not silently fill gaps.</li><li>Nominal changes in current US dollars are not inflation-adjusted real GDP growth.</li><li>Reported observations are pulled directly from the World Bank API. The IMF outlook is displayed separately because current-year estimates and future projections are not reported actual GDP.</li></ul></section>
            </>
          )}

          <footer className="page-footer">
            <span>GDP Research · Independent economic analysis</span>
            <span>Data: World Bank Open Data · Outlook: IMF World Economic Outlook · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function mergeSeries(rows: Array<Observation & { name: string }>) {
  const byYear = new Map<number, Record<string, number | string>>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, { year: row.year });
    byYear.get(row.year)![row.name] = row.gdp;
  }
  return Array.from(byYear.values()).sort((a, b) => Number(a.year) - Number(b.year));
}

function mergeIndexed(rows: Array<Observation & { index: number }>) {
  const byYear = new Map<number, Record<string, number | string>>();
  for (const row of rows) {
    if (!byYear.has(row.year)) byYear.set(row.year, { year: row.year });
    byYear.get(row.year)![row.name] = row.index;
  }
  return Array.from(byYear.values()).sort((a, b) => Number(a.year) - Number(b.year));
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function growthHistogram(values: number[]) {
  const labels = [
    "<−50%",
    "−50 to −25%",
    "−25 to −10%",
    "−10 to 0%",
    "0–10%",
    "10–25%",
    "25–50%",
    "50–100%",
    ">100%",
  ];
  const counts = new Array(labels.length).fill(0);
  for (const value of values) {
    let index = 8;
    if (value < -50) index = 0;
    else if (value < -25) index = 1;
    else if (value < -10) index = 2;
    else if (value < 0) index = 3;
    else if (value < 10) index = 4;
    else if (value < 25) index = 5;
    else if (value < 50) index = 6;
    else if (value <= 100) index = 7;
    counts[index] += 1;
  }
  return labels.map((bin, index) => ({ bin, count: counts[index] }));
}
function yearlyMedian(rows: Array<{ year: number; change: number }>) {
  const groups = new Map<number, number[]>();
  for (const row of rows) {
    if (!groups.has(row.year)) groups.set(row.year, []);
    groups.get(row.year)!.push(row.change);
  }
  return Array.from(groups.entries()).map(([year, values]) => ({ year, median: median(values) })).sort((a, b) => a.year - b.year);
}