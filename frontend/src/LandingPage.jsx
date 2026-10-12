import { useState } from 'react';
import { ArrowRight, Search, ShieldCheck } from 'lucide-react';
import './LandingPage.css';

const capabilities = [
  ['Deep search', 'search'],
  ['Narrative mutation', 'mutation'],
  ['Demographics', 'demographics'],
  ['Network intel', 'network_intel'],
  ['YouTube feed', null],
];

function DashboardLink({ children, className = '' }) {
  return <a className={className} href="/dashboard/">{children}</a>;
}

export default function LandingPage() {
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState('');

  const handleSearch = (event) => {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSearchError('Enter a topic, narrative, or entity to search.');
      return;
    }
    window.location.assign(`/dashboard/?q=${encodeURIComponent(cleanQuery)}`);
  };

  return (
    <div className="landing-page">
      <header className="site-header">
        <a className="site-brand" href="/" aria-label="NETRA home">
          <span className="site-brand__mark" aria-hidden="true">N</span>
          <span>NETRA</span>
        </a>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <DashboardLink className="metal-button site-header__action">Open dashboard <ArrowRight size={16} /></DashboardLink>
      </header>

      <main>
        <section className="landing-hero landing-container" id="product">
          <div className="landing-hero__copy">
            <p className="eyebrow">Social media intelligence</p>
            <h1>Track how a narrative <span>moves across<br className="desktop-break" /> platforms.</span></h1>
            <p className="landing-lede">NETRA ingests, analyzes, and correlates public threat signals across social channels into actionable network graph intelligence.</p>
            <form className="intelligence-search" onSubmit={handleSearch} role="search">
              <label className="sr-only" htmlFor="landing-search">Search intelligence</label>
              <Search size={19} aria-hidden="true" />
              <input id="landing-search" value={query} onChange={(event) => { setQuery(event.target.value); setSearchError(''); }} placeholder="Enter topic, narrative, or entity to search" />
              <button className="metal-button" type="submit">Search Intelligence <ArrowRight size={16} /></button>
            </form>
            <p className="search-feedback" role="status">{searchError}</p>
            <div className="hero-actions">
              <DashboardLink className="metal-button">Open dashboard <ArrowRight size={16} /></DashboardLink>
              <a className="text-link" href="#how-it-works">How it works <span aria-hidden="true">→</span></a>
            </div>
          </div>

          <div className="intelligence-preview glass-panel" aria-label="Live intelligence summary preview">
            <div className="preview-stats">
              <article className="preview-stat glass-panel">
                <strong>378</strong><span>illustrative preview</span>
              </article>
              <article className="preview-stat glass-panel">
                <strong>104084s</strong><span>illustrative only</span>
              </article>
            </div>
            <article className="preview-summary glass-panel">
              <div className="preview-summary__header">
                <h2>Collected volume, last hour</h2>
                <span className="source-pill">No /live/summary endpoint</span>
              </div>
              <div className="preview-empty">
                <p>No collected volume in the last hour.</p>
                <span>The current API does not expose a live summary endpoint.</span>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-section landing-container spread-section">
          <div>
            <p className="eyebrow">Cross-platform spread</p>
            <h2 className="section-title">Trace propagation<br /><span>across social networks.</span></h2>
            <p className="section-copy">The dashboard maps a story only across sources the API reports as enabled. Disabled sources stay in a collapsed list and are not shown as active here.</p>
          </div>
          <aside className="glass-panel note-panel">
            <h3>What this page does not invent</h3>
            <p>Platform order, gaps, and example topics are not shown here. Open the dashboard cross-platform view to query collected posts.</p>
            <a className="text-link" href="/dashboard/?view=correlation">Open cross-platform view <span aria-hidden="true">&rarr;</span></a>
          </aside>
        </section>

        <section className="landing-section landing-container topology-section">
          <aside className="glass-panel topology-panel">
            <div><span>Topology Centrality</span><span>Degree Centrality</span></div>
            <p>Influencer and bridge counts are calculated in the dashboard from the graph API. This preview does not list entities.</p>
            <a className="text-link" href="/dashboard/?view=network_intel">Open network intelligence <span aria-hidden="true">&rarr;</span></a>
          </aside>
          <div>
            <p className="eyebrow">Network topology</p>
            <h2 className="section-title">Identify key influencers<br /><span>and bridge entities.</span></h2>
            <p className="section-copy">The network screen ranks entities that exist in the collected graph. It does not claim a live ranking on this page.</p>
          </div>
        </section>

        <section className="landing-section landing-container alerts-section">
          <div>
            <p className="eyebrow">Threat alerts</p>
            <h2 className="section-title">Instant notifications<br /><span>on narrative spikes.</span></h2>
            <p className="section-copy">Review alert records when the alerts API returns them.</p>
            <p className="section-copy">Alerts listed in the dashboard come from the alerts API. None are previewed here.</p>
          </div>
          <aside className="glass-panel note-panel">
            <p>Open the alerts screen to see whatever the API currently returns. This landing page does not display sample alerts.</p>
            <a className="text-link" href="/dashboard/?view=alerts">Open alerts <span aria-hidden="true">&rarr;</span></a>
          </aside>
        </section>

        <div className="capabilities landing-container" aria-label="Other dashboard capabilities">
          <span>Also:</span>
          {capabilities.map(([label, view]) => view ? <a key={label} href={view === 'search' ? '/dashboard/#dashboard-search' : `/dashboard/?view=${encodeURIComponent(view)}`}>{label}</a> : <span key={label}>{label}</span>)}
        </div>

        <section className="pipeline-section landing-container" id="how-it-works">
          <p className="eyebrow">Architecture pipeline</p>
          <h2 className="section-title">How it works</h2>
          <div className="pipeline glass-panel">
            {[
              ['01', 'Ingest', 'Collectors reported by the API'],
              ['02', 'Analyze', 'Entities + sentiment'],
              ['03', 'Connect', 'Graph relationships'],
              ['04', 'Alert', 'Volume, sentiment, rules'],
            ].map(([number, title, description]) => (
              <article className="pipeline-step" key={number}>
                <span className="pipeline-step__number">{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="privacy-section landing-container" id="privacy">
          <div className="privacy-card glass-panel">
            <div className="privacy-card__headline">
              <span className="privacy-badge"><ShieldCheck size={14} /> Data handling varies</span>
              <h2 className="section-title">Aggregated measures, <span>source records.</span></h2>
            </div>
            <div className="privacy-card__copy">
              <p>Audience demographics and sentiment metrics are presented as aggregated measures.</p>
              <p>The backend also stores source post records and may include account identifiers. Data access and retention depend on the deployment configuration.</p>
              <p>Dashboard counts and charts reflect API responses. This landing page keeps its metrics empty because a live summary endpoint is not implemented.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer landing-container">
        <a className="site-brand" href="/" aria-label="NETRA home"><span className="site-brand__mark" aria-hidden="true">N</span><span>NETRA</span></a>
        <nav aria-label="Footer navigation"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#privacy">Privacy</a><DashboardLink>Dashboard</DashboardLink></nav>
        <span className="site-footer__note">Social media intelligence</span>
      </footer>
    </div>
  );
}
