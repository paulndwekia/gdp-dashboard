"use client";

import { useEffect, useState } from "react";

type CookieChoice = { essential: true; analytics: boolean; savedAt: string };
const COOKIE_NAME = "gdp_research_cookie_choices";

function readPreference(): CookieChoice | null {
  const entry = document.cookie.split("; ").find((item) => item.startsWith(COOKIE_NAME + "="));
  if (!entry) return null;
  try {
    return JSON.parse(decodeURIComponent(entry.slice(COOKIE_NAME.length + 1))) as CookieChoice;
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [manage, setManage] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const stored = readPreference();
    setOpen(!stored);
    setAnalytics(stored?.analytics || false);
  }, []);

  function save(allowAnalytics: boolean) {
    const choice: CookieChoice = { essential: true, analytics: allowAnalytics, savedAt: new Date().toISOString() };
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(choice))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    setAnalytics(allowAnalytics);
    setOpen(false);
    setManage(false);
  }

  return (
    <>
      <button className="cookie-manage" type="button" onClick={() => { setManage(true); setOpen(true); }}>
        Cookie choices
      </button>
      {open && (
        <div className="cookie-backdrop" role="presentation">
          <section className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-heading">
            <div className="cookie-heading-row">
              <div>
                <div className="panel-kicker">YOUR PRIVACY</div>
                <h2 id="cookie-heading">Cookie choices</h2>
              </div>
              <button className="cookie-close" type="button" aria-label="Close cookie choices" onClick={() => { setOpen(false); setManage(false); }}>×</button>
            </div>
            <p>We use one small cookie to remember the privacy choice you make here. The dashboard does not currently run advertising or analytics trackers.</p>
            <div className="cookie-choice-row">
              <div><strong>Essential</strong><small>Remembers this choice and is always on.</small></div>
              <span className="cookie-always">Always active</span>
            </div>
            {manage && (
              <label className="cookie-choice-row cookie-toggle-row">
                <span><strong>Optional analytics</strong><small>Keep this off unless an analytics feature is introduced and you choose to enable it.</small></span>
                <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
              </label>
            )}
            <div className="cookie-actions">
              <button type="button" className="cookie-secondary" onClick={() => save(false)}>Essential only</button>
              {manage
                ? <button type="button" className="cookie-primary" onClick={() => save(analytics)}>Save choices</button>
                : <button type="button" className="cookie-secondary" onClick={() => setManage(true)}>Manage</button>}
              <button type="button" className="cookie-primary" onClick={() => save(true)}>Allow optional analytics</button>
            </div>
            <p className="cookie-legal">Read our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a>. Choosing analytics now only records your preference; no analytics tracker is currently installed.</p>
          </section>
        </div>
      )}
    </>
  );
}
