import { useMemo } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button, Card } from './ui/primitives';
import './PlatformFeedView.css';

const PLATFORM_DETAILS = {
  youtube: { label: 'YouTube', description: 'Videos and comments collected from YouTube.' },
  telegram: { label: 'Telegram', description: 'Public channel posts collected from Telegram.' },
  instagram: { label: 'Instagram', description: 'Public posts collected from Instagram.' },
};

function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function PlatformFeedView({ platform, posts = [], loading, onRefresh }) {
  const details = PLATFORM_DETAILS[platform];
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0)), [posts]);

  if (!details) return null;

  return (
    <section className="platform-feed-view" aria-labelledby="platform-feed-title">
      <header className="platform-feed-view__header">
        <div>
          <p className="platform-feed-view__eyebrow">Live source feed</p>
          <h1 id="platform-feed-title">{details.label} Feed</h1>
          <p className="platform-feed-view__description">{details.description} Showing {sortedPosts.length} collected posts.</p>
        </div>
        <Button variant="secondary" loading={loading} onClick={onRefresh}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh feed
        </Button>
      </header>

      {loading && sortedPosts.length === 0 ? (
        <Card className="platform-feed-view__state" role="status">Loading {details.label} posts...</Card>
      ) : sortedPosts.length === 0 ? (
        <Card className="platform-feed-view__state">No {details.label} posts are available yet.</Card>
      ) : (
        <div className="platform-feed-view__posts">
          {sortedPosts.map((post, index) => {
            const postUrl = safeExternalUrl(post.url || post.permalink);
            const mediaUrl = safeExternalUrl(post.media_url);
            const content = post.text || post.text_content || post.content || post.caption || 'No post text was stored.';
            const metrics = post.metrics || {};
            const key = post.canonical_id || `${platform}-${post.published_at || index}-${index}`;

            return (
              <Card className="platform-feed-view__post" key={key}>
                <div className="platform-feed-view__post-heading">
                  <div>
                    <span className="platform-feed-view__post-type">{post.event_type || post.media_type || 'Post'}</span>
                    <p className="platform-feed-view__post-meta">
                      {post.author_username || post.channel || post.author_id || 'Unknown author'}
                      <span aria-hidden="true"> · </span>
                      <time dateTime={post.published_at || undefined}>{formatDate(post.published_at)}</time>
                    </p>
                  </div>
                  {postUrl ? (
                    <a className="platform-feed-view__source-link" href={postUrl} target="_blank" rel="noopener noreferrer">
                      Open original post <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  ) : <span className="platform-feed-view__no-link">Source link unavailable</span>}
                </div>

                {post.metadata?.title && post.text && <h2 className="platform-feed-view__title">{post.metadata.title}</h2>}
                <p className="platform-feed-view__content">{content}</p>

                {mediaUrl && post.media_type && /image|photo/i.test(post.media_type) && (
                  <a className="platform-feed-view__media" href={mediaUrl} target="_blank" rel="noopener noreferrer">
                    <img src={mediaUrl} alt={`${details.label} post media`} loading="lazy" />
                  </a>
                )}

                <footer className="platform-feed-view__details">
                  {post.source_mode && <span>{post.source_mode}</span>}
                  {post.upvotes != null && <span>{post.upvotes} views or likes</span>}
                  {post.comments_count != null && <span>{post.comments_count} comments</span>}
                  {metrics.views != null && <span>{metrics.views} views</span>}
                  {metrics.likes != null && <span>{metrics.likes} likes</span>}
                  {metrics.replies != null && <span>{metrics.replies} replies</span>}
                </footer>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default PlatformFeedView;