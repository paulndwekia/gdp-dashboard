import Link from "next/link";
export const metadata = { title: "Privacy policy" };
export default function PrivacyPage() {
  return <main className="legal-shell">
    <Link href="/" className="legal-back">← Back to GDP Atlas</Link>
    <div className="eyebrow">POLICIES</div><h1>Privacy policy</h1>
    <p className="legal-updated">Last reviewed: 26 November 2026</p>
    <p>GDP Atlas is an economic-data research interface. The dashboard is designed to work without an account and does not ask visitors to submit personal or financial information.</p>
    <h2>Information processed</h2>
    <p>When you use the dashboard, your browser sends selected indicator, country codes and date range to GDP Atlas data routes. Those routes request public economic statistics from the World Bank Indicators API. The application does not require a name, email address or account identifier.</p>
    <h2>Cookies and local preferences</h2>
    <p>GDP Atlas uses one first-party consent cookie to remember your choice. Essential functionality does not depend on advertising cookies. Optional analytics are not enabled in this release; no third-party analytics script is included. You can reject optional cookies and continue using the research features.</p>
    <h2>External data providers</h2>
    <p>Economic observations and country metadata are retrieved from the World Bank. The World Bank may receive the indicator and country/date query necessary to return the public dataset. Its own privacy and service terms apply to that request.</p>
    <h2>Data retention and security</h2>
    <p>The site does not create user profiles. Public data responses may be cached to improve performance. Security headers, input validation and server-side data requests are used to reduce common web risks. No internet service can be guaranteed completely secure.</p>
    <h2>Your choices</h2>
    <p>You can clear the GDP Atlas consent cookie in your browser settings. Because the application does not require an account, there is no user profile to export or delete.</p>
    <h2>Contact</h2>
    <p>A verified operator contact address should be added before the site is used as a formal commercial service.</p>
    <div className="legal-footer"><Link href="/terms">Terms of use</Link><Link href="/">Dashboard</Link></div>
  </main>;
}