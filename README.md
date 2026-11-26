# GDP Research Dashboard

An independent global economic research dashboard for exploring GDP history, country profiles, comparisons, regional aggregates, growth analytics, rankings, and transparent scenarios.

## Data architecture

The dashboard no longer relies on the repository's 2022 CSV as its main data feed.

- **Reported historical observations:** World Bank Indicators API, GDP (current US$), `NY.GDP.MKTP.CD`.
- **Current estimates and forward outlook:** IMF World Economic Outlook DataMapper API, nominal GDP at current prices (`NGDPD`) and real GDP growth (`NGDP_RPCH`).
- **Separation of evidence:** World Bank observations remain the reported-data series. IMF values beyond each country's latest reported World Bank year appear in a separate estimates-and-projections panel. They are not presented as official actuals.
- **Refresh cadence:** server-side source responses are cached for up to six hours. The dashboard also provides a manual refresh action.
- **Fallback behaviour:** if the World Bank API is unavailable, the bundled CSV can be served as a clearly flagged fallback. If the IMF feed is unavailable, the World Bank reported-data layer remains available and a source notice is shown.

The IMF World Economic Outlook is released twice a year. Automatic refresh checks for new data but does not create higher-frequency GDP observations than official sources publish.

## Technology

- Next.js App Router
- React and TypeScript
- Recharts
- Vercel deployment
- Server-side data access through API route handlers

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Build for deployment:

```bash
npm run build
```

## Sources

- [World Bank GDP (current US$)](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD)
- [World Bank Indicators API documentation](https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries)
- [IMF World Economic Outlook dataset](https://data.imf.org/en/datasets/IMF.RES%3AWEO)
- [IMF DataMapper API](https://www.imf.org/external/datamapper/api/v1/help)

This is an independent analytical application. It is not an official World Bank or IMF product.
