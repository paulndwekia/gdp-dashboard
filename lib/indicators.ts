export const INDICATORS = {
  gdp: {
    id: "NY.GDP.MKTP.CD",
    label: "GDP (current US$)",
    shortLabel: "Nominal GDP",
    unit: "Current US dollars",
    description: "The market value of all final goods and services produced within an economy in a given year, measured in current US dollars."
  },
  growth: {
    id: "NY.GDP.MKTP.KD.ZG",
    label: "GDP growth (annual %)",
    shortLabel: "Real GDP growth",
    unit: "Annual percent",
    description: "Annual percentage growth of GDP based on constant-price data. This measures changes in real output rather than changes in current-dollar values."
  },
  perCapita: {
    id: "NY.GDP.PCAP.CD",
    label: "GDP per capita (current US$)",
    shortLabel: "GDP per capita",
    unit: "Current US dollars per person",
    description: "GDP divided by midyear population. This current-dollar measure is not adjusted for differences in national price levels."
  },
  gdpPpp: {
    id: "NY.GDP.MKTP.PP.CD",
    label: "GDP, PPP (current international $)",
    shortLabel: "GDP at PPP",
    unit: "Current international dollars",
    description: "GDP converted to international dollars using purchasing power parity conversion factors for price-level comparisons across economies."
  },
  perCapitaPpp: {
    id: "NY.GDP.PCAP.PP.KD",
    label: "GDP per capita, PPP (constant 2021 international $)",
    shortLabel: "GDP per capita at PPP",
    unit: "Constant 2021 international dollars per person",
    description: "GDP per person expressed in constant 2021 international dollars, adjusted for purchasing power and inflation over time."
  },
  realGdp: {
    id: "NY.GDP.MKTP.KD",
    label: "GDP (constant 2015 US$)",
    shortLabel: "Real GDP",
    unit: "Constant 2015 US dollars",
    description: "GDP expressed in constant 2015 US dollars to remove the effect of price changes over time."
  }
} as const;

export type IndicatorKey = keyof typeof INDICATORS;
export const INDICATOR_KEYS = Object.keys(INDICATORS) as IndicatorKey[];

export function isIndicatorKey(value: string): value is IndicatorKey {
  return Object.prototype.hasOwnProperty.call(INDICATORS, value);
}