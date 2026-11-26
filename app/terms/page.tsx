import Link from "next/link";

export const metadata = {
  title: "Terms of Use | GDP Research",
  description: "Terms for using GDP Research and its public economic-data features.",
};

export default function TermsPage() {
  return (
    <main className="legal-shell">
      <Link className="legal-back" href="/">← Back to GDP Research</Link>
      <div className="eyebrow">GDP RESEARCH · TERMS</div>
      <h1>Terms of use</h1>
      <p className="legal-lead">GDP Research is an independent information and research application. These terms explain what the figures mean, how the material may be used and where its limits are.</p>

      <section className="legal-section">
        <h2>What this application provides</h2>
        <p>The dashboard organises public economic indicators into charts, tables, comparisons and simple calculations. It is intended for research, learning and general information. It is not an official product of the World Bank or the International Monetary Fund.</p>
      </section>

      <section className="legal-section">
        <h2>Sources, revisions and attribution</h2>
        <p>Reported observations are retrieved from the original data provider where possible. Estimates and projections are labelled separately from historical reported observations. Public datasets can be revised, restated or temporarily unavailable. Always check the source page and its release notes before relying on a figure in a formal publication, decision or regulatory filing.</p>
        <p>When reusing data, retain the relevant source attribution and follow the provider's own terms for that dataset. The dashboard's charts and calculations do not change the ownership or reuse conditions of the underlying data.</p>
      </section>

      <section className="legal-section">
        <h2>Calculations and interpretation</h2>
        <p>Some values are calculated by the dashboard, including annual percentage changes, compound annual growth rates and indexed comparisons. We explain these calculations in the Methodology section. They are simplified analytical views and may differ from a provider's own national-account estimates or revisions.</p>
      </section>

      <section className="legal-section">
        <h2>No professional advice</h2>
        <p>Nothing on this site is investment, legal, accounting, tax or other professional advice. Do not use a dashboard figure as the only basis for an investment, lending, policy or business decision. Check the original source and obtain appropriate professional advice for decisions that require it.</p>
      </section>

      <section className="legal-section">
        <h2>Availability and acceptable use</h2>
        <p>We aim to keep the application useful and available, but we do not promise uninterrupted access or that every provider endpoint will respond at all times. Do not attempt to disrupt the site, bypass its controls, overload the data endpoints or use it to violate another person's rights or applicable law.</p>
      </section>

      <section className="legal-section">
        <h2>Third-party services and links</h2>
        <p>The dashboard links to external source providers and is hosted by a third-party platform. Those services operate under their own terms and privacy policies. We do not control their availability or their published data-release schedules.</p>
      </section>

      <section className="legal-section">
        <h2>Updates to these terms</h2>
        <p>These terms may need to change as features are added. Before a public commercial launch, the site owner should review them for the final operating model, source reuse rights and applicable law.</p>
      </section>
      <footer className="legal-footer"><Link href="/">GDP Research</Link> · <Link href="/privacy">Privacy Policy</Link></footer>
    </main>
  );
}
