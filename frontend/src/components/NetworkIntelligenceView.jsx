import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Network, Users, GitMerge, Layers, RefreshCw } from 'lucide-react';
import { Badge, Button, Card } from './ui/primitives';
import { API_URL } from '../config';
import './NetworkIntelligenceView.css';

const COLORS = ['var(--ds-color-accent)', 'var(--ds-color-accent-dim)', 'var(--ds-color-chart-muted-1)', 'var(--ds-color-chart-muted-2)', 'var(--ds-color-chart-muted-3)', 'var(--ds-color-chart-muted-4)', 'var(--ds-color-blue-muted)'];

export default function NetworkIntelligenceView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchIntelligence = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/graph/intelligence?t=${Date.now()}`);
      setData(res.data);
    } catch (error) {
      console.error("Error fetching graph intelligence:", error);
      setData(null);
      setError('Could not calculate current post phrases. Check the API and database connection, then try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  const formatName = (name) => {
    if (!name || name === 'Unknown Node') return 'Unknown Entity';
    // Truncate long names
    return name.length > 30 ? name.substring(0, 27) + '...' : name;
  };

  return (
    <section className="network-intel" aria-labelledby="network-intel-heading" aria-busy={loading}>
      <header className="network-intel__header">
        <div className="network-intel__heading">
          <span className="network-intel__heading-icon" aria-hidden="true"><Network /></span>
          <div>
            <p className="network-intel__eyebrow">Network Analysis</p>
            <h1 id="network-intel-heading">Network <span>Intelligence</span></h1>
            <p>Calculated from the current post records; counts show observed links, not inferred influence.</p>
          </div>
        </div>
        <Button variant="secondary" loading={loading} onClick={fetchIntelligence} className="network-intel__refresh">
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          {loading ? 'Recalculating…' : 'Recalculate'}
        </Button>
      </header>

      {loading ? (
        <Card className="network-intel__state" role="status">
          <RefreshCw className="network-intel__state-icon animate-spin" />
          <p>Analyzing current database posts…</p>
        </Card>
      ) : !data || ![data.top_phrases, data.cross_platform_phrases, data.platforms].some((items) => items?.length > 0) ? (
        <Card className="network-intel__state">
          <Network className="network-intel__state-icon" />
          <h2>{error ? 'Current post analysis unavailable' : 'No current post data'}</h2>
          <p>{error || 'No posts with usable text are available in the database.'}</p>
        </Card>
      ) : (
        <>
          <p className="network-intel__provenance">Calculated from {data.total_posts} current database posts with text at {data.generated_at ? new Date(data.generated_at).toLocaleTimeString() : 'request time'}. Phrases come from post text; no saved graph snapshot is used.</p>
          <div className="network-intel__stats">
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><Users aria-hidden="true" /><span>Top Repeated Phrases</span></div>
              <strong>{data.top_phrases?.length || 0}</strong>
              <p>Most frequently found in post text</p>
            </Card>
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><GitMerge aria-hidden="true" /><span>Cross-Platform Phrases</span></div>
              <strong>{data.cross_platform_phrases?.length || 0}</strong>
              <p>Observed on more than one platform</p>
            </Card>
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><Layers aria-hidden="true" /><span>Posts Analyzed</span></div>
              <strong>{data.total_posts || 0}</strong>
              <p>Current records with usable text</p>
            </Card>
          </div>

          <div className="network-intel__grid">
            <Card className="network-intel__panel">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><Users aria-hidden="true" /><h2>Most Repeated Phrases</h2></div>
                <Badge variant="accent">Occurrences in posts</Badge>
              </header>
              <div className="network-intel__list">
                {data.top_phrases?.length > 0 ? data.top_phrases.map((inf, i) => (
                  <article key={i} className="network-intel__influencer">
                    <span className="network-intel__rank">{i + 1}</span>
                    <span className="network-intel__entity-icon" aria-hidden="true"><Network /></span>
                    <div className="network-intel__entity">
                      <h3>{formatName(inf.name)}</h3>
                      <Badge variant="neutral">{inf.type || 'Entity'}</Badge>
                      <span className="network-intel__evidence">Example · {inf.example_post.platform}: {inf.example_post.text}</span>
                    </div>
                    <div className="network-intel__metric">
                      <strong>{inf.posts}</strong><span>Posts</span>
                    </div>
                  </article>
                )) : (
                  <div className="network-intel__empty">No influencer data available.</div>
                )}
              </div>
            </Card>

            <Card className="network-intel__panel">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><GitMerge aria-hidden="true" /><h2>Cross-Platform Phrases</h2></div>
                <Badge variant="warning">Observed in stored posts</Badge>
              </header>
              <p className="network-intel__description">Phrases found in post text from multiple platforms. The count is the number of platforms where the phrase occurs, not an influence score.</p>
              <div className="network-intel__list">
                {data.cross_platform_phrases?.length > 0 ? data.cross_platform_phrases.map((bridge, i) => (
                  <article key={i} className="network-intel__bridge">
                    <div className="network-intel__bridge-entity">
                      <div><h3>{formatName(bridge.name)}</h3><span className="network-intel__bridge-types">{bridge.posts} posts · {bridge.platforms.join(', ')}</span><span className="network-intel__evidence">Example · {bridge.example_post.platform}: {bridge.example_post.text}</span></div>
                    </div>
                    <Badge variant="accent">{bridge.platform_count} platforms</Badge>
                  </article>
                )) : (
                  <div className="network-intel__empty">No phrases currently appear on more than one platform.</div>
                )}
              </div>
            </Card>

            <Card className="network-intel__panel network-intel__communities">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><Layers aria-hidden="true" /><h2>Posts by Platform</h2></div>
              </header>
              {data.platforms?.length > 0 ? (
                <div className="network-intel__chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.platforms}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                      <XAxis dataKey="platform" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                      <YAxis stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} cursor={{ fill: 'var(--ds-color-glass-hover)' }} />
                      <Bar dataKey="count" name="Posts" radius={[4, 4, 0, 0]}>
                        {data.platforms.map((entry, index) => <Cell key={entry.platform} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="network-intel__empty">No platform data is available for current posts.</div>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}