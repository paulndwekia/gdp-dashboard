'use client';

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity, ArrowDownToLine, ArrowUpRight, BarChart3, BookOpen, ChevronDown,
  Compass, Globe2, Info, Layers3, Menu, Search, SlidersHorizontal, X
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import CountUp from "@/components/react-bits/CountUp";
import { INDICATORS, INDICATOR_KEYS, type IndicatorKey } from "@/lib/indicators";
import { formatCompact, formatIndicatorValue, latestRecord } from "@/lib/format";
import type { Country, WdiRecord } from "@/lib/types";

type ModuleId = "overview" | "country" | "compare" | "rankings" | "regions" | "explorer" | "methodology";
type ApiPayload = { records?: WdiRecord[]; error?: string };
const PALETTE = ["#1c4266", "#438d95", "#d6a14b", "#738ab0", "#c36d52", "#6c8b66"];
const REGION_OPTIONS = [
  { code: "SSF", label: "Sub-Saharan Africa" },
  { code: "MEA", label: "Middle East & North Africa" },
  { code: "EAS", label: "East Asia & Pacific" },
  { code: "ECS", label: "Europe & Central Asia" },
  { code: "LCN", label: "Latin America & Caribbean" },
  { code: "SAS", label: "South Asia" },
  { code: "NAC", label: "North America" }
];
const NAV = [
  { id: "overview" as const, label: "Global overview", group: "Workspace", icon: Globe2 },
  { id: "country" as const, label: "Country explorer", group: "Workspace", icon: Compass },
  { id: "compare" as const, label: "Compare economies", group: "Workspace", icon: Activity },
  { id: "rankings" as const, label: "Global rankings", group: "Workspace", icon: BarChart3 },
  { id: "regions" as const, label: "Regional analysis", group: "Workspace", icon: Layers3 },
  { id: "explorer" as const, label: "Data explorer", group: "Research", icon: SlidersHorizontal },
  { id: "methodology" as const, label: "Methodology", group: "Research", icon: BookOpen }
];

function useWdi(indicator: IndicatorKey, countries: string, range: string) {
  const [records, setRecords] = useState<WdiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ indicator, countries });
    if (range === "latest") params.set("latest", "true");
    else params.set("date", range);
    setLoading(true);
    setError("");
    fetch("/api/wdi?" + params.toString(), { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok) throw new Error(payload.error ?? "The data request failed.");
        setRecords(payload.records ?? []);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [indicator, countries, range]);
  return { records, loading, error };
}

function SelectControl({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="select-wrap"><span>{label}</span><span className="select-control"><select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><ChevronDown size={14}/></span></label>;
}

function MetricCard({ label, value, suffix = "", prefix = "", note, accent = false }: { label: string; value?: number; suffix?: string; prefix?: string; note: string; accent?: boolean }) {
  return <div className="metric-card">
    <div className="metric-card-top"><span>{label}</span><span className={accent ? "metric-dot teal" : "metric-dot"}/></div>
    <div className="metric-value">{value === undefined || !Number.isFinite(value) ? <span className="metric-dash">—</span> : <CountUp to={value} duration={1.25} format="compact" decimals={1} separator="," prefix={prefix} suffix={suffix}/>}</div>
    <div className="metric-note">{note}</div>
  </div>;
}

function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={"panel " + className}>
    <div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
    {children}
  </section>;
}

function LoadingState({ loading, error }: { loading: boolean; error?: string }) {
  if (loading) return <div className="data-state"><span className="loading-line"><i/></span><span>Retrieving World Bank observations…</span></div>;
  if (error) return <div className="data-state data-error"><Info size={16}/><span>{error}</span></div>;
  return <div className="data-state"><Info size={16}/><span>No numeric observations are available for this selection.</span></div>;
}

function SourceNote({ year, count }: { year?: number; count?: number }) {
  return <div className="source-note"><span>Source: World Bank · World Development Indicators</span><span>{year ? "Latest observation: " + year : ""}{count !== undefined ? " · " + count + " observations" : ""}</span></div>;
}

function makeChartRows(records: WdiRecord[]) {
  const rows = new Map<number, Record<string, number>>();
  for (const record of records) {
    if (!rows.has(record.year)) rows.set(record.year, { year: record.year });
    rows.get(record.year)![record.countryCode] = record.value;
  }
  return [...rows.values()].sort((a, b) => a.year - b.year);
}

function SeriesChart({ records, loading, error, percent = false, compact = false }: { records: WdiRecord[]; loading: boolean; error?: string; percent?: boolean; compact?: boolean }) {
  const rows = makeChartRows(records);
  const series = [...new Set(records.map((row) => row.countryCode))];
  if (loading || error || !records.length) return <LoadingState loading={loading} error={error}/>;
  return <div className={compact ? "chart-wrap chart-small" : "chart-wrap"}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e8edf2" vertical={false}/>
        <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#7b8b99", fontSize: 10 }} minTickGap={25}/>
        <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7b8b99", fontSize: 10 }} width={compact ? 42 : 58} tickFormatter={(value) => percent ? String(value) + "%" : formatCompact(Number(value))}/>
        <Tooltip labelFormatter={(label) => "Observation year: " + label} formatter={(value) => [percent ? Number(value).toFixed(2) + "%" : formatCompact(Number(value)), "Value"]} contentStyle={{ border: "1px solid #dfe6ed", borderRadius: 8, fontSize: 11 }}/>
        {series.map((code, index) => <Line key={code} type="monotone" dataKey={code} name={code} stroke={PALETTE[index % PALETTE.length]} strokeWidth={2.3} dot={false} activeDot={{ r: 4 }} connectNulls={false}/>)}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function DataTable({ records, countries, indicator }: { records: WdiRecord[]; countries: Country[]; indicator: IndicatorKey }) {
  const names = new Map(countries.map((country) => [country.code, country.name]));
  const ordered = records;
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Economy</th><th>Observation year</th><th className="numeric">{INDICATORS[indicator].shortLabel}</th></tr></thead><tbody>
    {ordered.map((record) => <tr key={record.countryCode + "-" + record.year}><td><span className="country-cell"><span className="country-code">{record.countryCode}</span>{names.get(record.countryCode) ?? record.country}</span></td><td>{record.year}</td><td className="numeric">{formatIndicatorValue(record.value, indicator)}</td></tr>)}
  </tbody></table></div>;
}

function DownloadButton({ records, indicator }: { records: WdiRecord[]; indicator: IndicatorKey }) {
  const handleDownload = () => {
    const header = ["country_code", "country", "year", "indicator", "indicator_code", "value", "unit"];
    const rows = records.map((record) => [record.countryCode, record.country, record.year, INDICATORS[indicator].label, record.indicatorCode, record.value, INDICATORS[indicator].unit]);
    const csv = [header, ...rows].map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "gdp-atlas-" + indicator + "-observations.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <button className="button button-outline" onClick={handleDownload} disabled={!records.length}><ArrowDownToLine size={14}/> Export CSV</button>;
}

function IndicatorSelect({ value, onChange }: { value: IndicatorKey; onChange: (value: IndicatorKey) => void }) {
  return <SelectControl label="Measure" value={value} onChange={(next) => onChange(next as IndicatorKey)}>
    {INDICATOR_KEYS.map((key) => <option key={key} value={key}>{INDICATORS[key].label}</option>)}
  </SelectControl>;
}

function Overview({ countries }: { countries: Country[] }) {
  const worldGdp = useWdi("gdp", "WLD", "1960:2026");
  const worldGrowth = useWdi("growth", "WLD", "1960:2026");
  const worldPerCapita = useWdi("perCapita", "WLD", "latest");
  const allGdp = useWdi("gdp", "all", "latest");
  const latestGdp = latestRecord(worldGdp.records);
  const latestGrowth = latestRecord(worldGrowth.records);
  const latestPerCapita = latestRecord(worldPerCapita.records);
  const names = new Map(countries.map((item) => [item.code, item.name]));
  const validCountryCodes = new Set(countries.map((item) => item.code));
  const latestCountryRows = allGdp.records.filter((row) => validCountryCodes.has(row.countryCode)).sort((a, b) => b.value - a.value);
  const hasError = [worldGdp.error, worldGrowth.error, worldPerCapita.error, allGdp.error].some(Boolean);
  return <>
    <div className="page-intro">
      <div><div className="eyebrow">GLOBAL ECONOMIC INTELLIGENCE</div><h1>Global economic<br className="desktop-break"/> outlook.</h1><p>A grounded view of output, growth and living standards across the world.</p></div>
      <div className="intro-meta"><span className="live-dot"/> World Bank data</div>
    </div>
    {hasError && <div className="notice notice-warn"><Info size={16}/> One or more World Bank series could not be refreshed. Unavailable values are left blank rather than estimated.</div>}
    <div className="metric-grid">
      <MetricCard label="Global GDP" value={latestGdp?.value} prefix="$" note={latestGdp ? "Current US dollars · " + latestGdp.year : "Current US dollars · loading"} accent/>
      <MetricCard label="Real GDP growth" value={latestGrowth?.value} suffix="%" note={latestGrowth ? "Annual change · " + latestGrowth.year : "Annual percentage · loading"}/>
      <MetricCard label="GDP per capita" value={latestPerCapita?.value} prefix="$" note={latestPerCapita ? "Current US dollars · " + latestPerCapita.year : "Current US dollars · loading"}/>
      <MetricCard label="Economies covered" value={latestCountryRows.length || undefined} note="Economies with a latest GDP observation"/>
    </div>
    <div className="content-grid overview-grid">
      <Panel title="Global output through time" subtitle="GDP in current US dollars · values displayed in trillions">
        {worldGdp.loading || worldGdp.error || !worldGdp.records.length ? <LoadingState loading={worldGdp.loading} error={worldGdp.error}/> :
          <div className="chart-wrap chart-large"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={worldGdp.records.map((row) => ({ year: row.year, gdp: row.value / 1e12 })).sort((a, b) => a.year - b.year)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs><linearGradient id="gdpAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#438d95" stopOpacity={0.24}/><stop offset="100%" stopColor="#438d95" stopOpacity={0.015}/></linearGradient></defs>
              <CartesianGrid stroke="#e8edf2" vertical={false}/>
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#7b8b99", fontSize: 10 }} minTickGap={28}/>
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7b8b99", fontSize: 10 }} width={45} tickFormatter={(value) => "$" + value + "T"}/>
              <Tooltip labelFormatter={(label) => "Observation year: " + label} formatter={(value) => ["$" + Number(value).toFixed(2) + " trillion", "Global GDP"]} contentStyle={{ border: "1px solid #dfe6ed", borderRadius: 8, fontSize: 11 }}/>
              <Area type="monotone" dataKey="gdp" stroke="#438d95" strokeWidth={2.5} fill="url(#gdpAreaFill)" connectNulls={false}/>
            </AreaChart>
          </ResponsiveContainer></div>}
        <SourceNote year={latestGdp?.year} count={worldGdp.records.length}/>
      </Panel>
      <Panel title="Largest economies" subtitle="Latest available nominal GDP observations" action={<span className="panel-badge">Current US$</span>}>
        {allGdp.loading || allGdp.error || !latestCountryRows.length ? <LoadingState loading={allGdp.loading} error={allGdp.error}/> :
          <div className="rank-list">{latestCountryRows.slice(0, 8).map((record, index) => <div className="rank-row" key={record.countryCode}>
            <span className="rank-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="rank-name"><strong>{names.get(record.countryCode) ?? record.country}</strong><span>{record.year} observation</span></div>
            <strong className="rank-value">{formatCompact(record.value, "$")}</strong>
          </div>)}</div>}
        <SourceNote year={latestRecord(latestCountryRows)?.year}/>
      </Panel>
    </div>
    <div className="content-grid secondary-grid">
      <Panel title="Real growth, not price growth" subtitle="Annual change in GDP using constant-price data">
        <SeriesChart records={worldGrowth.records} loading={worldGrowth.loading} error={worldGrowth.error} compact percent/>
        <SourceNote year={latestGrowth?.year} count={worldGrowth.records.length}/>
      </Panel>
      <Panel title="Reading the numbers" subtitle="Three measures, three different questions">
        <div className="interpretation-copy">
          <p><strong>Nominal GDP</strong> can rise because output increases, prices rise or exchange rates change. It is not the same as real economic growth.</p>
          <p><strong>Real GDP growth</strong> uses constant-price data to focus on changes in output volume.</p>
          <p><strong>GDP per capita</strong> divides output by population. It is not a direct measure of household income or how prosperity is distributed.</p>
        </div>
        <button className="text-link" onClick={() => window.dispatchEvent(new CustomEvent("gdp-navigate", { detail: "methodology" }))}>Read the methodology <ArrowUpRight size={14}/></button>
      </Panel>
    </div>
  </>;
}

function CountryExplorer({ countries }: { countries: Country[] }) {
  const [code, setCode] = useState("KEN");
  const [indicator, setIndicator] = useState<IndicatorKey>("gdp");
  const data = useWdi(indicator, code, "1960:2026");
  const country = countries.find((item) => item.code === code);
  const latest = latestRecord(data.records);
  return <>
    <div className="page-intro"><div><div className="eyebrow">ECONOMY PROFILE</div><h1>Country explorer.</h1><p>Follow one economy across time, with its indicator definition kept in view.</p></div></div>
    <div className="control-strip">
      <SelectControl label="Economy" value={code} onChange={setCode}>{countries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</SelectControl>
      <IndicatorSelect value={indicator} onChange={setIndicator}/>
    </div>
    <div className="country-summary">
      <div><span className="eyebrow">SELECTED ECONOMY</span><h2>{country?.name ?? code}</h2><p>{country?.region ?? "World Bank region"} · {country?.incomeLevel ?? "Income classification"}</p></div>
      <div className="country-latest"><span>Latest available observation</span><strong>{latest ? formatIndicatorValue(latest.value, indicator) : "—"}</strong><small>{latest?.year ?? "No observation"} · {INDICATORS[indicator].unit}</small></div>
    </div>
    <Panel title={country?.name ?? code} subtitle={INDICATORS[indicator].description} action={<DownloadButton records={data.records} indicator={indicator}/>}>
      <SeriesChart records={data.records} loading={data.loading} error={data.error}/>
      <SourceNote year={latest?.year} count={data.records.length}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Observations" subtitle="The original value and observation year">
      {data.records.length ? <DataTable records={data.records.slice().sort((a, b) => b.year - a.year).slice(0, 30)} countries={countries} indicator={indicator}/> : <LoadingState loading={data.loading} error={data.error}/>}
    </Panel>
  </>;
}

function CountryPicker({ countries, selected, onToggle, limit = 6 }: { countries: Country[]; selected: string[]; onToggle: (code: string) => void; limit?: number }) {
  const [search, setSearch] = useState("");
  const filtered = countries.filter((country) => country.name.toLowerCase().includes(search.toLowerCase()) || country.code.toLowerCase().includes(search.toLowerCase())).slice(0, 18);
  return <div className="picker-block">
    <label className="picker-search"><Search size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an economy by name or code"/></label>
    <div className="country-picker">
      {filtered.map((country) => <button key={country.code} className={selected.includes(country.code) ? "country-chip selected" : "country-chip"} onClick={() => onToggle(country.code)} aria-pressed={selected.includes(country.code)} disabled={!selected.includes(country.code) && selected.length >= limit}>
        <span>{selected.includes(country.code) ? "✓" : "+"}</span>{country.name}
      </button>)}
    </div>
    <div className="picker-foot">{selected.length} of {limit} economies selected</div>
  </div>;
}

function CompareEconomies({ countries }: { countries: Country[] }) {
  const [selected, setSelected] = useState(["KEN", "ZAF", "NGA", "USA"]);
  const [indicator, setIndicator] = useState<IndicatorKey>("gdp");
  const data = useWdi(indicator, selected.join(";"), "2000:2026");
  const toggle = (code: string) => setSelected((current) => current.includes(code) ? (current.length > 1 ? current.filter((item) => item !== code) : current) : current.length < 6 ? [...current, code] : current);
  const latestRows = selected.map((code) => latestRecord(data.records.filter((row) => row.countryCode === code))).filter((row): row is WdiRecord => Boolean(row));
  return <>
    <div className="page-intro"><div><div className="eyebrow">CROSS-COUNTRY RESEARCH</div><h1>Compare economies.</h1><p>Place selected economies on the same measure and time axis.</p></div></div>
    <div className="control-strip"><IndicatorSelect value={indicator} onChange={setIndicator}/></div>
    <Panel title="Choose economies" subtitle="Select up to six economies for a readable comparison">
      <CountryPicker countries={countries} selected={selected} onToggle={toggle}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Comparative trend" subtitle={INDICATORS[indicator].description} action={<DownloadButton records={data.records} indicator={indicator}/>}>
      <SeriesChart records={data.records} loading={data.loading} error={data.error}/>
      <div className="legend-list">{selected.map((code, index) => <span key={code}><i style={{ background: PALETTE[index % PALETTE.length] }}/>{countries.find((item) => item.code === code)?.name ?? code}</span>)}</div>
      <SourceNote year={latestRecord(data.records)?.year}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Latest available values" subtitle="Countries can have different observation years">
      {latestRows.length ? <DataTable records={latestRows} countries={countries} indicator={indicator}/> : <LoadingState loading={data.loading} error={data.error}/>}
    </Panel>
  </>;
}

function Rankings({ countries }: { countries: Country[] }) {
  const [indicator, setIndicator] = useState<IndicatorKey>("gdp");
  const [year, setYear] = useState("latest");
  const data = useWdi(indicator, "all", year === "latest" ? "latest" : year);
  const countryCodes = new Set(countries.map((item) => item.code));
  const ranked = data.records.filter((row) => countryCodes.has(row.countryCode)).sort((a, b) => b.value - a.value);
  return <>
    <div className="page-intro"><div><div className="eyebrow">GLOBAL LEADERBOARD</div><h1>Global rankings.</h1><p>Rank economies using one clearly defined indicator at a time.</p></div></div>
    <div className="control-strip">
      <IndicatorSelect value={indicator} onChange={setIndicator}/>
      <SelectControl label="Observation period" value={year} onChange={setYear}><option value="latest">Latest available</option>{[2025, 2024, 2023, 2022, 2021, 2020].map((item) => <option key={item} value={String(item)}>{item}</option>)}</SelectControl>
    </div>
    <Panel title={INDICATORS[indicator].label} subtitle={year === "latest" ? "Latest non-empty observation for each economy" : "Source observations for " + year}>
      {data.loading || data.error || !ranked.length ? <LoadingState loading={data.loading} error={data.error}/> : <div className="ranking-bars">{ranked.slice(0, 14).map((row, index) => <div className="ranking-bar-row" key={row.countryCode}>
        <div className="ranking-bar-label"><span>{String(index + 1).padStart(2, "0")}</span><strong>{countries.find((item) => item.code === row.countryCode)?.name ?? row.country}</strong><em>{row.year}</em><b>{formatIndicatorValue(row.value, indicator)}</b></div>
        <div className="bar-track"><span style={{ width: (row.value / ranked[0].value * 100) + "%" }}/></div>
      </div>)}</div>}
      <SourceNote year={latestRecord(ranked)?.year} count={ranked.length}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Ranking table" subtitle="Original observations, sorted from largest to smallest" action={<DownloadButton records={ranked} indicator={indicator}/>}>
      {ranked.length ? <DataTable records={ranked.slice(0, 100)} countries={countries} indicator={indicator}/> : <LoadingState loading={data.loading} error={data.error}/>}
    </Panel>
  </>;
}

function RegionalAnalysis({ countries }: { countries: Country[] }) {
  const [region, setRegion] = useState("SSF");
  const [indicator, setIndicator] = useState<IndicatorKey>("gdp");
  const data = useWdi(indicator, "all", "latest");
  const regionalCountries = countries.filter((country) => country.regionCode === region);
  const codes = new Set(regionalCountries.map((country) => country.code));
  const rows = data.records.filter((row) => codes.has(row.countryCode)).sort((a, b) => b.value - a.value);
  const name = REGION_OPTIONS.find((item) => item.code === region)?.label ?? region;
  return <>
    <div className="page-intro"><div><div className="eyebrow">REGIONAL PICTURE</div><h1>Regional analysis.</h1><p>Explore the distribution of output among economies grouped by World Bank region.</p></div></div>
    <div className="control-strip">
      <SelectControl label="World Bank region" value={region} onChange={setRegion}>{REGION_OPTIONS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</SelectControl>
      <IndicatorSelect value={indicator} onChange={setIndicator}/>
    </div>
    <div className="country-summary"><div><span className="eyebrow">SELECTED REGION</span><h2>{name}</h2><p>{regionalCountries.length} economies in the current country directory</p></div><div className="country-latest"><span>Largest available observation</span><strong>{rows[0] ? formatIndicatorValue(rows[0].value, indicator) : "—"}</strong><small>{rows[0]?.country ?? "Waiting for data"}</small></div></div>
    <Panel title="Economies within the region" subtitle={INDICATORS[indicator].description} action={<DownloadButton records={rows} indicator={indicator}/>}>
      {rows.length ? <DataTable records={rows} countries={countries} indicator={indicator}/> : <LoadingState loading={data.loading} error={data.error}/>}
      <SourceNote year={latestRecord(rows)?.year} count={rows.length}/>
    </Panel>
    <div className="notice"><Info size={16}/>Regional membership follows World Bank country metadata. This country grouping is not itself a calculated regional GDP total.</div>
  </>;
}

function DataExplorer({ countries }: { countries: Country[] }) {
  const [indicator, setIndicator] = useState<IndicatorKey>("gdp");
  const [selected, setSelected] = useState(["KEN", "USA"]);
  const [from, setFrom] = useState("2000");
  const [to, setTo] = useState("2025");
  const data = useWdi(indicator, selected.join(";"), from + ":" + to);
  const toggle = (code: string) => setSelected((current) => current.includes(code) ? (current.length > 1 ? current.filter((item) => item !== code) : current) : current.length < 6 ? [...current, code] : current);
  const invalidRange = Number(from) > Number(to);
  return <>
    <div className="page-intro"><div><div className="eyebrow">CUSTOM DATASET</div><h1>Data explorer.</h1><p>Build a dataset, inspect the source observations and export the underlying values.</p></div><DownloadButton records={invalidRange ? [] : data.records} indicator={indicator}/></div>
    <div className="explorer-controls">
      <IndicatorSelect value={indicator} onChange={setIndicator}/>
      <SelectControl label="From year" value={from} onChange={setFrom}>{Array.from({ length: 67 }, (_, index) => 1960 + index).map((item) => <option key={item} value={String(item)}>{item}</option>)}</SelectControl>
      <SelectControl label="To year" value={to} onChange={setTo}>{Array.from({ length: 67 }, (_, index) => 1960 + index).map((item) => <option key={item} value={String(item)}>{item}</option>)}</SelectControl>
    </div>
    {invalidRange && <div className="notice notice-warn"><Info size={16}/>The starting year must be earlier than or equal to the ending year.</div>}
    <Panel title="Economy selection" subtitle="Choose up to six economies">
      <CountryPicker countries={countries} selected={selected} onToggle={toggle}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Selected series" subtitle={INDICATORS[indicator].description} action={<DownloadButton records={invalidRange ? [] : data.records} indicator={indicator}/>}>
      {invalidRange ? <LoadingState loading={false}/> : <SeriesChart records={data.records} loading={data.loading} error={data.error}/>}
      <SourceNote year={latestRecord(data.records)?.year} count={data.records.length}/>
    </Panel>
    <div className="spacer-block"/>
    <Panel title="Source observations" subtitle={data.records.length + " numeric rows returned by the World Bank API"}>
      {data.records.length && !invalidRange ? <DataTable records={data.records.slice().sort((a, b) => b.year - a.year)} countries={countries} indicator={indicator}/> : <LoadingState loading={data.loading} error={data.error}/>}
    </Panel>
  </>;
}

function Methodology() {
  return <>
    <div className="page-intro"><div><div className="eyebrow">DEFINITIONS & SOURCES</div><h1>Methodology.</h1><p>Each indicator answers a different economic question. Units and price bases matter.</p></div></div>
    <div className="method-list">{INDICATOR_KEYS.map((key) => <article className="method-row" key={key}>
      <div><span className="method-code">{INDICATORS[key].id}</span><h2>{INDICATORS[key].label}</h2><p>{INDICATORS[key].description}</p></div><span className="method-unit">{INDICATORS[key].unit}</span>
    </article>)}</div>
    <Panel title="Source and revision practice" subtitle="How GDP Atlas handles public statistics">
      <div className="interpretation-copy">
        <p><strong>Primary source.</strong> World Bank, World Development Indicators, accessed through the public Indicators API v2.</p>
        <p><strong>Missing values.</strong> Blank observations are not replaced with zero. A value appears only when the source returns a numeric observation.</p>
        <p><strong>Observation dates.</strong> Latest available years may differ by indicator and economy. The year is shown alongside each reported value.</p>
        <p><strong>Revisions.</strong> The World Bank may revise historical observations. Responses are cached temporarily, so a later download may differ from an earlier view.</p>
        <p><strong>Comparability.</strong> Current-dollar GDP, constant-price GDP, annual growth, GDP per capita and PPP measures remain distinct series. They must not be combined as though they shared units or interpretation.</p>
      </div>
      <a className="text-link" href="https://datahelpdesk.worldbank.org/knowledgebase/articles/889392" target="_blank" rel="noreferrer">World Bank Indicators API documentation <ArrowUpRight size={14}/></a>
    </Panel>
  </>;
}

function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => {
    setVisible(!document.cookie.split("; ").some((item) => item.startsWith("gdp_atlas_consent=")));
  }, []);
  const save = (allowAnalytics: boolean) => {
    const value = encodeURIComponent(JSON.stringify({ essential: true, analytics: allowAnalytics, savedAt: new Date().toISOString() }));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = "gdp_atlas_consent=" + value + "; Max-Age=31536000; Path=/; SameSite=Lax" + secure;
    setVisible(false);
  };
  if (!visible) return null;
  return <div className="cookie-wrap" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
    <div className="cookie-card"><button className="cookie-close" onClick={() => save(false)} aria-label="Close cookie notice"><X size={16}/></button>
      <div className="eyebrow">YOUR PREFERENCES</div><h2 id="cookie-title">A note about cookies</h2>
      <p>One essential cookie remembers this choice. Optional analytics are off and no advertising trackers are included in this release.</p>
      {settings && <div className="cookie-settings">
        <div className="cookie-setting-row"><div><strong>Essential preferences</strong><span>Stores your consent choice. Always on.</span></div><em>Always on</em></div>
        <label className="cookie-setting-row"><div><strong>Optional analytics</strong><span>No analytics provider is connected in this release.</span></div><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)}/></label>
      </div>}
      <div className="cookie-actions"><button className="button button-muted" onClick={() => save(false)}>Essential only</button>{settings ? <button className="button button-primary" onClick={() => save(analytics)}>Save preferences</button> : <button className="button button-muted" onClick={() => setSettings(true)}>Preferences</button>}</div>
    </div>
  </div>;
}

export default function Dashboard() {
  const [active, setActive] = useState<ModuleId>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryLoading, setCountryLoading] = useState(true);
  const [countryError, setCountryError] = useState("");
  const activeItem = NAV.find((item) => item.id === active) ?? NAV[0];
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/countries", { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load the country directory.");
        setCountries(payload.countries ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") setCountryError(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setCountryLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const handler = (event: Event) => setActive((event as CustomEvent<ModuleId>).detail);
    window.addEventListener("gdp-navigate", handler);
    return () => window.removeEventListener("gdp-navigate", handler);
  }, []);
  const groups = ["Workspace", "Research"];
  const content = useMemo(() => {
    if (countryLoading) return <div className="welcome-state"><span className="loading-line"><i/></span><h2>Preparing the country directory</h2><p>Loading country metadata from the World Bank.</p></div>;
    if (countryError) return <div className="welcome-state"><Info size={23}/><h2>The country directory is unavailable</h2><p>{countryError}</p><button className="button button-outline" onClick={() => window.location.reload()}>Try again</button></div>;
    if (active === "overview") return <Overview countries={countries}/>;
    if (active === "country") return <CountryExplorer countries={countries}/>;
    if (active === "compare") return <CompareEconomies countries={countries}/>;
    if (active === "rankings") return <Rankings countries={countries}/>;
    if (active === "regions") return <RegionalAnalysis countries={countries}/>;
    if (active === "explorer") return <DataExplorer countries={countries}/>;
    return <Methodology/>;
  }, [active, countries, countryLoading, countryError]);
  const navigate = (id: ModuleId) => { setActive(id); setMobileOpen(false); };
  return <div className="app-shell">
    <aside className={mobileOpen ? "sidebar mobile-open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">G</span><span>GDP Atlas<small>ECONOMIC DATA, CLEARLY</small></span></div>
      <div className="sidebar-rule"/>
      {groups.map((group) => <div className="nav-group" key={group}>
        <div className="nav-label">{group}</div>
        {NAV.filter((item) => item.group === group).map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)}><Icon size={16}/><span>{item.label}</span></button>;
        })}
      </div>)}
      <div className="sidebar-bottom"><div className="source-status"><span className="live-dot"/> Public data source</div><p>Independent research interface.<br/>Not an official World Bank product.</p></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}
    <main className="main-shell">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button>
        <div className="breadcrumb">Research workspace <span>/</span> <strong>{activeItem.label}</strong></div>
        <div className="topbar-right"><span className="source-pill"><i/> WORLD BANK DATA</span><button className="topbar-link" onClick={() => navigate("methodology")}>About the data</button></div>
      </header>
      <div className="page-content">{content}
        <footer className="site-footer"><span>GDP Atlas · An independent economic research project</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="https://data.worldbank.org/" target="_blank" rel="noreferrer">World Bank data ↗</a></div></footer>
      </div>
    </main>
    <CookieConsent/>
  </div>;
}
