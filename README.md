# GDP Atlas

GDP Atlas is a source-first macroeconomic research dashboard built with Next.js, React and TypeScript. It replaces the original Streamlit sample, which relied on a static GDP CSV through 2022.

## Product sections

- **Global overview:** long-run world output, real GDP growth, GDP per capita and the largest economies.
- **Country explorer:** individual economy history, indicator definitions and observation tables.
- **Compare economies:** compare up to six economies on the same measure.
- **Global rankings:** rank country observations for one indicator and period.
- **Regional analysis:** explore the World Bank's regional country classification.
- **Data explorer:** choose an indicator, countries and year window, then export CSV observations.
- **Methodology:** definitions, units, missing-data practice and source notes.

## Data

The initial source is the World Bank World Development Indicators API v2. Each measure remains separate:
- Nominal GDP: `NY.GDP.MKTP.CD`
- Real GDP growth: `NY.GDP.MKTP.KD.ZG`
- GDP per capita (current US$): `NY.GDP.PCAP.CD`
- GDP, PPP (current international $): `NY.GDP.MKTP.PP.CD`
- GDP per capita, PPP (constant 2021 international $): `NY.GDP.PCAP.PP.KD`
- Real GDP (constant 2015 US$): `NY.GDP.MKTP.KD`

API requests are made from Next.js route handlers, validated and cached. Missing values are omitted rather than replaced with zero. The year shown is the source observation year; different indicators and countries may have different latest years.

## Local development

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Before merging, run:

```bash
npm run typecheck
npm run lint
npm run build
```

## Deployment

Vercel can deploy the repository as a Next.js application from its root directory. No API key or database is required for the public World Bank data routes.

## Privacy and security

The app does not require user accounts. The consent preference is stored in a first-party cookie; optional analytics are not enabled. API inputs are validated in server routes, responses are cached, and baseline security headers are configured in `next.config.ts`.

## Attribution

Data: World Bank, World Development Indicators. React Bits CountUp component attribution and licensing are documented in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The project is independent and is not an official World Bank product.