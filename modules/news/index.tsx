import React, { useEffect, useState } from "react";
import Icon from "../../components/Icon";

type NewsArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  published?: string;
};

export default function NewsModule() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);

  useEffect(() => {
    fetchNews();
  }, []);

  async function fetchNews(forceRefresh = false) {
    try {
      setLoading(true);
      setError(null);
      const url = forceRefresh
        ? "/api/news/fetch?refresh=true"
        : "/api/news/fetch";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setIsCached(data.cached || false);
        setLastFetch(
          data.cachedAt || data.fetchedAt || new Date().toISOString()
        );
      } else {
        setError("Failed to load news");
      }
    } catch (e) {
      console.error("Failed to fetch news:", e);
      setError("Failed to load news");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="module-card">
        <p>Loading news...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="module-card">
        <p style={{ color: "#c00" }}>{error}</p>
        <button className="btn primary" onClick={() => fetchNews()}>
          Retry
        </button>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div
        className="module-card"
        style={{ textAlign: "center", padding: "2rem" }}
      >
        <p style={{ marginBottom: "1rem" }}>No news sources configured yet.</p>
        <a href="/news/sources" className="btn primary">
          Manage News Sources
        </a>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          padding: "0 1rem",
        }}
      >
        <div>
          <h2>News Feed</h2>
          {lastFetch && (
            <small style={{ color: "#666", fontSize: "0.85rem" }}>
              {isCached ? "📦 Cached" : "🔄 Fresh"} •{" "}
              {new Date(lastFetch).toLocaleTimeString()}
            </small>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn secondary"
            onClick={() => fetchNews(false)}
            title="Refresh from cache"
          >
            <Icon name="refresh" />
          </button>
          <button
            className="btn secondary"
            onClick={() => fetchNews(true)}
            title="Force refresh from sources"
          >
            🔄
          </button>
          <a
            href="/news/sources"
            className="btn secondary"
            title="Manage Sources"
          >
            <Icon name="settings" />
          </a>
        </div>
      </div>

      <div className="news-list">
        {articles.map((article) => (
          <article
            key={article.id}
            className="news-card"
            style={{ cursor: "pointer" }}
          >
            <div className="avatar">
              {article.source.substring(0, 2).toUpperCase()}
            </div>
            <div className="content" style={{ flex: 1 }}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <h4 className="title">{article.title}</h4>
                <div className="meta">
                  <div>{article.source}</div>
                  {article.published && (
                    <>
                      <div className="dot" />
                      <div>{article.published}</div>
                    </>
                  )}
                </div>
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}