# TrendRader

Production-oriented static news publishing starter for **https://trendrader.space/**.

## Structure

- `index.html` — publisher-owned homepage. The editor does not rewrite the homepage design.
- `article.html` — publisher-owned article template. The editor injects content and SEO metadata into this template when publishing.
- `style.css` / `article.css` — presentation layer.
- `script.js` / `article.js` — progressive enhancement only.
- `admin/index.html` — editorial dashboard and publishing workflow.
- `admin/published.html` — published article index.
- `admin/draft.html` — local draft queue.
- `admin/settings.html` — GitHub repository, site URL, media and AI configuration.
- `assets/articles.json` — canonical publication database.
- `assets/categories.json` — TrendRader taxonomy.
- `sitemap.xml` / `rss.xml` / `robots.txt` — crawl/discovery surfaces.
- `sw.js` — network-first service worker with an offline shell fallback.

## Publishing model

The editor uses GitHub's Contents/Git Data APIs from the browser. Configure:

1. GitHub personal access token with the minimum repository permissions required to write the publication repository.
2. Repository in `owner/repository` format.
3. Branch, normally `main`.
4. Site URL: `https://trendrader.space`.

Publishing writes the canonical article record to `assets/articles.json`, writes the standalone article to `articles/<slug>.html`, preserves an editor delta, updates taxonomy data, and rebuilds discovery files.

The homepage and article template are publisher-owned and protected by the editor.

## SEO architecture

Published article pages include:

- `NewsArticle` or `Article` JSON-LD as appropriate to the story format.
- `Organization`, publisher, author, `datePublished`, `dateModified`, `mainEntityOfPage`, `articleSection`, keywords and image metadata.
- Canonical URL and index/follow directives.
- Open Graph and large-image Twitter metadata.
- RSS discovery.
- Sitemap entries with last-modified dates and image metadata.
- Breadcrumb/related-article structures where applicable.
- Accessible semantic HTML, explicit image dimensions and lazy loading for non-critical images.

The system is designed around Google Search/News/Discover best practices, but no CMS can guarantee inclusion, a Discover appearance, a specific ranking, or a Lighthouse score independent of hosting, asset weight, server latency and editorial quality.

## Editorial rule

The editor owns content, metadata, taxonomy, publication state and repository data. It does not redesign the homepage or article presentation.
