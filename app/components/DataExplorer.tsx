"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type IndicatorResult = {
  id: string;
  name: string;
  unit: string;
  source: string;
  sourceNote: string;
  sourceOrganization: string;
  topics: string[];
};
type SeriesRow = { code: string; name: string; year: number; value: number; status: string };
type ExplorerResponse = {
  indicator?: IndicatorResult;
  results?: IndicatorResult[];
  series?: SeriesRow[];
  sourceUpdated?: string | null;
  retrievedAt?: string;
  firstYear?: number | null;
  lastYear?: number | null;
  error?: string;
};

const POPULAR = ["GDP per capita", "Inflation", "Unemployment", "Population", "Exports", "Government debt"];
const PALETTE = ["#14804A", "#2563EB", "#0D9488", "#C05C4D", "#8B5CF6", "#0891B2"];

function formatValue(value: number, indicator: IndicatorResult | null) {
  if (!Number.isFinite(value)) return "—";
  const unit = (indicator?.unit || "").toLowerCase();
  if (unit.includes("percent") || unit.includes("%")) return value.toFixed(2) + "%";
  if (unit.includes("current us") || unit.includes("constant us")) {
    if (Math.abs(value) >= 1e12) return "$" + (value / 1e12).toFixed(2) + "T";
    if (Math.abs(value) >= 1e9) return "$" + (value / 1e9).toFixed(1) + "B";
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function tickValue(value: number, indicator: IndicatorResult | null) {
  if ((indicator?.unit || "").toLowerCase().includes("percent")) return value.toFixed(0) + "%";
  if ((indicator?.unit || "").toLowerCase().includes("us dollar")) {
    if (Math.abs(value) >= 1e12) return "$" + (value / 1e12).toFixed(0) + "T";
    if (Math.abs(value) >= 1e9) return "$" + (value / 1e9).toFixed(0) + "B";
  }
  if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(0) + "B";
  if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(0) + "M";
  return value.toLocaleString("en-US");
}

export default function DataExplorer() {
  const [query, setQuery] = useState("inflation");
  const [searching, setSearching] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [results, setResults] = useState<IndicatorResult[]>([]);
  const [selected, setSelected] = useState<IndicatorResult | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [country, setCountry] = useState("KEN");
  const [startYear, setStartYear] = useState(2000);
  const [endYear, setEndYear] = useState(new Date().getFullYear() + 5);
  const [error, setError] = useState("");
  const [sourceUpdated, setSourceUpdated] = useState<string | null>(null);
  const [retrievedAt, setRetrievedAt] = useState("");

  const countries = useMemo(() => {
    const byCode = new Map<string, string>();
    for (const row of series) byCode.set(row.code, row.name);
    return Array.from(byCode.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [series]);
  const filtered = useMemo(
    () => series.filter((row) => row.code === country && row.year >= startYear && row.year <= endYear),
    [series, country, startYear, endYear]
  );
  const latest = filtered[filtered.length - 1];
  const previous = filtered.length > 1 ? filtered[filtered.length - 2] : null;
  const yearOnYearDifference = latest && previous && latest.year - previous.year === 1
    ? latest.value - previous.value
    : null;
  const isPercentMeasure = (selected?.unit || "").toLowerCase().includes("percent");
  const changeLabel = isPercentMeasure ? "CHANGE FROM PRIOR YEAR" : "DIFFERENCE FROM PRIOR YEAR";
  const changeValue = yearOnYearDifference === null
    ? "—"
    : isPercentMeasure
      ? (yearOnYearDifference > 0 ? "+" : "") + yearOnYearDifference.toFixed(2) + " pp"
      : formatValue(yearOnYearDifference, selected);

  async function searchIndicators(term: string) {
    setSearching(true);
    setError("");
    try {
      const response = await fetch("/api/explorer?q=" + encodeURIComponent(term));
      const payload = await response.json() as ExplorerResponse;
      if (!response.ok) throw new Error(payload.error || "Indicator search failed.");
      setResults(payload.results || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Indicator search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function loadIndicator(item: IndicatorResult) {
    setSelected(item);
    setLoadingSeries(true);
    setError("");
    setSeries([]);
    try {
      const response = await fetch(`/api/explorer?indicator=${encodeURIComponent(item.id)}&start=1960&end=${new Date().getFullYear() + 5}`);
      const payload = await response.json() as ExplorerResponse;
      if (!response.ok) throw new Error(payload.error || "That indicator could not be loaded.");
      const rows = payload.series || [];
      setSeries(rows);
      setSourceUpdated(payload.sourceUpdated || null);
      setRetrievedAt(payload.retrievedAt || "");
      const kenya = rows.some((row) => row.code === "KEN");
      setCountry(kenya ? "KEN" : (rows[0]?.code || ""));
      if (payload.firstYear) setStartYear(Math.max(1960, payload.firstYear));
      if (payload.lastYear) setEndYear(payload.lastYear);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Indicator loading failed.");
    } finally {
      setLoadingSeries(false);
    }
  }

  useEffect(() => {
    void searchIndicators("inflation");
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length >= 2) void searchIndicators(query.trim());
  }

  function downloadCsv() {
    if (!selected || !filtered.length) return;
    const escape = (value: string | number) => {
      const text = String(value);
      return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    const csv = [
      ["Platform", "GDP Research"],
      ["Indicator", selected.name],
      ["Indicator code", selected.id],
      ["Source", selected.source],
      ["Country", countries.find(([code]) => code === country)?.[1] || country],
      ["Unit", selected.unit],
      [],
      ["Year", "Value", "Observation status"],
      ...filtered.map((row) => [row.year, row.value, row.status]),
    ].map((row) => row.map((cell) => escape(cell ?? "")).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gdp-research-${selected.id}-${country}-${startYear}-${endYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="explorer-layout">
      <section className="panel explorer-search-panel">
        <div className="panel-kicker">WORLD BANK INDICATOR LIBRARY</div>
        <h2>Find the data you need</h2>
        <p className="explorer-intro">Search thousands of published indicators. Try a topic, a country-related measure or an indicator code. Choose a result to see its history and download the observations.</p>
        <form className="explorer-search-form" onSubmit={submitSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inflation, public debt, exports, GDP per capita…"
            aria-label="Search World Bank indicators"
          />
          <button type="submit" disabled={searching || query.trim().length < 2}>{searching ? "Searching…" : "Search indicators"}</button>
        </form>
        <div className="explorer-popular">
          <span>POPULAR TOPICS</span>
          {POPULAR.map((term) => <button key={term} onClick={() => { setQuery(term); void searchIndicators(term); }}>{term}</button>)}
        </div>
        {error && <div className="method-strip warning"><strong>Could not complete that request</strong><span>{error}</span></div>}
        <div className="explorer-results">
          <div className="explorer-results-heading">{searching ? "Searching the indicator library…" : `${results.length} matching indicators`}</div>
          {results.map((item) => (
            <button key={item.id} className={selected?.id === item.id ? "indicator-result selected" : "indicator-result"} onClick={() => void loadIndicator(item)}>
              <span className="indicator-result-title">{item.name}</span>
              <span className="indicator-result-meta">{item.id} · {item.unit || "Unit defined by source"}</span>
              <span className="indicator-result-source">{item.topics.slice(0, 2).join(" · ") || item.source}</span>
            </button>
          ))}
          {!searching && results.length === 0 && <p className="chart-note">No matching indicators were found. Try a broader term such as “prices”, “trade” or “population”.</p>}
        </div>
      </section>

      <section className="panel explorer-data-panel">
        <div className="panel-header panel-header-wrap">
          <div>
            <div className="panel-kicker">INDICATOR DETAIL</div>
            <h2>{selected?.name || "Select an indicator"}</h2>
            {selected && <p className="explorer-subtitle">{selected.id} · {selected.source}</p>}
          </div>
          {selected && <button className="export-button" onClick={downloadCsv} disabled={!filtered.length}>Download CSV</button>}
        </div>
        {selected && (
          <div className="explorer-filters">
            <label>COUNTRY
              <select value={country} onChange={(event) => setCountry(event.target.value)}>
                {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label>FROM
              <select value={String(startYear)} onChange={(event) => setStartYear(Number(event.target.value))}>
                {Array.from(new Set(series.map((row) => row.year))).sort((a, b) => a - b).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label>TO
              <select value={String(endYear)} onChange={(event) => setEndYear(Number(event.target.value))}>
                {Array.from(new Set(series.map((row) => row.year))).sort((a, b) => a - b).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
        )}
        {loadingSeries && <p className="chart-note">Retrieving source observations…</p>}
        {selected && !loadingSeries && filtered.length > 0 && (
          <>
            <div className="explorer-metrics">
              <div><span>LATEST VALUE</span><strong>{formatValue(latest?.value ?? NaN, selected)}</strong><small>{latest?.year ?? "—"} · {selected.unit || "source unit"}</small></div>
              <div><span>{changeLabel}</span><strong>{changeValue}</strong><small>{isPercentMeasure ? "Percentage-point difference" : "Only shown when consecutive observations exist"}</small></div>
              <div><span>OBSERVATIONS</span><strong>{filtered.length}</strong><small>{startYear} to {endYear}</small></div>
            </div>
            <div className="chart-wrap tall">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filtered}>
                  <CartesianGrid stroke="#E0E9E3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: "#718176", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => tickValue(value, selected)} tick={{ fill: "#718176", fontSize: 10 }} tickLine={false} axisLine={false} width={76} />
                  <Tooltip formatter={(value: any) => formatValue(Number(value), selected)} />
                  <Line dataKey="value" name={selected.name} stroke="#14804A" strokeWidth={2.4} dot={false} activeDot={{ r: 4 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrap explorer-table">
              <table>
                <thead><tr><th>YEAR</th><th>VALUE</th><th>SOURCE STATUS</th></tr></thead>
                <tbody>{filtered.slice().reverse().slice(0, 18).map((row) => <tr key={row.year}><td>{row.year}</td><td>{formatValue(row.value, selected)}</td><td>{row.status === "reported" ? "Source observation" : row.status}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="chart-note">{selected.sourceNote ? selected.sourceNote : "This is the original source series. Check the indicator definition and unit before comparing it with another measure."}</p>
            <p className="chart-note">Source last updated: {sourceUpdated || "The source did not provide a release date"} · Retrieved by this dashboard: {retrievedAt ? new Date(retrievedAt).toLocaleString("en-KE") : "—"}</p>
          </>
        )}
        {selected && !loadingSeries && filtered.length === 0 && <p className="chart-note">There are no reported observations for this country and period. Try a different country or year range.</p>}
        {!selected && !loadingSeries && <p className="explorer-empty">Pick any indicator on the left to open its values, history, source notes and downloadable table here.</p>}
      </section>
    </div>
  );
}
