"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
type CountryOption = { code: string; name: string; region: string };
type SeriesRow = { code: string; name: string; year: number; value: number; status: string; footnote?: string };
type ExplorerResponse = {
  indicator?: IndicatorResult;
  country?: { code: string; name: string };
  countries?: CountryOption[];
  results?: IndicatorResult[];
  series?: SeriesRow[];
  sourceUpdated?: string | null;
  retrievedAt?: string;
  firstYear?: number | null;
  lastYear?: number | null;
  observationCount?: number;
  error?: string;
};

const POPULAR = ["GDP per capita", "Inflation", "Unemployment", "Population", "Exports", "Government debt"];

function formatValue(value: number, indicator: IndicatorResult | null) {
  if (!Number.isFinite(value)) return "—";
  const unit = (indicator?.unit || "").toLowerCase();
  if (unit.includes("percent") || unit.includes("%")) return value.toFixed(2) + "%";
  if (unit.includes("current us") || unit.includes("constant us") || unit.includes("us dollar")) {
    if (Math.abs(value) >= 1e12) return "$" + (value / 1e12).toFixed(2) + "T";
    if (Math.abs(value) >= 1e9) return "$" + (value / 1e9).toFixed(1) + "B";
    if (Math.abs(value) >= 1e6) return "$" + (value / 1e6).toFixed(1) + "M";
    return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function tickValue(value: number, indicator: IndicatorResult | null) {
  const unit = (indicator?.unit || "").toLowerCase();
  if (unit.includes("percent") || unit.includes("%")) return value.toFixed(0) + "%";
  if (unit.includes("us dollar")) {
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
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [results, setResults] = useState<IndicatorResult[]>([]);
  const [selected, setSelected] = useState<IndicatorResult | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [country, setCountry] = useState("KEN");
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [startYear, setStartYear] = useState(2000);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [error, setError] = useState("");
  const [sourceUpdated, setSourceUpdated] = useState<string | null>(null);
  const [retrievedAt, setRetrievedAt] = useState("");
  const searchSequence = useRef(0);
  const seriesSequence = useRef(0);

  const years = useMemo(
    () => Array.from(new Set(series.map((row) => row.year))).sort((a, b) => a - b),
    [series]
  );
  const filtered = useMemo(
    () => series.filter((row) => row.year >= startYear && row.year <= endYear),
    [series, startYear, endYear]
  );
  const latest = filtered[filtered.length - 1];
  const previous = filtered.length > 1 ? filtered[filtered.length - 2] : null;
  const yearOnYearDifference = latest && previous && latest.year - previous.year === 1
    ? latest.value - previous.value
    : null;
  const unit = (selected?.unit || "").toLowerCase();
  const isPercentMeasure = unit.includes("percent") || unit.includes("%");
  const changeLabel = isPercentMeasure ? "CHANGE FROM PRIOR YEAR" : "DIFFERENCE FROM PRIOR YEAR";
  const changeValue = yearOnYearDifference === null
    ? "—"
    : isPercentMeasure
      ? (yearOnYearDifference > 0 ? "+" : "") + yearOnYearDifference.toFixed(2) + " pp"
      : formatValue(yearOnYearDifference, selected);
  const selectedCountryName = countries.find((item) => item.code === country)?.name
    || series[0]?.name
    || country;

  async function searchIndicators(term: string) {
    const requestId = ++searchSequence.current;
    setSearching(true);
    setError("");
    try {
      const response = await fetch("/api/explorer?q=" + encodeURIComponent(term), {
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json() as ExplorerResponse;
      if (!response.ok) throw new Error(payload.error || "Indicator search failed.");
      if (requestId === searchSequence.current) setResults(payload.results || []);
    } catch (reason) {
      if (requestId === searchSequence.current) {
        setError(reason instanceof Error ? reason.message : "Indicator search failed.");
        setResults([]);
      }
    } finally {
      if (requestId === searchSequence.current) setSearching(false);
    }
  }

  async function loadSeries(item: IndicatorResult, countryCode: string, resetRange = false) {
    const requestId = ++seriesSequence.current;
    setLoadingSeries(true);
    setError("");
    try {
      const params = new URLSearchParams({
        indicator: item.id,
        country: countryCode,
        start: "1960",
        end: String(new Date().getFullYear() + 5),
      });
      const response = await fetch("/api/explorer?" + params.toString(), {
        signal: AbortSignal.timeout(30000),
      });
      const payload = await response.json() as ExplorerResponse;
      if (!response.ok) throw new Error(payload.error || "That indicator could not be loaded.");
      if (requestId !== seriesSequence.current) return;

      const rows = payload.series || [];
      setSeries(rows);
      setCountry(countryCode);
      setSourceUpdated(payload.sourceUpdated || null);
      setRetrievedAt(payload.retrievedAt || "");

      const availableYears = rows.map((row) => row.year).sort((a, b) => a - b);
      if (availableYears.length) {
        const latestYear = availableYears[availableYears.length - 1];
        if (resetRange) {
          setStartYear(availableYears.find((year) => year >= 2000) ?? availableYears[0]);
        } else {
          setStartYear((current) => {
            const validYears = availableYears.filter((year) => year <= current);
            return validYears.length ? validYears[validYears.length - 1] : availableYears[0];
          });
        }
        setEndYear(latestYear);
      } else {
        setStartYear(1960);
        setEndYear(new Date().getFullYear());
      }
    } catch (reason) {
      if (requestId === seriesSequence.current) {
        setSeries([]);
        setError(reason instanceof Error ? reason.message : "Indicator loading failed.");
      }
    } finally {
      if (requestId === seriesSequence.current) setLoadingSeries(false);
    }
  }

  async function loadIndicator(item: IndicatorResult) {
    setSelected(item);
    const preferredCountry = countries.some((entry) => entry.code === country)
      ? country
      : countries.some((entry) => entry.code === "KEN") ? "KEN" : (countries[0]?.code || "KEN");
    await loadSeries(item, preferredCountry, true);
  }

  useEffect(() => {
    void searchIndicators("inflation");
    let active = true;
    fetch("/api/explorer?countries=1", { signal: AbortSignal.timeout(30000) })
      .then(async (response) => {
        const payload = await response.json() as ExplorerResponse;
        if (!response.ok) throw new Error(payload.error || "Country list unavailable.");
        if (active) {
          const list = payload.countries || [];
          setCountries(list);
          if (!list.some((entry) => entry.code === "KEN") && list[0]) setCountry(list[0].code);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Country list unavailable.");
      })
      .finally(() => {
        if (active) setLoadingCountries(false);
      });
    return () => {
      active = false;
      searchSequence.current += 1;
      seriesSequence.current += 1;
    };
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
      ["Country", selectedCountryName],
      ["Country code", country],
      ["Unit", selected.unit],
      ["Source last updated", sourceUpdated || ""],
      ["Retrieved at", retrievedAt],
      [],
      ["Year", "Value", "Observation status", "Source flag"],
      ...filtered.map((row) => [row.year, row.value, row.status, row.footnote || ""]),
    ].map((row) => row.map((cell) => escape(cell ?? "")).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gdp-research-${selected.id}-${country}-${startYear}-${endYear}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="explorer-layout">
      <section className="panel explorer-search-panel">
        <div className="panel-kicker">WORLD BANK INDICATOR LIBRARY</div>
        <h2>Find the data you need</h2>
        <p className="explorer-intro">Search thousands of published indicators. Try an indicator name, topic or code. Choose a result to inspect one country's history, source notes and downloadable observations.</p>
        <form className="explorer-search-form" onSubmit={submitSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inflation, public debt, exports, GDP per capita…"
            aria-label="Search World Bank indicators"
          />
          <button type="submit" disabled={searching || query.trim().length < 2}>
            {searching ? "Searching…" : "Search indicators"}
          </button>
        </form>
        <div className="explorer-popular">
          <span>POPULAR TOPICS</span>
          {POPULAR.map((term) => (
            <button type="button" key={term} onClick={() => { setQuery(term); void searchIndicators(term); }}>{term}</button>
          ))}
        </div>
        {error && <div className="method-strip warning" role="alert"><strong>Could not complete that request</strong><span>{error}</span></div>}
        <div className="explorer-results" aria-live="polite">
          <div className="explorer-results-heading">
            {searching ? "Searching the indicator library…" : `${results.length} matching indicators`}
          </div>
          {results.map((item) => (
            <button
              type="button"
              key={item.id}
              className={selected?.id === item.id ? "indicator-result selected" : "indicator-result"}
              onClick={() => void loadIndicator(item)}
            >
              <span className="indicator-result-title">{item.name}</span>
              <span className="indicator-result-meta">{item.id} · {item.unit || "Unit defined by source"}</span>
              <span className="indicator-result-source">{item.topics.slice(0, 2).join(" · ") || item.source}</span>
            </button>
          ))}
          {!searching && results.length === 0 && !error && (
            <p className="chart-note">No matching indicators were found. Try a broader term such as “prices”, “trade” or “population”.</p>
          )}
        </div>
      </section>

      <section className="panel explorer-data-panel">
        <div className="panel-header panel-header-wrap">
          <div>
            <div className="panel-kicker">INDICATOR DETAIL</div>
            <h2>{selected?.name || "Select an indicator"}</h2>
            {selected && <p className="explorer-subtitle">{selected.id} · {selected.source}</p>}
          </div>
          {selected && <button className="export-button" onClick={downloadCsv} disabled={!filtered.length || loadingSeries}>Download CSV</button>}
        </div>
        {selected && (
          <div className="explorer-filters">
            <label>COUNTRY
              <select
                value={country}
                disabled={loadingCountries || loadingSeries || countries.length === 0}
                onChange={(event) => void loadSeries(selected, event.target.value)}
              >
                {countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
              </select>
            </label>
            <label>FROM
              <select
                value={String(startYear)}
                disabled={!years.length || loadingSeries}
                onChange={(event) => setStartYear(Number(event.target.value))}
              >
                {years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label>TO
              <select
                value={String(endYear)}
                disabled={!years.length || loadingSeries}
                onChange={(event) => setEndYear(Number(event.target.value))}
              >
                {years.filter((year) => year >= startYear).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
        )}
        {loadingSeries && <p className="chart-note">Retrieving {selectedCountryName} observations from the World Bank…</p>}
        {selected && !loadingSeries && filtered.length > 0 && (
          <>
            <div className="explorer-metrics">
              <div><span>LATEST VALUE</span><strong>{formatValue(latest?.value ?? NaN, selected)}</strong><small>{latest?.year ?? "—"} · {selected.unit || "source unit"}</small></div>
              <div><span>{changeLabel}</span><strong>{changeValue}</strong><small>{isPercentMeasure ? "Percentage-point difference from the prior consecutive year" : "Only calculated when consecutive observations exist"}</small></div>
              <div><span>OBSERVATIONS</span><strong>{filtered.length}</strong><small>{filtered[0]?.year} to {filtered[filtered.length - 1]?.year}</small></div>
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
                <tbody>
                  {filtered.slice().reverse().slice(0, 18).map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{formatValue(row.value, selected)}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="chart-note">{selected.sourceNote || "This is the original source series. Check the indicator definition and unit before comparing it with another measure."}</p>
            <p className="chart-note">Source last updated: {sourceUpdated || "The source did not provide a release date"} · Retrieved by this dashboard: {retrievedAt ? new Date(retrievedAt).toLocaleString("en-KE") : "—"}</p>
          </>
        )}
        {selected && !loadingSeries && filtered.length === 0 && (
          <p className="chart-note">There are no observations for {selectedCountryName} in this period. This is a genuine gap in the returned source series, not an interpolated value.</p>
        )}
        {!selected && !loadingSeries && <p className="explorer-empty">Pick any indicator on the left to open its values, history, source notes and downloadable table here.</p>}
        {loadingCountries && <p className="chart-note">Loading the country selector…</p>}
      </section>
    </div>
  );
}
