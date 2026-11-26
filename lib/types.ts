export type WdiRecord = {
  countryCode: string;
  country: string;
  year: number;
  value: number;
  indicatorCode: string;
  indicator: string;
  unit: string;
};

export type Country = {
  code: string;
  iso2Code: string;
  name: string;
  regionCode: string;
  region: string;
  incomeLevel: string;
  capitalCity: string;
};