import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleHelp, X } from 'lucide-react';
import './ProductTour.css';

const TOUR_STEPS = [
  { tab: 'analytics', target: '.netra-header', title: 'Welcome to NETRA', body: 'Use the left navigation to move between analytics, narrative tracking, cross-platform analysis, alerts, demographics, network intelligence, the graph, and each live platform feed. Refresh reloads the dashboard data.' },
  { tab: 'analytics', target: '.netra-search-wrap', title: 'Search investigations', body: 'Search for a topic, entity, or narrative and press Enter. NETRA opens an investigation with matching posts, entities, platforms, provenance, and related graph data.' },
  { tab: 'analytics', target: '.analytics-view__header', title: 'Analytics overview', body: 'This page summarizes the collected dataset. The charts describe posts currently available to NETRA; they update when the dashboard refreshes.' },
  { tab: 'analytics', target: '.analytics-view__card:first-child', title: 'Sentiment distribution', body: 'This chart groups posts by their calculated sentiment label. It is a count of collected posts, not a measure of truth or importance.' },
  { tab: 'analytics', target: '.analytics-view__card:nth-child(2)', title: 'Emerging narratives', body: 'Narrative counts show recurring themes inferred from collected posts. Use the search bar to investigate a narrative and inspect its supporting observations.' },
  { tab: 'analytics', target: '.analytics-view__feed-card', title: 'Live intelligence feed', body: 'The feed is split into Telegram, Instagram, and YouTube tables. Each row shows a collected post and its publication time; platform pages show fuller post details when available.' },
  { tab: 'mutation', target: '.narrative-tracker__header', title: 'Narrative mutation', body: 'Choose a narrative to follow how its volume and sentiment change over time. This view is useful for spotting changes in the collected conversation.' },
  { tab: 'mutation', target: '.narrative-tracker__timeline', title: 'Read the mutation timeline', body: 'The timeline plots observations over time. Narrative evolution and event summaries below it describe detected changes in wording, entities, and sentiment.' },
  { tab: 'correlation', target: '.cross-platform-view__header', title: 'Cross-platform analysis', body: 'Enter a topic to compare where matching posts appear. The results summarize platforms, total observations, and the order of activity where timestamps allow it.' },
  { tab: 'correlation', target: '.cross-platform-view__panel', title: 'Compare platform activity', body: 'The spread timeline and platform breakdown show how the matching posts are distributed across sources. Counts reflect the available collected data.' },
  { tab: 'alerts', target: '.alerts-view__header', title: 'Intelligence alerts', body: 'Alerts surface activity that matches the configured rules. Review the severity summary first, then open an alert to read its source and details.' },
  { tab: 'alerts', target: '.alerts-view__list', title: 'Review alert evidence', body: 'Each alert includes its type, severity, time, description, and related platforms. An empty list means no alert records are currently available.' },
  { tab: 'demographics', target: '.demographics-view__header', title: 'Demographics', body: 'This page shows aggregate audience estimates derived from collected posts. Treat these as statistical signals, not verified attributes of an individual.' },
  { tab: 'demographics', target: '.demographics-view__grid', title: 'Explore audience breakdowns', body: 'The panels summarize detected professional interests, regions, age brackets, and languages. Some panels may be empty when the source data does not contain enough evidence.' },
  { tab: 'network_intel', target: '.network-intel__header', title: 'Network intelligence', body: 'Network intelligence summarizes influential entities, bridge nodes, and communities found in the current graph.' },
  { tab: 'network_intel', target: '.network-intel__grid', title: 'Influencers and bridges', body: 'Influencers have many graph connections; bridge nodes connect otherwise separate groups. These rankings depend on the graph data currently synced.' },
  { tab: 'graph', target: '.network-graph__header', title: 'Network graph', body: 'Explore relationships between posts, platforms, topics, and entities. Node size and connections represent relationships in the available graph.' },
  { tab: 'graph', target: '.network-graph__toolbar', title: 'Filter the graph', body: 'Switch between entity and post views, search for a node, or filter by node type. Select a node to inspect its direct connections.' },
  { tab: 'graph', target: '.network-graph__canvas', title: 'Inspect connections', body: 'Zoom and pan the graph, then select a node to see its connections. If the graph is empty, its source data has not been synced or the current filters found no matches.' },
  { tab: 'youtube', target: '.platform-feed-view__header', title: 'YouTube feed', body: 'Browse collected YouTube posts, including their available text, author, time, and source link. Use the source link to open the original post when one was captured.' },
  { tab: 'youtube', target: '.platform-feed-view__posts', title: 'Read YouTube posts', body: 'Post cards show the content and metadata stored by the collector. Missing links or fields mean the source did not provide them.' },
  { tab: 'telegram', target: '.platform-feed-view__header', title: 'Telegram feed', body: 'Browse collected Telegram posts and their available channel, time, and source details. The source link opens the original post when it is publicly accessible.' },
  { tab: 'telegram', target: '.platform-feed-view__posts', title: 'Read Telegram posts', body: 'Post cards display the collected text and metadata. Telegram links may require access to a public channel or message.' },
  { tab: 'instagram', target: '.platform-feed-view__header', title: 'Instagram feed', body: 'Browse collected Instagram posts and their available captions, author, time, and source link. Availability depends on the data supplied by the collector.' },
  { tab: 'instagram', target: '.platform-feed-view__posts', title: 'Read Instagram posts', body: 'Post cards show the content captured by NETRA. Open the source link when available to view the original post.' },
  { tab: 'analytics', target: '.netra-search-wrap', title: 'Investigation results', body: 'A search opens the investigation screen. Its summary cards, explanation, detected entities, platform chips, evidence feed, and graph help you inspect why posts matched.' },
];

export default function ProductTour({ activeTab, onNavigate, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const closeRef = useRef(null);
  const step = TOUR_STEPS[stepIndex];

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    return () => previousFocus?.focus?.();
  }, []);

  useEffect(() => {
    if (step.tab !== activeTab) {
      onNavigate(step.tab);
      return undefined;
    }

    let target;
    const timer = window.setTimeout(() => {
      target = document.querySelector(step.target) || document.querySelector(".netra-app > :not(.netra-header):not(.netra-search-wrap)");
      if (!target) return;
      target.classList.add('tour-target-active');
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    }, 80);
    return () => {
      window.clearTimeout(timer);
      target?.classList.remove('tour-target-active');
    };
  }, [activeTab, onNavigate, step]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const buttons = document.querySelectorAll('.product-tour__dialog button:not(:disabled)');
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === 'ArrowRight') setStepIndex((index) => Math.min(index + 1, TOUR_STEPS.length - 1));
      if (event.key === 'ArrowLeft') setStepIndex((index) => Math.max(index - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const finishTour = () => onClose();

  return (
    <div className="product-tour" aria-live="polite">
      <div className="product-tour__scrim" aria-hidden="true" />
      <section className="product-tour__dialog" role="dialog" aria-modal="true" aria-labelledby="product-tour-title" aria-describedby="product-tour-body">
        <div className="product-tour__topline">
          <span className="product-tour__badge"><CircleHelp size={15} /> NETRA QUICK TOUR</span>
          <span className="product-tour__count">{stepIndex + 1} <span>/</span> {TOUR_STEPS.length}</span>
          <button ref={closeRef} type="button" className="product-tour__close" onClick={finishTour} aria-label="Exit tour"><X size={18} /></button>
        </div>
        <div className="product-tour__progress" role="progressbar" aria-label="Tour progress" aria-valuemin={1} aria-valuemax={TOUR_STEPS.length} aria-valuenow={stepIndex + 1}>
          <span style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }} />
        </div>
        <p className="product-tour__section">{step.tab === 'analytics' ? 'GETTING STARTED' : step.tab.replace('_', ' ').toUpperCase()}</p>
        <h2 id="product-tour-title">{step.title}</h2>
        <p id="product-tour-body">{step.body}</p>
        <footer className="product-tour__actions">
          <button type="button" className="product-tour__button product-tour__button--quiet" onClick={finishTour}>Exit tour</button>
          <div>
            <button type="button" className="product-tour__button product-tour__button--back" onClick={() => setStepIndex((index) => Math.max(index - 1, 0))} disabled={stepIndex === 0}><ArrowLeft size={16} /> Back</button>
            {stepIndex === TOUR_STEPS.length - 1 ? (
              <button type="button" className="product-tour__button product-tour__button--next" onClick={finishTour}>Finish <CircleHelp size={16} /></button>
            ) : (
              <button type="button" className="product-tour__button product-tour__button--next" onClick={() => setStepIndex((index) => Math.min(index + 1, TOUR_STEPS.length - 1))}>Next <ArrowRight size={16} /></button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}