# TrendRader

TrendRader is a static-first digital news publication for Nigeria and the world.

## Editorial architecture

The editor owns content and publishing data. It does not redesign the public homepage or article presentation.

Publication flow:

1. Write headline and story.
2. Add publication details and real featured image.
3. Review SEO and editorial readiness.
4. Run Smart Internal Links when contextual opportunities exist.
5. Publish & Build.
6. The editor validates the article, creates the standalone article HTML and editor delta, updates `assets/articles.json`, rebuilds category pages, sitemap and RSS, then commits the publication atomically to GitHub.
7. The public homepage reads only published records from `assets/articles.json`.

## Progressive editor UX

Advanced sections are collapsed by default. Story and core publication details remain immediately available. SEO, AI assistance, review, build and migration tools open only when needed. Publishing automatically opens and scrolls to the Build & Publication section and reports live workflow state.

## Smart internal linking

The internal-link engine does not inject arbitrary keywords. It compares the current story with published TrendRader coverage using title phrases, keywords, taxonomy, semantic overlap and recency. A suggestion is only actionable when a meaningful anchor phrase already exists naturally in the story. The editor explicitly applies each link.

## Public frontend

The homepage and article page are mobile-first and consume the same published article database. Unpublished/draft records are excluded. Article pages use canonical TrendRader URLs, editorial typography, accessible semantic markup, responsive images and NewsArticle structured data.

## Configuration

Production site URL:

`https://trendrader.space`

GitHub repository:

`Jonatt-001/trendrader-ng`

Cloudinary:

- Cloud name: `dxdbn6xwy`
- Upload preset: `geefox_unsigned`

Do not commit private API secrets. Browser uploads use the configured unsigned preset.
