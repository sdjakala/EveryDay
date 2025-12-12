import type { NextApiRequest, NextApiResponse } from "next";
import getStorageAdapter from "../../../lib/storage";

type NewsArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  published?: string;
};

// Simple HTML link extractor
function extractLinks(html: string, baseUrl: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Match <a> tags with href attributes
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  const seenUrls = new Set<string>();

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    // Skip if no text or if it's a common navigation item
    if (!text || text.length < 10) continue;
    if (
      text
        .toLowerCase()
        .match(
          /^(home|about|contact|login|signup|menu|search|next|previous|more)$/i
        )
    )
      continue;

    // Convert relative URLs to absolute
    let fullUrl = href;
    try {
      const url = new URL(href, baseUrl);
      fullUrl = url.href;

      // Skip non-HTTP URLs (mailto:, javascript:, etc.)
      if (!fullUrl.startsWith("http")) continue;

      // Skip already seen URLs
      if (seenUrls.has(fullUrl)) continue;
      seenUrls.add(fullUrl);

      // Skip URLs that don't look like articles (common navigation/footer links)
      const path = url.pathname.toLowerCase();
      if (
        path.match(
          /\/(privacy|terms|about|contact|login|signup|search|tag|category|author|page\/\d+)$/
        )
      )
        continue;
      if (path === "/" || path === "") continue;

      articles.push({
        id: `${baseUrl}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: text,
        url: fullUrl,
        source: new URL(baseUrl).hostname,
      });
    } catch (e) {
      // Invalid URL, skip
      continue;
    }
  }

  return articles;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    const storage = getStorageAdapter(req);

    // Check for force refresh parameter
    const forceRefresh = req.query.refresh === "true";
    const cacheMaxAge = parseInt(req.query.maxAge as string) || 60; // default 60 minutes

    // Check for active source first
    const sources = await storage.getNewsSources();
    const activeSources = sources.filter((s: any) => s.active !== false);

    // If no active sources, clear and return empty
    if(activeSources.length === 0) {
        // Clear any stale cached articles
        try{
            await storage.clearArticleCache();
        } catch(e){
            console.error("Failed to clear cached articles:", e);
        }
        return res.status(200).json({ articles: [] });
    }

    // Try to get cached articles first (unless force refresh)
    if (!forceRefresh) {
      const cached = await storage.getCachedArticles(undefined, cacheMaxAge);
      if (cached && cached.length > 0) {
        console.log(`Returning ${cached.length} cached articles`);
        return res.status(200).json({
          articles: cached,
          cached: true,
          cachedAt: cached[0]?.cachedAt,
        });
      }
    }
    
    console.log(`Fetching from ${activeSources.length} sources...`);

    // Fetch and scrape each source
    const allArticles: any[] = [];

    await Promise.all(
      activeSources.map(async (source: any) => {
        try {
          const response = await fetch(source.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
          });

          if (!response.ok) {
            console.warn(`Failed to fetch ${source.url}: ${response.status}`);
            return;
          }

          const html = await response.text();
          const links = extractLinks(html, source.url);

          // Add sourceId to each article for caching
          const articlesWithSource = links.map((article) => ({
            ...article,
            sourceId: source.id,
          }));

          // Limit to 20 articles per source
          const limited = articlesWithSource.slice(0, 20);
          allArticles.push(...limited);
        } catch (e: any) {
          console.error(`Error fetching ${source.url}:`, e.message);
        }
      })
    );

    // Sort by title and deduplicate
    const unique = Array.from(
      new Map(allArticles.map((a) => [a.url, a])).values()
    );

    // Cache the articles (1 hour TTL)
    if (unique.length > 0) {
      try {
        await storage.cacheArticles(unique, 3600); // 1 hour TTL
        console.log(`Cached ${unique.length} articles`);
      } catch (e: any) {
        console.error("Failed to cache articles:", e);
        // Don't fail the request if caching fails
      }
    }

    return res.status(200).json({
      articles: unique,
      cached: false,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("Error in news fetch:", e);
    return res.status(500).json({ error: e.message });
  }
}