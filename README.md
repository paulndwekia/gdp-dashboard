# GDP Research Dashboard

GDP Research is an independent economic research application for discovering, comparing and understanding official macroeconomic indicators. It keeps the original research modules and adds a searchable indicator library, source provenance, CSV downloads, privacy controls and clearer methodology.

## What it does

- Global overview of reported nominal GDP.
- Country GDP profiles and history.
- Cross-country GDP comparisons, including indexed comparisons.
- Regional aggregates and trend monitoring.
- Nominal GDP growth distribution and rankings.
- A scenario lab for transparent user assumptions.
- A searchable World Bank indicator library for exploring measures beyond GDP, including inflation, labour markets, population, trade and income.
- A separate IMF World Economic Outlook panel for estimates and projections.
- Downloadable observation tables with source details.

## Data sources and refresh model

- **Reported annual GDP:** World Bank Indicators API v2, GDP (current US$), `NY.GDP.MKTP.CD`.
- **Estimates and projections:** IMF DataMapper API v2, nominal GDP at current prices (`NGDPD`) and real GDP growth (`NGDP_RPCH`).
- **Broader indicator research:** World Bank World Development Indicators catalogue and country series, queried through the Data Explorer.
- **Refresh cadence:** Official source data is checked on initial page load, on request and automatically while the dashboard is open. Server responses are cached for up to six hours; indicator definitions are cached for up to 24 hours.
- **Source timing:** GDP is an annual national-accounts measure and is not a tick-by-tick market price. “Live” means the application checks for the latest official release and revisions. The interface records the source's last-update date where the provider supplies it and separately records when the dashboard last checked.
- **Evidence separation:** World Bank observations are shown as reported source data. IMF estimates and projections beyond a country's last reported observation are shown separately, not disguised as actual historical data.
- **Resilience:** If the World Bank GDP API is unavailable, the bundled CSV can be used as a visibly flagged fallback. If a source is unavailable, the dashboard retains the last usable layer and displays a warning instead of silently presenting an empty result.

## Privacy and security baseline

- No account system, advertising scripts or analytics trackers are currently installed.
- A small essential cookie remembers the visitor's cookie preference.
- Security headers include HTTPS Strict Transport Security, clickjacking protection, content-type protection, a restrictive Content Security Policy, referrer policy and a reduced permissions policy.
- Data API parameters are validated and upstream endpoints are fixed to approved public providers.

The privacy, cookie and terms pages describe the current implementation. They should be reviewed against the final hosting, analytics and legal setup before a public commercial launch.

## Technology

- Next.js App Router, React and TypeScript
- Recharts
- Vercel deployment
- Server-side data access through route handlers

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Build:

```bash
npm run build
```

## Official source documentation

- [World Bank Indicators API v2 documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392)
- [World Bank API call structures](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures)
- [World Bank GDP (current US$)](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD)
- [IMF DataMapper API documentation](https://www.imf.org/external/datamapper/api/help)
- [IMF WEO database](https://www.imf.org/en/Publications/WEO/weo-database)

GDP Research is an independent analytical application. It is not an official World Bank or IMF product.
