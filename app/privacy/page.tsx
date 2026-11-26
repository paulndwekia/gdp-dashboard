import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | GDP Research",
  description: "How GDP Research handles website data and cookie preferences.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <Link className="legal-back" href="/">← Back to GDP Research</Link>
      <div className="eyebrow">GDP RESEARCH · PRIVACY</div>
      <h1>Privacy, in plain language</h1>
      <p className="legal-lead">We built this research tool to help people understand economic data. It is not designed to profile visitors, sell personal information or follow people around the web.</p>

      <section className="legal-section">
        <h2>What the site stores</h2>
        <p>The site does not ask you to create an account and does not currently collect a name, email address, telephone number or payment information. It stores one essential cookie called <code>gdp_research_cookie_choices</code> so the site can remember whether you chose essential-only cookies or allowed optional analytics in the future.</p>
        <p>The cookie contains your preference and the time you saved it. It is set with a one-year expiry, the <code>SameSite=Lax</code> attribute and the <code>Secure</code> attribute when the site is served over HTTPS. It is not used to identify you.</p>
      </section>

      <section className="legal-section">
        <h2>Analytics and advertising</h2>
        <p>There is currently no advertising network or analytics tracker installed in this dashboard. The optional analytics preference is recorded so that a choice can be remembered if a properly disclosed analytics feature is added later. No analytics scripts are loaded today.</p>
      </section>

      <section className="legal-section">
        <h2>Economic data sources</h2>
        <p>When you explore an indicator, the dashboard's server requests data from the World Bank and, for the outlook panel, the International Monetary Fund. These requests are made by the application server rather than by sending your search history or identity to those data providers. The results shown are economic observations and metadata, not personal information about visitors.</p>
      </section>

      <section className="legal-section">
        <h2>Hosting and security logs</h2>
        <p>The site is hosted on Vercel. Like most hosting services, the host may process technical request information, such as IP address, browser details, timestamps and error events, to deliver the service, protect it and diagnose faults. That processing is governed by the hosting provider's own privacy terms and retention settings.</p>
      </section>

      <section className="legal-section">
        <h2>Retention and your choices</h2>
        <p>Your cookie preference remains in your browser for up to one year, unless you clear it sooner. Use the “Cookie choices” control on the site to change your preference. You can also clear site cookies through your browser settings.</p>
      </section>

      <section className="legal-section">
        <h2>Changes to this policy</h2>
        <p>If the dashboard begins using accounts, analytics, contact forms, advertising or other personal-data features, this policy must be reviewed and updated before those features are enabled. The policy should be checked again before a public launch to confirm that it matches the final hosting configuration and applicable privacy obligations.</p>
      </section>
      <footer className="legal-footer"><Link href="/">GDP Research</Link> · <Link href="/terms">Terms of Use</Link></footer>
    </main>
  );
}
