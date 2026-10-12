import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, Globe, MessageSquare, Share2, TrendingUp, Activity, Video, ExternalLink } from 'lucide-react';
import { Button, Card } from './ui/primitives';
import NetworkGraph from './NetworkGraph';
import './InvestigationView.css';

function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default function InvestigationView({ investigationData, graphData, onBack, searchQuery }) {
  const [filteredGraph, setFilteredGraph] = useState({ nodes: [], links: [] });
  const posts = investigationData.posts || [];
  const entities = investigationData.summary?.entities || [];
  const platforms = investigationData.summary?.platforms || [];

  useEffect(() => {
    if (!graphData?.nodes || !searchQuery) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const query = searchQuery.toLowerCase();
    const matchedNodes = graphData.nodes.filter((node) =>
      (node.label || '').toLowerCase().includes(query) ||
      (node.id || '').toLowerCase().includes(query)
    );

    if (matchedNodes.length === 0) {
      setFilteredGraph({ nodes: [], links: [] });
      return;
    }

    const matchedIds = new Set(matchedNodes.map((node) => node.id));
    const relevantLinks = graphData.links.filter((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return matchedIds.has(sourceId) || matchedIds.has(targetId);
    });
    const connectedIds = new Set(matchedIds);
    relevantLinks.forEach((link) => {
      connectedIds.add(typeof link.source === 'object' ? link.source.id : link.source);
      connectedIds.add(typeof link.target === 'object' ? link.target.id : link.target);
    });
    setFilteredGraph({
      nodes: graphData.nodes.filter((node) => connectedIds.has(node.id)),
      links: relevantLinks,
    });
  }, [graphData, searchQuery]);

  const getPlatformIcon = (platform) => {
    const value = platform?.toLowerCase() || '';
    if (value.includes('twitter') || value.includes('x')) return <Share2 size={15} aria-hidden="true" />;
    if (value.includes('reddit')) return <MessageSquare size={15} aria-hidden="true" />;
    if (value.includes('youtube')) return <Video size={15} aria-hidden="true" />;
    return <Globe size={15} aria-hidden="true" />;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="investigation-view">
      <header className="investigation-view__header">
        <div className="investigation-view__header-copy">
          <p className="investigation-view__eyebrow">Collected intelligence</p>
          <h1>Investigation <span>{searchQuery}</span></h1>
        </div>
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to dashboard
        </Button>
      </header>

      <section className="investigation-view__stats" aria-label="Investigation summary">
        <Card className="investigation-view__stat">
          <div className="investigation-view__stat-label"><Activity aria-hidden="true" /> Observations</div>
          <strong>{investigationData.summary?.observations || 0}</strong>
        </Card>
        <Card className="investigation-view__stat">
          <div className="investigation-view__stat-label"><Building2 aria-hidden="true" /> Unique entities</div>
          <strong>{entities.length}</strong>
        </Card>
        <Card className="investigation-view__stat">
          <div className="investigation-view__stat-label"><Globe aria-hidden="true" /> Platforms</div>
          <strong>{platforms.length}</strong>
        </Card>
        <Card className="investigation-view__stat investigation-view__stat--trend">
          <div className="investigation-view__stat-label"><TrendingUp aria-hidden="true" /> Activity trend</div>
          <strong>{investigationData.summary?.activity_trend || '0%'}</strong>
        </Card>
      </section>

      <div className="investigation-view__content-grid">
        <Card className="investigation-view__panel">
          <header className="investigation-view__panel-heading">
            <span className="investigation-view__panel-icon"><Activity size={17} aria-hidden="true" /></span>
            <h2>Why this narrative?</h2>
          </header>
          <p className="investigation-view__provenance">{investigationData.provenance || 'No provenance details are available for this search.'}</p>

          <section className="investigation-view__detail-group">
            <h3>Key entities</h3>
            {entities.length ? (
              <div className="investigation-view__chips">
                {entities.slice(0, 12).map((entity) => <span className="investigation-view__chip" key={entity}>{entity}</span>)}
              </div>
            ) : <p className="investigation-view__muted">No entities identified.</p>}
          </section>

          <section className="investigation-view__detail-group">
            <h3>Platforms involved</h3>
            {platforms.length ? (
              <div className="investigation-view__chips">
                {platforms.map((platform) => (
                  <span className="investigation-view__platform-chip" key={platform}>
                    {getPlatformIcon(platform)} {platform}
                  </span>
                ))}
              </div>
            ) : <p className="investigation-view__muted">No platform data available.</p>}
          </section>
        </Card>

        <Card className="investigation-view__panel investigation-view__evidence-panel">
          <header className="investigation-view__panel-heading">
            <span className="investigation-view__panel-icon"><Globe size={17} aria-hidden="true" /></span>
            <h2>Evidence feed</h2>
            <span className="investigation-view__count">{posts.length} posts</span>
          </header>
          {posts.length === 0 ? (
            <div className="investigation-view__empty">No direct evidence found for this query.</div>
          ) : (
            <div className="investigation-view__evidence-list">
              {posts.map((post, index) => {
                const postUrl = safeExternalUrl(post.url || post.permalink);
                const sentiment = post.sentiment_label?.toUpperCase();
                return (
                  <article className="investigation-view__evidence" key={post.canonical_id || `${post.platform}-${index}`}>
                    <div className="investigation-view__evidence-heading">
                      <div className="investigation-view__evidence-meta">
                        <span className="investigation-view__platform-icon">{getPlatformIcon(post.platform)}</span>
                        <strong>{post.platform || 'Unknown source'}</strong>
                        <span className="investigation-view__meta-separator">·</span>
                        <time dateTime={post.published_at || undefined}>{getRelativeTime(post.published_at)}</time>
                      </div>
                      <div className="investigation-view__evidence-actions">
                        {sentiment && <span className={`investigation-view__sentiment investigation-view__sentiment--${sentiment.toLowerCase()}`}>{sentiment}</span>}
                        {postUrl && <a href={postUrl} target="_blank" rel="noopener noreferrer" aria-label="Open source post"><ExternalLink size={15} /></a>}
                      </div>
                    </div>
                    <p className="investigation-view__evidence-text">{post.text_content || post.text || post.content || 'No content'}</p>
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <section className="investigation-view__graph-section" aria-label="Investigation network graph">
        <NetworkGraph graphData={filteredGraph} highlightQuery={searchQuery} />
      </section>
    </div>
  );
}