(() => {
  "use strict";

  /*
   * TRENDRADER PUBLIC FRONTEND 4.0
   * Editorial feed engine
   *
   * Responsibilities:
   * - Load and validate published stories.
   * - Build an editorial hierarchy instead of blindly rendering feed order.
   * - Select a lead story using explicit editorial signals first, then quality/recency.
   * - Build section-specific feeds with category aliases and intelligent fallback logic.
   * - Keep live feed status visible and accurate.
   * - Provide resilient search, navigation, ticker, newsletter and motion behavior.
   */

  const BASE_SITE = "https://trendrader.space";
  const DB_PATH = "./assets/articles.json";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    articles: [],
    filtered: [],
    lead: null,
    lastUpdated: null,
    query: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHtml = (value) => String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );

  const normalizePath = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
      return raw;
    }

    return `./${raw.replace(/^\.\//, "")}`;
  };

  const articleUrl = (article) => {
    const explicit = String(
      article?.url ||
      article?.href ||
      article?.permalink ||
      ""
    ).trim();

    if (
      explicit &&
      explicit !== "#" &&
      !/^index\.html$/i.test(explicit)
    ) {
      return normalizePath(explicit);
    }

    const slug = String(
      article?.slug ||
      article?.articleSlug ||
      ""
    ).trim();

    return slug
      ? `./articles/${encodeURIComponent(slug)}.html`
      : "#";
  };

  const title = (article) => String(
    article?.title ||
    article?.headline ||
    article?.name ||
    ""
  ).trim();

  const description = (article) => String(
    article?.desc ||
    article?.description ||
    article?.excerpt ||
    article?.dek ||
    article?.summary ||
    ""
  ).trim();

  const image = (article) => String(
    article?.image ||
    article?.imageUrl ||
    article?.featuredImage ||
    article?.featured_image ||
    article?.thumbnail ||
    article?.coverImage ||
    ""
  ).trim();

  const imageAlt = (article) => String(
    article?.imageAlt ||
    article?.image_alt ||
    article?.alt ||
    title(article) ||
    "TrendRader editorial image"
  ).trim();

  const category = (article) => String(
    article?.category ||
    article?.categoryLabel ||
    article?.section ||
    article?.meta ||
    "News"
  ).trim();

  const tag = (article) => String(
    article?.tag ||
    article?.contentType ||
    article?.label ||
    category(article) ||
    "News"
  ).trim();

  const author = (article) => String(
    article?.author ||
    article?.byline ||
    article?.writer ||
    "TrendRader Editorial"
  ).trim();

  const date = (article) => (
    article?.date ||
    article?.publishedAt ||
    article?.datePublished ||
    article?.publishDate ||
    article?.createdAt ||
    article?.updatedAt ||
    ""
  );

  const keywords = (article) => {
    const value = article?.keywords;

    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(/[,\|]/)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  };

  const textBlob = (article) => [
    title(article),
    description(article),
    category(article),
    tag(article),
    article?.subcategory,
    article?.section,
    article?.categoryLabel,
    author(article),
    keywords(article).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const normalizeToken = (value) => String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const categoryAliases = {
    politics: [
      "politics",
      "political",
      "government",
      "national",
      "nigeria",
      "news"
    ],
    technology: [
      "technology",
      "tech",
      "ai",
      "artificial intelligence",
      "digital",
      "science"
    ],
    business: [
      "business",
      "economy",
      "economic",
      "finance",
      "financial",
      "markets",
      "money",
      "companies",
      "corporate"
    ],
    entertainment: [
      "entertainment",
      "culture",
      "music",
      "movies",
      "film",
      "celebrity",
      "lifestyle"
    ],
    sports: [
      "sports",
      "sport",
      "football",
      "soccer",
      "basketball",
      "tennis",
      "athletics"
    ]
  };

  const articleCategoryValues = (article) => [
    article?.category,
    article?.categoryLabel,
    article?.section,
    article?.subcategory,
    article?.meta,
    article?.contentType
  ]
    .filter(Boolean)
    .map(normalizeToken);

  const matchesCategory = (article, wanted) => {
    const target = normalizeToken(wanted);
    if (!target) return false;

    const aliases = categoryAliases[target] || [target];
    const values = articleCategoryValues(article);

    return aliases.some((alias) => {
      const normalizedAlias = normalizeToken(alias);

      return values.some((value) =>
        value === normalizedAlias ||
        value.split(" ").includes(normalizedAlias) ||
        value.includes(normalizedAlias)
      );
    });
  };

  const parseDate = (value) => {
    if (!value) return null;

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const timestamp = (article) => {
    const parsed = parseDate(date(article));
    return parsed ? parsed.getTime() : 0;
  };

  const isPublished = (article) => {
    if (!article || !title(article)) return false;

    const status = String(
      article.status ||
      article.state ||
      article.publicationStatus ||
      ""
    ).toLowerCase().trim();

    if (
      [
        "draft",
        "unpublished",
        "archived",
        "deleted",
        "scheduled",
        "private",
        "pending"
      ].includes(status)
    ) {
      return false;
    }

    if (
      article.published === false ||
      article.isPublished === false ||
      article.public === false
    ) {
      return false;
    }

    if (
      article.page &&
      String(article.page).toLowerCase() !== "news"
    ) {
      return false;
    }

    return Boolean(
      article.url ||
      article.href ||
      article.permalink ||
      article.slug ||
      article.articleSlug
    );
  };

  const sortArticles = (items) => [...items].sort((a, b) => {
    const dateDifference = timestamp(b) - timestamp(a);

    if (dateDifference !== 0) {
      return dateDifference;
    }

    const bPriority = Number(
      b.priority ??
      b.editorialPriority ??
      b.rank ??
      0
    );

    const aPriority = Number(
      a.priority ??
      a.editorialPriority ??
      a.rank ??
      0
    );

    return bPriority - aPriority;
  });

  const formatDate = (value) => {
    const parsed = parseDate(value);

    if (!parsed) {
      return "Recently published";
    }

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(parsed);
  };

  const relativeDate = (value) => {
    const parsed = parseDate(value);

    if (!parsed) {
      return "Recently";
    }

    const diff = Math.max(0, Date.now() - parsed.getTime());
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }

    return formatDate(value);
  };

  const readTime = (article) => {
    const explicit = Number(
      article?.readTime ??
      article?.readingTime ??
      0
    );

    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.max(1, Math.round(explicit));
    }

    const words = Number(
      article?.wordCount ??
      article?.words ??
      0
    );

    if (Number.isFinite(words) && words > 0) {
      return Math.max(1, Math.ceil(words / 220));
    }

    const body = String(
      article?.body ||
      article?.content ||
      article?.articleBody ||
      ""
    );

    if (body) {
      const estimatedWords = body
        .replace(/<[^>]+>/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

      if (estimatedWords > 0) {
        return Math.max(1, Math.ceil(estimatedWords / 220));
      }
    }

    return 4;
  };

  const editorialBoolean = (article, fields) => fields.some((field) => {
    const value = article?.[field];

    return value === true ||
      value === 1 ||
      String(value || "").toLowerCase() === "true" ||
      String(value || "").toLowerCase() === "yes";
  });

  const editorialPriority = (article) => {
    let score = 0;

    if (editorialBoolean(article, [
      "featured",
      "isFeatured",
      "hero",
      "isHero",
      "lead",
      "isLead",
      "pinned",
      "isPinned"
    ])) {
      score += 1000;
    }

    const explicitPriority = Number(
      article?.priority ??
      article?.editorialPriority ??
      article?.heroPriority ??
      article?.rank ??
      0
    );

    if (Number.isFinite(explicitPriority)) {
      score += Math.max(-100, Math.min(500, explicitPriority * 10));
    }

    const tagText = `${tag(article)} ${article?.label || ""}`.toLowerCase();

    if (tagText.includes("breaking")) {
      score += 220;
    }

    if (tagText.includes("exclusive")) {
      score += 120;
    }

    if (tagText.includes("analysis")) {
      score += 50;
    }

    const ageHours = timestamp(article)
      ? Math.max(0, (Date.now() - timestamp(article)) / 3600000)
      : 9999;

    if (ageHours <= 6) score += 100;
    else if (ageHours <= 24) score += 65;
    else if (ageHours <= 72) score += 30;

    if (image(article)) score += 30;
    if (description(article)) score += 15;

    const engagement = Number(
      article?.views ??
      article?.viewCount ??
      article?.engagement ??
      article?.score ??
      0
    );

    if (Number.isFinite(engagement) && engagement > 0) {
      score += Math.min(80, Math.log10(engagement + 1) * 15);
    }

    return score;
  };

  const selectLead = (items) => {
    if (!items.length) return null;

    return [...items]
      .sort((a, b) => {
        const priorityDifference =
          editorialPriority(b) - editorialPriority(a);

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return timestamp(b) - timestamp(a);
      })[0];
  };

  const uniqueArticles = (items) => {
    const seen = new Set();

    return items.filter((article) => {
      const key = String(
        article?.id ||
        article?.articleId ||
        article?.slug ||
        article?.url ||
        title(article)
      ).toLowerCase();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  };

  const imageMarkup = (article, className, eager = false) => {
    const src = image(article);

    if (!src) {
      return `
        <div class="${escapeHtml(className)} image-fallback" aria-hidden="true">
          <span>TrendRader</span>
        </div>
      `;
    }

    return `
      <div class="${escapeHtml(className)}">
        <img
          src="${escapeHtml(src)}"
          alt="${escapeHtml(imageAlt(article))}"
          width="1200"
          height="675"
          ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}
          decoding="async"
        >
      </div>
    `;
  };

  const cardMarkup = (article) => `
    <article class="story-card reveal">
      <a
        href="${escapeHtml(articleUrl(article))}"
        aria-label="Read: ${escapeHtml(title(article))}"
      >
        ${imageMarkup(article, "story-image")}
        <div class="story-info">
          <span>${escapeHtml(category(article))}</span>
          <i></i>
          <time datetime="${escapeHtml(date(article))}">
            ${escapeHtml(relativeDate(date(article)))}
          </time>
        </div>
        <h3>${escapeHtml(title(article))}</h3>
        ${
          description(article)
            ? `<p>${escapeHtml(description(article))}</p>`
            : ""
        }
      </a>
    </article>
  `;

  const categoryCardMarkup = (article) => `
    <article class="category-card reveal">
      <a
        href="${escapeHtml(articleUrl(article))}"
        aria-label="Read: ${escapeHtml(title(article))}"
      >
        ${imageMarkup(article, "category-image")}
        <div class="story-info">
          <span>${escapeHtml(category(article))}</span>
          <i></i>
          <time datetime="${escapeHtml(date(article))}">
            ${escapeHtml(relativeDate(date(article)))}
          </time>
        </div>
        <h3>${escapeHtml(title(article))}</h3>
        ${
          description(article)
            ? `<p>${escapeHtml(description(article))}</p>`
            : ""
        }
      </a>
    </article>
  `;

  const compactCardMarkup = (article) => `
    <article class="category-card reveal">
      <a
        href="${escapeHtml(articleUrl(article))}"
        aria-label="Read: ${escapeHtml(title(article))}"
      >
        ${imageMarkup(article, "category-image")}
        <div>
          <div class="story-info">
            <span>${escapeHtml(category(article))}</span>
            <i></i>
            <time datetime="${escapeHtml(date(article))}">
              ${escapeHtml(relativeDate(date(article)))}
            </time>
          </div>
          <h3>${escapeHtml(title(article))}</h3>
        </div>
      </a>
    </article>
  `;

  const renderLead = (article) => {
    const mount = $("#leadStoryMount");

    if (!mount) return;

    if (!article) {
      mount.hidden = true;
      mount.innerHTML = "";
      return;
    }

    mount.hidden = false;

    mount.innerHTML = `
      <a
        class="lead-story"
        href="${escapeHtml(articleUrl(article))}"
        aria-label="Read featured story: ${escapeHtml(title(article))}"
      >
        <div class="lead-image">
          ${imageMarkup(article, "lead-image-inner", true)}
          <div class="image-shade" aria-hidden="true"></div>

          <div class="lead-index">
            <span>01</span>
            <i></i>
            <span>${escapeHtml(tag(article))}</span>
          </div>

          <div class="lead-arrow" aria-hidden="true">↗</div>
        </div>

        <div class="lead-content">
          <div class="story-category">
            <span>${escapeHtml(category(article))}</span>
            <i></i>
            <span>LEAD</span>
          </div>

          <h2>${escapeHtml(title(article))}</h2>

          ${
            description(article)
              ? `<p>${escapeHtml(description(article))}</p>`
              : ""
          }

          <div class="story-byline">
            <span>By ${escapeHtml(author(article))}</span>
            <span class="byline-line"></span>
            <span>${readTime(article)} min read</span>
          </div>
        </div>
      </a>
    `;

    observeReveals(mount);
  };

  const renderTicker = (items) => {
    const ticker = $("#liveTicker");
    const track = $("#tickerTrack");

    if (!ticker || !track) return;

    const live = items
      .filter((article) => title(article))
      .slice(0, 8);

    if (live.length < 2) {
      ticker.hidden = true;
      track.innerHTML = "";
      return;
    }

    const links = live
      .map((article) => `
        <a href="${escapeHtml(articleUrl(article))}">
          ${escapeHtml(title(article))}
        </a>
        <i>•</i>
      `)
      .join("");

    track.innerHTML = `
      <div class="ticker-content">${links}</div>
      <div class="ticker-content" aria-hidden="true">${links}</div>
    `;

    ticker.hidden = false;
  };

  const setFeedStatus = (message, mode = "normal") => {
    const status = $("#feedStatus");

    if (!status) return;

    status.dataset.state = mode;
    status.textContent = message;
  };

  const renderLatest = (items = state.articles) => {
    const grid = $("#latestGrid");

    if (!grid) return;

    const visible = items
      .filter((article) => article !== state.lead)
      .slice(0, 12);

    if (!visible.length) {
      grid.innerHTML = `
        <div class="feed-empty">
          <strong>No published stories match this view.</strong>
          <span>Try another topic or return to the latest feed.</span>
        </div>
      `;
      observeReveals(grid);
      return;
    }

    grid.innerHTML = visible
      .map(cardMarkup)
      .join("");

    observeReveals(grid);
  };

  const renderCategory = (
    id,
    wanted,
    limit = 3,
    options = {}
  ) => {
    const grid = $(`#${id}`);
    const section = grid?.closest("[data-category]");

    if (!grid || !section) return;

    const {
      excludeLead = true,
      fallbackToLatest = false
    } = options;

    let matches = state.articles.filter((article) => {
      if (excludeLead && article === state.lead) {
        return false;
      }

      return matchesCategory(article, wanted);
    });

    if (!matches.length && fallbackToLatest) {
      matches = state.articles
        .filter((article) => article !== state.lead)
        .slice(0, limit);
    }

    matches = uniqueArticles(matches).slice(0, limit);

    section.hidden = !matches.length;

    if (!matches.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = matches
      .map(categoryCardMarkup)
      .join("");

    observeReveals(grid);
  };

  const renderTechnology = () => {
    const grid = $("#technologyGrid");
    const section = $("#technology");

    if (!grid || !section) return;

    let matches = state.articles.filter((article) =>
      matchesCategory(article, "technology")
    );

    matches = uniqueArticles(
      matches.filter((article) => article !== state.lead)
    ).slice(0, 4);

    section.hidden = !matches.length;

    if (!matches.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = matches
      .map((article) => `
        <a
          class="dark-card reveal"
          href="${escapeHtml(articleUrl(article))}"
          aria-label="Read: ${escapeHtml(title(article))}"
        >
          ${imageMarkup(article, "", false)}

          <div>
            <div class="story-info">
              <span>${escapeHtml(tag(article))}</span>
              <i></i>
              <time datetime="${escapeHtml(date(article))}">
                ${escapeHtml(relativeDate(date(article)))}
              </time>
            </div>

            <h3>${escapeHtml(title(article))}</h3>
          </div>
        </a>
      `)
      .join("");

    observeReveals(grid);
  };

  const renderSports = () => {
    const grid = $("#sportsGrid");
    const section = $("#sports");

    if (!grid || !section) return;

    const matches = uniqueArticles(
      state.articles.filter((article) =>
        matchesCategory(article, "sports") &&
        article !== state.lead
      )
    ).slice(0, 5);

    section.hidden = !matches.length;

    if (!matches.length) {
      grid.innerHTML = "";
      return;
    }

    const [feature, ...compact] = matches;

    grid.innerHTML = `
      ${categoryCardMarkup(feature)}
      ${compact.map(compactCardMarkup).join("")}
    `;

    observeReveals(grid);
  };

  const trendingScore = (article, index) => {
    const ageHours = timestamp(article)
      ? Math.max(0, (Date.now() - timestamp(article)) / 3600000)
      : 9999;

    let score = 0;

    if (ageHours <= 3) score += 100;
    else if (ageHours <= 12) score += 80;
    else if (ageHours <= 24) score += 60;
    else if (ageHours <= 72) score += 35;
    else if (ageHours <= 168) score += 15;

    const engagement = Number(
      article?.views ??
      article?.viewCount ??
      article?.engagement ??
      article?.score ??
      0
    );

    if (Number.isFinite(engagement) && engagement > 0) {
      score += Math.min(100, Math.log10(engagement + 1) * 22);
    }

    const text = textBlob(article);

    if (text.includes("breaking")) score += 35;
    if (text.includes("exclusive")) score += 25;
    if (text.includes("latest")) score += 10;

    score += Math.max(0, 20 - index);

    return score;
  };

  const renderTrending = () => {
    const grid = $("#trendingGrid");
    const section = $("#trending");

    if (!grid || !section) return;

    const candidates = state.articles
      .filter((article) => article !== state.lead)
      .map((article, index) => ({
        article,
        score: trendingScore(article, index)
      }))
      .sort((a, b) => {
        const scoreDifference = b.score - a.score;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return timestamp(b.article) - timestamp(a.article);
      })
      .map((entry) => entry.article);

    const matches = uniqueArticles(candidates).slice(0, 5);

    section.hidden = !matches.length;

    if (!matches.length) {
      grid.innerHTML = "";
      return;
    }

    const [feature, ...compact] = matches;

    grid.innerHTML = `
      ${categoryCardMarkup(feature)}
      ${compact.map(compactCardMarkup).join("")}
    `;

    observeReveals(grid);
  };

  const renderCategorySections = () => {
    renderCategory("politicsGrid", "politics", 3);
    renderTechnology();
    renderCategory("businessGrid", "business", 3);
    renderCategory("entertainmentGrid", "entertainment", 3);
    renderSports();
    renderTrending();
  };

  const updateHomepageMeta = () => {
    const latest = state.articles[0];

    const heroDate = $("#heroDate");

    if (heroDate) {
      heroDate.textContent = latest
        ? `Updated ${formatDate(date(latest))}`
        : "Latest published stories";
    }

    const todayLabel = $("#todayLabel");

    if (todayLabel) {
      todayLabel.textContent = new Intl.DateTimeFormat(
        "en-NG",
        {
          month: "long",
          year: "numeric"
        }
      ).format(new Date());
    }
  };

  const renderSearchResults = (query) => {
    const normalizedQuery = String(query || "")
      .trim()
      .toLowerCase();

    state.query = normalizedQuery;

    if (!normalizedQuery) {
      state.filtered = state.articles;
      setFeedStatus(
        `${state.articles.length} published ${
          state.articles.length === 1 ? "story" : "stories"
        }`,
        "live"
      );
      renderLatest();
      return;
    }

    const matches = state.articles.filter((article) =>
      textBlob(article).includes(normalizedQuery)
    );

    state.filtered = matches;

    setFeedStatus(
      `${matches.length} result${
        matches.length === 1 ? "" : "s"
      } for "${String(query).trim()}"`,
      "search"
    );

    $("#latest")?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start"
    });

    renderLatest(matches);
  };

  const showEmptyState = (
    headline = "No published stories yet.",
    message = "Published stories from the TrendRader editorial system will appear here automatically. Drafts and unpublished records are never shown on the public feed."
  ) => {
    const empty = $("#emptyState");

    if (!empty) return;

    empty.hidden = false;

    const heading = $("h2", empty);
    const paragraph = $("p", empty);

    if (heading) {
      heading.textContent = headline;
    }

    if (paragraph) {
      paragraph.textContent = message;
    }
  };

  const hideEmptyState = () => {
    const empty = $("#emptyState");

    if (empty) {
      empty.hidden = true;
    }
  };

  const showFeedError = (message) => {
    showEmptyState(
      "The published feed is temporarily unavailable.",
      message ||
        "TrendRader could not load its published article database. Please try again shortly."
    );

    setFeedStatus("Feed unavailable", "error");

    const mount = $("#leadStoryMount");

    if (mount) {
      mount.hidden = true;
      mount.innerHTML = "";
    }

    const grids = [
      "#latestGrid",
      "#politicsGrid",
      "#technologyGrid",
      "#businessGrid",
      "#entertainmentGrid",
      "#sportsGrid",
      "#trendingGrid"
    ];

    grids.forEach((selector) => {
      const grid = $(selector);
      if (grid) grid.innerHTML = "";
    });
  };

  const extractArticles = (payload) => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.articles)) {
      return payload.articles;
    }

    if (Array.isArray(payload?.items)) {
      return payload.items;
    }

    if (Array.isArray(payload?.stories)) {
      return payload.stories;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return [];
  };

  const loadPublishedArticles = async () => {
    setFeedStatus("Connecting to live feed...", "loading");

    try {
      const response = await fetch(
        `${DB_PATH}?v=${Date.now()}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `Published feed returned HTTP ${response.status}.`
        );
      }

      const payload = await response.json();
      const raw = extractArticles(payload);

      state.articles = sortArticles(
        uniqueArticles(raw.filter(isPublished))
      );

      state.lastUpdated = new Date();

      if (!state.articles.length) {
        state.filtered = [];
        state.lead = null;

        renderLead(null);
        showEmptyState();
        setFeedStatus("No published stories", "empty");

        const grids = [
          "#latestGrid",
          "#politicsGrid",
          "#technologyGrid",
          "#businessGrid",
          "#entertainmentGrid",
          "#sportsGrid",
          "#trendingGrid"
        ];

        grids.forEach((selector) => {
          const grid = $(selector);
          if (grid) grid.innerHTML = "";
        });

        $("#liveTicker")?.setAttribute("hidden", "");

        updateHomepageMeta();
        return;
      }

      hideEmptyState();

      state.lead = selectLead(state.articles);
      state.filtered = state.articles;

      renderLead(state.lead);
      renderLatest(state.articles);
      renderTicker(state.articles);
      renderCategorySections();

      setFeedStatus(
        `Live · ${state.articles.length} published ${
          state.articles.length === 1 ? "story" : "stories"
        }`,
        "live"
      );

      updateHomepageMeta();
    } catch (error) {
      console.error("TrendRader feed failed:", error);
      showFeedError(error?.message);
    }
  };

  const observeReveals = (root = document) => {
    const elements = $$(".reveal", root);

    if (!elements.length) return;

    elements.forEach((element) => {
      element.classList.add("visible");
      element.style.opacity = "1";
      element.style.transform = "none";
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      return;
    }

    elements.forEach((element, index) => {
      if (element.dataset.revealAnimated === "true") return;

      element.dataset.revealAnimated = "true";

      element.animate(
        [
          { opacity: 0, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 420,
          delay: Math.min(index * 35, 140),
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "both"
        }
      );
    });
  };

  const setupNavigation = () => {
    const menu = $("#menuToggle");
    const nav = $("#mobileNav");

    const closeMenu = () => {
      if (!menu || !nav) return;

      nav.classList.remove("open");
      menu.classList.remove("menu-open");
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Open menu");
    };

    menu?.addEventListener("click", () => {
      if (!nav) return;

      const open = nav.classList.toggle("open");

      menu.classList.toggle("menu-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute(
        "aria-label",
        open ? "Close menu" : "Open menu"
      );
    });

    $$(".mobile-nav a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    const searchToggle = $("#searchToggle");
    const panel = $("#searchPanel");
    const input = $("#searchInput");

    const closeSearch = () => {
      if (!panel || !searchToggle) return;

      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
      searchToggle.setAttribute("aria-expanded", "false");
      searchToggle.setAttribute("aria-label", "Open search");
    };

    searchToggle?.addEventListener("click", () => {
      if (!panel) return;

      const open = panel.classList.toggle("open");

      panel.setAttribute("aria-hidden", String(!open));
      searchToggle.setAttribute("aria-expanded", String(open));
      searchToggle.setAttribute(
        "aria-label",
        open ? "Close search" : "Open search"
      );

      if (open) {
        setTimeout(() => input?.focus(), 120);
      }
    });

    $("#searchForm")?.addEventListener("submit", (event) => {
      event.preventDefault();

      renderSearchResults(input?.value || "");
    });

    input?.addEventListener("search", () => {
      if (!input.value.trim()) {
        renderSearchResults("");
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        closeSearch();
      }

      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName
        )
      ) {
        event.preventDefault();

        if (!panel) return;

        panel.classList.add("open");
        panel.setAttribute("aria-hidden", "false");
        searchToggle?.setAttribute("aria-expanded", "true");
        input?.focus();
      }
    });
  };

  const setupNewsletter = () => {
    const form = $("#newsletterForm");
    const input = $("#newsletterEmail");
    const message = $("#newsletterMessage");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!input || !message) return;

      if (!input.validity.valid) {
        input.focus();
        return;
      }

      input.value = "";

      message.textContent =
        "You're on the list. Welcome to TrendRader.";
    });
  };

  const setupScroll = () => {
    const header = $("#siteHeader");

    if (!header) return;

    let ticking = false;

    const update = () => {
      header.classList.toggle(
        "scrolled",
        window.scrollY > 12
      );

      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );

    update();
  };

  const setupCursor = () => {
    const glow = $(".cursor-glow");

    if (
      !glow ||
      reducedMotion ||
      !window.matchMedia("(hover:hover)").matches
    ) {
      return;
    }

    window.addEventListener(
      "pointermove",
      (event) => {
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
        glow.style.opacity = "1";
      },
      { passive: true }
    );

    window.addEventListener(
      "pointerleave",
      () => {
        glow.style.opacity = "0";
      },
      { passive: true }
    );
  };

  const setupYear = () => {
    const year = $("#footerYear");

    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    const today = $("#todayLabel");

    if (today) {
      today.textContent = new Intl.DateTimeFormat(
        "en-NG",
        {
          month: "long",
          year: "numeric"
        }
      ).format(new Date());
    }
  };

  const setupBrokenImageFallback = () => {
    document.addEventListener(
      "error",
      (event) => {
        const imageElement = event.target;

        if (!(imageElement instanceof HTMLImageElement)) {
          return;
        }

        imageElement.classList.add("image-load-failed");

        const wrapper = imageElement.parentElement;

        if (
          wrapper &&
          wrapper.classList.contains("lead-image-inner")
        ) {
          wrapper.classList.add("image-fallback");
        } else if (wrapper) {
          wrapper.classList.add("image-fallback");
        }
      },
      true
    );
  };

  const setupArticleLinkGuard = () => {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a");

      if (!link) return;

      const href = link.getAttribute("href");

      if (!href || href === "#") {
        return;
      }

      if (
        /^javascript:/i.test(href) ||
        /^data:/i.test(href)
      ) {
        event.preventDefault();
      }
    });
  };

  observeReveals(document);
  setupYear();
  setupNavigation();
  setupNewsletter();
  setupScroll();
  setupCursor();
  setupBrokenImageFallback();
  setupArticleLinkGuard();
  loadPublishedArticles();
})();
