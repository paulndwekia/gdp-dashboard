import Link from "next/link";

export const metadata = {
  title: "Cookies | GDP Research",
  description: "The cookies used by GDP Research and how to change your preferences.",
};

export default function CookiesPage() {
  return (
    <main className="legal-shell">
      <Link className="legal-back" href="/">← Back to GDP Research</Link>
      <div className="eyebrow">GDP RESEARCH · COOKIES</div>
      <h1>Cookies we use</h1>
      <p className="legal-lead">We keep cookies to a minimum. The current application uses a single cookie to remember your privacy choice.</p>
      <section className="legal-section">
        <h2>Essential preference cookie</h2>
        <p><code>gdp_research_cookie_choices</code> stores whether you selected essential-only cookies or allowed optional analytics for a possible future feature. It expires after one year, is limited to this site, and uses <code>SameSite=Lax</code>. It is marked <code>Secure</code> on HTTPS connections.</p>
      </section>
      <section className="legal-section">
        <h2>Analytics and marketing</h2>
        <p>No analytics, advertising or social-media tracking cookies are currently installed by GDP Research. If optional analytics are introduced, the dashboard must first describe the provider, purpose and retention period and respect the visitor's choice.</p>
      </section>
      <section className="legal-section">
        <h2>Change your choice</h2>
        <p>Use the Cookie choices button at the bottom of the dashboard to change the saved preference, or clear cookies using your browser settings.</p>
      </section>
      <footer className="legal-footer"><Link href="/">GDP Research</Link> · <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Use</Link></footer>
    </main>
  );
}
