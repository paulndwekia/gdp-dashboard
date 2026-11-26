import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GDP Atlas | Global economic data", template: "%s | GDP Atlas" },
  description: "Explore GDP, economic growth and living standards across economies with transparent World Bank data.",
  applicationName: "GDP Atlas",
  openGraph: { title: "GDP Atlas", description: "A clear view of the world economy.", type: "website" },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}