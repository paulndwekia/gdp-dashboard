# GDP Research — Global Economic Monitor

An independent GDP research dashboard migrated from the original Streamlit template to **Next.js on Vercel**. The application uses the World Bank GDP (current US$) dataset stored in this repository.

## Research workspaces

- **Overview:** world GDP history, latest world observation and largest national economies.
- **Country profile:** historical GDP, consecutive-year nominal change and selected-period CAGR.
- **Compare economies:** nominal GDP levels or indexed paths with each series starting at 100.
- **Regional monitor:** source-provided regional aggregate series, kept separate from country rows.
- **Growth analytics:** nominal-change distribution, yearly medians and latest observations.
- **Rankings:** GDP size, latest annual nominal change or nominal CAGR.
- **Forecast lab:** simple user-assumption scenarios based on the latest observation.
- **Methodology:** source coverage, definitions and limitations.

## Hosting and architecture

- **Hosting:** Vercel.
- **Framework:** Next.js App Router.
- **Charts:** Recharts.
- **Source data:** \`data/gdp_data.csv\`.
- **Database:** none is connected. The historical dataset is read from this repository and served by the app's own API route.

This is a standalone project. It does not share application logic, database tables, authentication or runtime services with other applications.

## Local development

Node.js 20.9 or later is required.

\`\`\`bash
npm install
npm run dev
\`\`\`

Open http://localhost:3000.

## Production build

\`\`\`bash
npm run build
npm run start
\`\`\`

## Data

The bundled file contains World Bank GDP (current US$), indicator \`NY.GDP.MKTP.CD\`, with year columns from 1960 through 2022. Individual countries can have shorter coverage or missing years.

Source: [World Bank Open Data — GDP (current US$)](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD).

## Interpretation notes

- GDP values are **nominal current US dollars**, not inflation-adjusted real GDP.
- Annual changes may reflect domestic price movements and exchange-rate effects as well as changes in output.
- Growth is calculated only when both years are present and consecutive. Missing years are not interpolated.
- Regional and income-group aggregates are kept separate from country rankings.
- Forecast Lab produces mechanical scenarios from user-entered assumptions; it does not publish official forecasts or predict real GDP.

## Vercel deployment

Import this repository as a separate Vercel project and use the Next.js framework preset. The project root is the repository root. No database environment variables are required for the included historical dataset.

The migration is developed on the \`rebuild/gdp-analytics-dashboard\` branch. The production branch should only be switched after preview validation.