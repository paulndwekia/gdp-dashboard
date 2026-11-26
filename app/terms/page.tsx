import Link from "next/link";
export const metadata = { title: "Terms of use" };
export default function TermsPage() {
  return <main className="legal-shell">
    <Link href="/" className="legal-back">← Back to GDP Atlas</Link>
    <div className="eyebrow">POLICIES</div><h1>Terms of use</h1>
    <p className="legal-updated">Last reviewed: 26 November 2026</p>
    <p>GDP Atlas provides tools for exploring public macroeconomic statistics. By using the site, you agree to use the information lawfully and to check source definitions before relying on a figure.</p>
    <h2>Research use only</h2>
    <p>GDP Atlas is an educational and research tool. It is not investment, legal, accounting, tax or other professional advice. Economic indicators describe different concepts and may be revised by their publisher. A chart, ranking or comparison is not a recommendation to buy, sell or hold an asset.</p>
    <h2>Data and attribution</h2>
    <p>Unless a page says otherwise, GDP Atlas obtains economic observations from the World Bank World Development Indicators. The original provider remains responsible for its dataset, definitions, revisions and availability. Source links and indicator descriptions should be read with each result.</p>
    <h2>Accuracy and availability</h2>
    <p>We aim to display data clearly and avoid mixing nominal, constant-price, growth, per-capita and purchasing-power-parity measures. Data availability differs by economy and year. Values can be missing, revised or temporarily unavailable. The site is provided on an “as is” and “as available” basis.</p>
    <h2>Permitted use</h2>
    <p>You may use the site for lawful personal, academic and professional research. You must not attempt to disrupt the service, bypass reasonable technical protections, or present the interface as an official World Bank product.</p>
    <h2>Third-party services</h2>
    <p>Links and data services operated by third parties are governed by their own terms. GDP Atlas does not control external services or guarantee their continuous availability.</p>
    <h2>Changes</h2><p>These terms may be updated as the project develops.</p>
    <div className="legal-footer"><Link href="/privacy">Privacy policy</Link><Link href="/">Dashboard</Link></div>
  </main>;
}