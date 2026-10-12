import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Search, RefreshCw, Compass } from 'lucide-react';
import InvestigationView from './components/InvestigationView';
import NetworkGraph from './components/NetworkGraph';
import NarrativeTracker from './components/NarrativeTracker';
import CrossPlatformView from './components/CrossPlatformView';
import AlertsView from './components/AlertsView';
import DemographicsView from './components/DemographicsView';
import NetworkIntelligenceView from './components/NetworkIntelligenceView';
import PlatformFeedView from './components/PlatformFeedView';
import { Badge, Button, Card, Input } from './components/ui/primitives';
import { API_URL } from './config';
import './components/AnalyticsView.css';
import ProductTour from './components/ProductTour';

const SENTIMENT_COLORS = { POSITIVE: 'var(--ds-color-green-muted)', NEGATIVE: 'var(--ds-color-red-muted)', NEUTRAL: 'var(--ds-color-amber-muted)', ABSTAIN: 'var(--ds-color-text-3)' };

const normalizeSentimentData = (items) => {
  const counts = new Map();
  items.forEach((item) => {
    const label = String(item.label || 'NEUTRAL').trim().toUpperCase() || 'NEUTRAL';
    counts.set(label, (counts.get(label) || 0) + Number(item.count || 0));
  });
  return Array.from(counts, ([label, count]) => ({ label, count }));
};

const getFeedPlatform = (platform = '') => {
  const value = String(platform).toLowerCase();
  if (value.includes('telegram')) return 'Telegram';
  if (value.includes('instagram') || value === 'meta' || value.includes('facebook')) return 'Instagram';
  if (value.includes('youtube') || value === 'yt') return 'YouTube';
  return null;
};

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view');
    return ['analytics', 'mutation', 'correlation', 'alerts', 'demographics', 'network_intel', 'graph', 'youtube', 'telegram', 'instagram'].includes(requestedView) ? requestedView : 'analytics';
  });
  const [sentimentData, setSentimentData] = useState([]);
  const [narrativeData, setNarrativeData] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('q') || '');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  
  // 🔄 MAGIC REFRESH KEY
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sentimentRes, narrativeRes, graphRes, messagesRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/sentiment`),
        axios.get(`${API_URL}/analytics/narratives`),
        axios.get(`${API_URL}/graph/data`),
        Promise.all(['telegram', 'instagram', 'youtube'].map((platform) => axios.get(`${API_URL}/messages?limit=100&platform=${platform}`)))
      ]);
      setSentimentData(normalizeSentimentData(sentimentRes.data.sentiment_breakdown || []));
      setNarrativeData(narrativeRes.data.clusters || []);
      setGraphData(graphRes.data || { nodes: [], links: [] });
      setMessages(messagesRes.flatMap((response) => response.data.messages || []));
      setLastUpdated(new Date());
    } catch (error) { 
      console.error('Error fetching data:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const runSearch = async (query) => {
    setSearching(true);
    setSearchError('');
    try {
      const searchRes = await axios.get(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      setInvestigationData(searchRes.data);
    } catch (error) {
      console.error('Error searching:', error);
      setSearchError('Search could not be completed. Check the API connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      e.preventDefault();
      runSearch(searchQuery.trim());
    }
  };

  const handleBackToDashboard = () => {
    setInvestigationData(null);
    setSearchQuery('');
    setSearchError('');
    const url = new URL(window.location.href);
    url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  };

  useEffect(() => {
    if (window.location.hash === '#dashboard-search') {
      window.requestAnimationFrame(() => {
        const searchInput = document.querySelector('#dashboard-search input');
        searchInput?.focus({ preventScroll: true });
        document.getElementById('dashboard-search')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
        });
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
    const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim();
    if (initialQuery) {
      runSearch(initialQuery);
    }
  }, []);

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const diffMs = new Date() - new Date(timestamp);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className={tourOpen ? "netra-app min-h-screen p-6 tour-is-open" : "netra-app min-h-screen p-6"}>
      {/* Header */}
      <header className="netra-header mb-8 flex justify-between items-center">
        <h1 className="netra-title">NETRA <span>INTELLIGENCE</span></h1>
        {!investigationData && (
          <div className="netra-toolbar flex gap-2 items-center flex-wrap">
            <Button variant="secondary" className="tour-launch" onClick={() => setTourOpen(true)}>
              <Compass className="w-4 h-4" /> Take a tour
            </Button>
            <Button variant="nav" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
              Analytics
            </Button>
            <Button variant="nav" active={activeTab === 'mutation'} onClick={() => setActiveTab('mutation')}>
              Mutation Tracker
            </Button>
            <Button variant="nav" active={activeTab === 'correlation'} onClick={() => setActiveTab('correlation')}>
              Cross-Platform
            </Button>
            <Button variant="nav" active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>
              Alerts
            </Button>
            <Button variant="nav" active={activeTab === 'demographics'} onClick={() => setActiveTab('demographics')}>
              Demographics
            </Button>
            <Button variant="nav" active={activeTab === 'network_intel'} onClick={() => setActiveTab('network_intel')}>
              Network Intel
            </Button>
            <Button variant="nav" active={activeTab === 'graph'} onClick={() => setActiveTab('graph')}>
              Network Graph
            </Button>
            <Button variant="nav" active={activeTab === 'youtube'} onClick={() => setActiveTab('youtube')}>
              YouTube Feed
            </Button>
            <Button variant="nav" active={activeTab === 'telegram'} onClick={() => setActiveTab('telegram')}>
              Telegram Feed
            </Button>
            <Button variant="nav" active={activeTab === 'instagram'} onClick={() => setActiveTab('instagram')}>
              Instagram Feed
            </Button>
            
            {/* 🔄 FIXED REFRESH BUTTON */}
            <Button variant="secondary" loading={loading} className="flex items-center gap-2" onClick={() => { fetchData(); setRefreshKey(prev => prev + 1); }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            
            {lastUpdated && <Badge>Last Updated: {lastUpdated.toLocaleTimeString()}</Badge>}
          </div>
        )}
      </header>

      {/* Search Bar */}
      {!investigationData && (
        <div className="netra-search-wrap mb-6" id="dashboard-search">
          <div className="relative">
            <Search className="netra-search-icon absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" />
            <Input
              type="text" 
              placeholder="Investigate topic, entity, or narrative... (press Enter)"
              aria-label="Search investigations"
              value={searchQuery} 
              onChange={(e) => { setSearchQuery(e.target.value); setSearchError(''); }}
              onKeyDown={handleSearch} 
              className="ds-input--search w-full"
            />
          </div>
          {searchError && <p className="text-sm text-rose-300" role="alert">{searchError}</p>}
        </div>
      )}

      {/* Main Content Area */}
      {searching ? (
        <Card className="analytics-view__loading" role="status">
          <RefreshCw className="analytics-view__loading-icon animate-spin" />
          <p>Searching collected intelligence...</p>
        </Card>
      ) : investigationData ? (
        <InvestigationView investigationData={investigationData} graphData={graphData} onBack={handleBackToDashboard} searchQuery={searchQuery} />
      ) : (
        <>
          {activeTab === 'analytics' && (
            <section className="analytics-view" aria-labelledby="analytics-heading">
              <header className="analytics-view__header">
                <p className="analytics-view__eyebrow">Dashboard</p>
                <h1 id="analytics-heading" className="analytics-view__title">Analytics</h1>
              </header>
              {loading && !lastUpdated ? (
                <Card className="analytics-view__loading" role="status">
                  <RefreshCw className="analytics-view__loading-icon animate-spin" />
                  <p>Loading analytics…</p>
                </Card>
              ) : (
                <div className="analytics-view__grid">
                  <Card className="analytics-view__card">
                    <header className="analytics-view__card-header"><h2>Sentiment Distribution</h2></header>
                    {sentimentData.length === 0 ? (
                      <div className="analytics-view__empty"><p>No sentiment data available.</p></div>
                    ) : (
                      <div className="analytics-view__chart">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie data={sentimentData.filter((entry) => entry.count > 0)} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                              {sentimentData.filter((entry) => entry.count > 0).map((entry) => <Cell key={entry.label} fill={SENTIMENT_COLORS[entry.label] || 'var(--ds-color-text-3)'} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} itemStyle={{ color: 'var(--ds-color-text-1)' }} />
                            <Legend wrapperStyle={{ color: 'var(--ds-color-text-2)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                  <Card className="analytics-view__card">
                    <header className="analytics-view__card-header"><h2>Emerging Narratives</h2></header>
                    {narrativeData.length === 0 ? (
                      <div className="analytics-view__empty"><p>No narrative data available.</p></div>
                    ) : (
                      <div className="analytics-view__chart">
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={narrativeData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                            <XAxis type="number" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                            <YAxis dataKey="name" type="category" width={100} stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} itemStyle={{ color: 'var(--ds-color-text-1)' }} />
                            <Bar dataKey="count" fill="var(--ds-color-accent)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                  <Card className="analytics-view__card analytics-view__feed-card">
                    <header className="analytics-view__card-header"><h2>Live Intelligence Feed</h2></header>
                    {messages.length === 0 ? (
                      <div className="analytics-view__empty"><p>No messages available.</p></div>
                    ) : (
                      <div className="analytics-view__platform-feeds">
                        {['Telegram', 'Instagram', 'YouTube'].map((platform) => {
                          const platformMessages = messages.filter((msg) => getFeedPlatform(msg.platform) === platform);
                          return (
                            <section className="analytics-view__platform-feed" key={platform} aria-labelledby={`feed-${platform.toLowerCase()}`}>
                              <h3 id={`feed-${platform.toLowerCase()}`}>{platform}</h3>
                              {platformMessages.length ? (
                                <div className="analytics-view__feed">
                                  <table className="analytics-view__table">
                                    <thead><tr><th scope="col">Published</th><th scope="col">Content</th></tr></thead>
                                    <tbody>{platformMessages.map((msg, i) => (
                                      <tr key={msg._id || `${platform}-${i}`}>
                                        <td>{getRelativeTime(msg.published_at)}</td>
                                        <td>{msg.text_content?.substring(0, 240) || 'No content'}</td>
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              ) : <p className="analytics-view__platform-empty">No {platform} messages available.</p>}
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </section>
          )}
          
          {/* 🔄 PASSING REFRESH KEY TO FORCE REMOUNT */}
          {['youtube', 'telegram', 'instagram'].includes(activeTab) && (
            <PlatformFeedView
              platform={activeTab}
              posts={messages.filter((msg) => getFeedPlatform(msg.platform)?.toLowerCase() === activeTab)}
              loading={loading}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'mutation' && (
            <NarrativeTracker key={refreshKey} />
          )}

          {activeTab === 'correlation' && (
            <CrossPlatformView key={refreshKey} />
          )}

          {activeTab === 'alerts' && (
            <AlertsView key={refreshKey} />
          )}

          {activeTab === 'demographics' && (
            <DemographicsView key={refreshKey} />
          )}

          {activeTab === 'network_intel' && (
            <NetworkIntelligenceView key={refreshKey} />
          )}
          
          {activeTab === 'graph' && (
            <NetworkGraph graphData={graphData} key={refreshKey} />
          )}
        </>
      )}
      {tourOpen && <ProductTour activeTab={activeTab} onNavigate={setActiveTab} onClose={() => setTourOpen(false)} />}
    </div>
  );
}

export default App;