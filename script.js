(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const BASE_SITE = "https://trendrader.space";

  const state = {
    articles: [],
    filtered: [],
    categoryArticles: {},
    initializedHome: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[char]));
  }

  function siteRootPrefix() {
    return location.pathname.includes("/articles/") ? "../" : "./";
  }

  function articleDatabaseUrl() {
    return new URL(`${siteRootPrefix()}assets/articles.json`, location.href).href;
  }

  function normalizeArticle(article) {
    return {
      ...article,

      title: String(
        article.title ||
        article.headline ||
        ""
      ).trim(),

      desc: String(
        article.desc ||
        article.description ||
        article.excerpt ||
        article.dek ||
        ""
      ).trim(),

      image: String(
        article.image ||
        article.imageUrl ||
        article.featuredImage ||
        ""
      ).trim(),

      imageAlt: String(
        article.imageAlt ||
        article.alt ||
        ""
      ).trim(),

      category: String(
        article.categoryLabel ||
        article.category ||
        article.meta ||
        "News"
      ).trim(),

      tag: String(
        article.tag ||
        article.contentType ||
        "News"
      ).trim(),

      author: String(
        article.author ||
        "TrendRader Editorial"
      ).trim(),

      date:
        article.date ||
        article.publishedAt ||
        article.datePublished ||
        article.createdAt ||
        "",

      slug: String(
        article.slug ||
        ""
      ).trim(),

      url: String(
        article.url ||
        article.page ||
        ""
      ).trim(),

      delta: String(
        article.delta ||
        ""
      ).trim(),

      modified:
        article.modified ||
        article.dateModified ||
        article.date ||
        ""
    };
  }

  function isPublished(article) {
    const status = String(
      article.status ||
      article.state ||
      ""
    ).toLowerCase();

    const page = String(
      article.page ||
      ""
    ).toLowerCase();

    if (
      [
        "draft",
        "unpublished",
        "archived",
        "deleted"
      ].includes(status)
    ) {
      return false;
    }

    if (
      page &&
      page !== "news"
    ) {
      return false;
    }

    return Boolean(
      article.title &&
      (
        article.slug ||
        article.url
      )
    );
  }

  function sortArticles(items) {
    return [...items].sort(
      (a, b) =>
        new Date(b.date || 0) -
        new Date(a.date || 0)
    );
  }

  function articleUrl(article) {
    if (
      article.url &&
      article.url !== "#"
    ) {
      if (
        /^https?:\/\//i.test(article.url)
      ) {
        return article.url;
      }

      const clean = article.url
        .replace(/^\.\//, "")
        .replace(/^\//, "");

      return new URL(
        `${siteRootPrefix()}${clean}`,
        location.href
      ).href;
    }

    return new URL(
      `${siteRootPrefix()}articles/${encodeURIComponent(article.slug)}.html`,
      location.href
    ).href;
  }

  function formatDate(value, short = false) {
    const date = new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Recently published";
    }

    return new Intl.DateTimeFormat(
      "en-NG",
      short
        ? {
            day:"numeric",
            month:"short"
          }
        : {
            day:"numeric",
            month:"long",
            year:"numeric"
          }
    ).format(date);
  }

  function readTime(article, bodyText = "") {
    const supplied = Number(article.readTime);

    if (
      Number.isFinite(supplied) &&
      supplied > 0
    ) {
      return Math.round(supplied);
    }

    const words = bodyText
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;

    return Math.max(
      1,
      Math.round(words / 200) || 1
    );
  }

  function setMeta(selector, content) {
    const el = $(selector);

    if (
      el &&
      content
    ) {
      el.setAttribute(
        "content",
        content
      );
    }
  }

  function setCanonical(url) {
    const canonical = $('link[rel="canonical"]');

    if (canonical) {
      canonical.setAttribute(
        "href",
        url
      );
    }
  }

  function getSlugFromLocation() {
    const query = new URLSearchParams(
      location.search
    ).get("slug");

    if (query) {
      return decodeURIComponent(query);
    }

    const path = location.pathname
      .split("/")
      .filter(Boolean);

    const file =
      path[path.length - 1] ||
      "";

    if (
      file.endsWith(".html") &&
      file !== "article.html"
    ) {
      return file.replace(
        /\.html$/i,
        ""
      );
    }

    return "";
  }


  /* =========================================================
     SVG ICONS
     ========================================================= */

  function arrowSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h13"></path>
        <path d="m13 6 6 6-6 6"></path>
      </svg>
    `;
  }

  function externalArrowSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h12"></path>
        <path d="m13 6 6 6-6 6"></path>
      </svg>
    `;
  }


  /* =========================================================
     IMAGE HELPERS
     ========================================================= */

  function imageMarkup(article, className = "") {
    if (!article.image) {
      return `
        <div class="${className} image-fallback">
          <span>TRENDRADER</span>
        </div>
      `;
    }

    return `
      <div class="${className}">
        <img
          src="${escapeHtml(article.image)}"
          alt="${escapeHtml(article.imageAlt || article.title)}"
          loading="lazy"
          decoding="async"
          width="1200"
          height="750"
        >
      </div>
    `;
  }

  function attachImageFallbacks(root = document) {
    $$("img", root).forEach((image) => {
      if (
        image.dataset.fallbackBound === "true"
      ) {
        return;
      }

      image.dataset.fallbackBound = "true";

      image.addEventListener(
        "error",
        () => {
          const parent = image.parentElement;

          if (!parent) {
            return;
          }

          image.remove();

          parent.classList.add(
            "image-fallback"
          );

          if (!parent.querySelector("span")) {
            const label =
              document.createElement("span");

            label.textContent =
              "TRENDRADER";

            parent.appendChild(label);
          }
        },
        {
          once:true
        }
      );
    });
  }


  /* =========================================================
     HOMEPAGE CATEGORY NORMALIZATION
     ========================================================= */

  function categoryKey(article) {
    const value = String(
      article.category ||
      ""
    ).toLowerCase().trim();

    if (
      value.includes("politic")
    ) {
      return "politics";
    }

    if (
      value.includes("tech") ||
      value.includes("ai") ||
      value.includes("science")
    ) {
      return "technology";
    }

    if (
      value.includes("business") ||
      value.includes("econom") ||
      value.includes("finance") ||
      value.includes("money")
    ) {
      return "business";
    }

    if (
      value.includes("entertain") ||
      value.includes("culture") ||
      value.includes("music") ||
      value.includes("movie") ||
      value.includes("celebr")
    ) {
      return "entertainment";
    }

    if (
      value.includes("sport")
    ) {
      return "sports";
    }

    if (
      value.includes("trend")
    ) {
      return "trending";
    }

    const combined = `
      ${article.title}
      ${article.desc}
      ${article.tag}
    `.toLowerCase();

    if (
      /\btrending\b|\bviral\b|\bwhat's trending\b/.test(combined)
    ) {
      return "trending";
    }

    return null;
  }

  function buildCategoryBuckets(articles) {
    const buckets = {
      politics:[],
      technology:[],
      business:[],
      entertainment:[],
      sports:[],
      trending:[]
    };

    articles.forEach((article) => {
      const key = categoryKey(article);

      if (
        key &&
        buckets[key]
      ) {
        buckets[key].push(article);
      }
    });

    return buckets;
  }


  /* =========================================================
     HOME CARD MARKUP
     ========================================================= */

  function storyMeta(article) {
    return `
      <div class="story-info">
        <span>${escapeHtml(article.tag || article.category || "News")}</span>
        <i></i>
        <span>${escapeHtml(formatDate(article.date, true))}</span>
      </div>
    `;
  }

  function storyCard(article, index = 0) {
    return `
      <article class="story-card reveal">
        <a
          href="${escapeHtml(articleUrl(article))}"
          aria-label="${escapeHtml(article.title)}"
        >

          <div class="story-image">

            ${
              article.image
                ? `
                  <img
                    src="${escapeHtml(article.image)}"
                    alt="${escapeHtml(article.imageAlt || article.title)}"
                    loading="lazy"
                    decoding="async"
                    width="1000"
                    height="625"
                  >
                `
                : `
                  <div class="image-fallback">
                    <span>TRENDRADER</span>
                  </div>
                `
            }

            <span class="image-number">
              ${String(index + 1).padStart(2, "0")}
            </span>

            <span class="story-arrow">
              ${arrowSvg()}
            </span>

          </div>

          ${storyMeta(article)}

          <h3>
            ${escapeHtml(article.title)}
          </h3>

          ${
            article.desc
              ? `
                <p>
                  ${escapeHtml(article.desc)}
                </p>
              `
              : ""
          }

        </a>
      </article>
    `;
  }

  function featureHeroCard(article) {
    return `
      <article class="category-card category-card--hero reveal">

        <a
          href="${escapeHtml(articleUrl(article))}"
          aria-label="${escapeHtml(article.title)}"
        >

          ${
            article.image
              ? `
                <div class="category-image">

                  <img
                    src="${escapeHtml(article.image)}"
                    alt="${escapeHtml(article.imageAlt || article.title)}"
                    loading="lazy"
                    decoding="async"
                    width="1400"
                    height="875"
                  >

                  <span class="story-arrow">
                    ${arrowSvg()}
                  </span>

                </div>
              `
              : `
                <div class="category-image image-fallback">
                  <span>TRENDRADER</span>
                </div>
              `
          }

          <div class="category-card-content">

            ${storyMeta(article)}

            <h3>
              ${escapeHtml(article.title)}
            </h3>

            ${
              article.desc
                ? `
                  <p>
                    ${escapeHtml(article.desc)}
                  </p>
                `
                : ""
            }

          </div>

        </a>

      </article>
    `;
  }

  function supportCard(article, index = 0) {
    return `
      <article class="category-card category-card--support reveal">

        <a
          href="${escapeHtml(articleUrl(article))}"
          aria-label="${escapeHtml(article.title)}"
        >

          ${
            article.image
              ? `
                <div class="category-image">

                  <img
                    src="${escapeHtml(article.image)}"
                    alt="${escapeHtml(article.imageAlt || article.title)}"
                    loading="lazy"
                    decoding="async"
                    width="600"
                    height="450"
                  >

                </div>
              `
              : `
                <div class="category-image image-fallback">
                  <span>${String(index + 1).padStart(2, "0")}</span>
                </div>
              `
          }

          <div class="category-card-content">

            ${storyMeta(article)}

            <h3>
              ${escapeHtml(article.title)}
            </h3>

          </div>

        </a>

      </article>
    `;
  }


  /* =========================================================
     FEATURE SECTION RENDERER
     ========================================================= */

  function renderFeatureSection(grid, articles) {
    if (
      !grid ||
      !articles.length
    ) {
      return;
    }

    const hero = articles[0];

    const supporting = articles
      .slice(1, 5);

    grid.innerHTML = `
      ${featureHeroCard(hero)}

      ${
        supporting.length
          ? `
            <div class="category-support-list">
              ${supporting
                .map((article, index) =>
                  supportCard(article, index)
                )
                .join("")}
            </div>
          `
          : ""
      }
    `;
  }


  /* =========================================================
     NORMAL CATEGORY CARDS
     ========================================================= */

  function renderCardSection(grid, articles) {
    if (
      !grid ||
      !articles.length
    ) {
      return;
    }

    grid.innerHTML = articles
      .slice(0, 6)
      .map((article, index) =>
        storyCard(article, index)
      )
      .join("");
  }


  /* =========================================================
     SPORTS / COMPACT LIST
     ========================================================= */

  function renderListSection(grid, articles) {
    if (
      !grid ||
      !articles.length
    ) {
      return;
    }

    grid.innerHTML = articles
      .slice(0, 7)
      .map((article, index) => `
        <article class="category-card reveal">

          <a
            href="${escapeHtml(articleUrl(article))}"
            aria-label="${escapeHtml(article.title)}"
          >

            ${
              article.image
                ? `
                  <div class="category-image">

                    <img
                      src="${escapeHtml(article.image)}"
                      alt="${escapeHtml(article.imageAlt || article.title)}"
                      loading="lazy"
                      decoding="async"
                      width="800"
                      height="500"
                    >

                  </div>
                `
                : `
                  <div class="category-image image-fallback">
                    <span>${String(index + 1).padStart(2, "0")}</span>
                  </div>
                `
            }

            <div>

              ${storyMeta(article)}

              <h3>
                ${escapeHtml(article.title)}
              </h3>

              ${
                article.desc
                  ? `
                    <p>
                      ${escapeHtml(article.desc)}
                    </p>
                  `
                  : ""
              }

            </div>

          </a>

        </article>
      `)
      .join("");
  }


  /* =========================================================
     TECHNOLOGY DARK CARDS
     ========================================================= */

  function renderTechnology(grid, articles) {
    if (
      !grid ||
      !articles.length
    ) {
      return;
    }

    grid.innerHTML = articles
      .slice(0, 6)
      .map((article) => `
        <article
          class="dark-card reveal"
          tabindex="0"
        >

          <a
            href="${escapeHtml(articleUrl(article))}"
            aria-label="${escapeHtml(article.title)}"
          >

            ${
              article.image
                ? `
                  <div>
                    <img
                      src="${escapeHtml(article.image)}"
                      alt="${escapeHtml(article.imageAlt || article.title)}"
                      loading="lazy"
                      decoding="async"
                      width="700"
                      height="700"
                    >
                  </div>
                `
                : `
                  <div class="image-fallback">
                    <span>T</span>
                  </div>
                `
            }

            <div>

              ${storyMeta(article)}

              <h3>
                ${escapeHtml(article.title)}
              </h3>

            </div>

          </a>

        </article>
      `)
      .join("");
  }


  /* =========================================================
     CATEGORY SECTION MOUNTING
     ========================================================= */

  function mountCategorySection(key, articles) {
    const section = $(
      `[data-category="${key}"]`
    );

    if (!section) {
      return;
    }

    if (!articles.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    const grid = $(
      `#${key}Grid`
    );

    if (!grid) {
      return;
    }

    const layout =
      section.dataset.layout ||
      "cards";

    if (
      layout === "feature"
    ) {
      renderFeatureSection(
        grid,
        articles
      );
    } else if (
      layout === "dark"
    ) {
      renderTechnology(
        grid,
        articles
      );
    } else if (
      layout === "list"
    ) {
      renderListSection(
        grid,
        articles
      );
    } else {
      renderCardSection(
        grid,
        articles
      );
    }
  }


  /* =========================================================
     LEAD STORY
     ========================================================= */

  function renderLeadStory(article) {
    const mount = $(
      "#leadStoryMount"
    );

    if (
      !mount ||
      !article
    ) {
      return;
    }

    mount.innerHTML = `
      <article class="lead-story reveal">

        <a
          href="${escapeHtml(articleUrl(article))}"
          aria-label="${escapeHtml(article.title)}"
        >

          <div class="lead-image">

            <div class="lead-image-inner">

              ${
                article.image
                  ? `
                    <img
                      src="${escapeHtml(article.image)}"
                      alt="${escapeHtml(article.imageAlt || article.title)}"
                      fetchpriority="high"
                      decoding="async"
                      width="1400"
                      height="788"
                    >
                  `
                  : `
                    <div class="image-fallback">
                      <span>TRENDRADER</span>
                    </div>
                  `
              }

            </div>

            <div class="image-shade"></div>

            <div class="lead-index">
              <span>01</span>
              <i></i>
              <span>LEAD STORY</span>
            </div>

            <span class="lead-arrow">
              ${arrowSvg()}
            </span>

          </div>

          <div class="lead-content">

            <div class="story-category">
              <span>${escapeHtml(article.tag || article.category || "News")}</span>
              <i></i>
              <span>${escapeHtml(formatDate(article.date, true))}</span>
            </div>

            <h2>
              ${escapeHtml(article.title)}
            </h2>

            ${
              article.desc
                ? `
                  <p>
                    ${escapeHtml(article.desc)}
                  </p>
                `
                : ""
            }

            <div class="story-byline">
              <span>${escapeHtml(article.author || "TrendRader Editorial")}</span>
              <span class="byline-line"></span>
              <span>${readTime(article)} min read</span>
            </div>

          </div>

        </a>

      </article>
    `;

    attachImageFallbacks(
      mount
    );

    observeReveals(
      mount
    );
  }


  /* =========================================================
     LATEST STORIES
     ========================================================= */

  function renderLatest(articles) {
    const grid = $(
      "#latestGrid"
    );

    if (!grid) {
      return;
    }

    if (!articles.length) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = articles
      .slice(0, 6)
      .map((article, index) =>
        storyCard(
          article,
          index
        )
      )
      .join("");

    attachImageFallbacks(
      grid
    );

    observeReveals(
      grid
    );
  }


  /* =========================================================
     TICKER
     ========================================================= */

  function renderTicker(articles) {
    const ticker = $(
      "#liveTicker"
    );

    const track = $(
      "#tickerTrack"
    );

    if (
      !ticker ||
      !track ||
      !articles.length
    ) {
      if (ticker) {
        ticker.hidden = true;
      }

      return;
    }

    const items = articles
      .slice(0, 8);

    const content = items
      .map((article) => `
        <a href="${escapeHtml(articleUrl(article))}">
          ${escapeHtml(article.title)}
        </a>
        <i>•</i>
      `)
      .join("");

    track.innerHTML = `
      <div class="ticker-content">
        ${content}
      </div>

      <div class="ticker-content" aria-hidden="true">
        ${content}
      </div>
    `;

    ticker.hidden = false;
  }


  /* =========================================================
     HOME PAGE INITIALIZATION
     ========================================================= */

  async function initHomePage() {
    if (
      state.initializedHome
    ) {
      return;
    }

    state.initializedHome = true;

    const feedStatus = $(
      "#feedStatus"
    );

    try {
      if (feedStatus) {
        feedStatus.textContent =
          "Loading published stories...";

        feedStatus.dataset.state =
          "loading";
      }

      const payload =
        await fetchJson(
          articleDatabaseUrl()
        );

      const raw =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload.articles)
            ? payload.articles
            : Array.isArray(payload.items)
              ? payload.items
              : [];

      const articles =
        sortArticles(
          raw
            .map(normalizeArticle)
            .filter(isPublished)
        );

      state.articles = articles;
      state.filtered = articles;

      if (!articles.length) {
        showGlobalEmptyState();

        if (feedStatus) {
          feedStatus.textContent =
            "No published stories";

          feedStatus.dataset.state =
            "error";
        }

        return;
      }

      hideGlobalEmptyState();

      const todayLabel = $(
        "#todayLabel"
      );

      if (todayLabel) {
        todayLabel.textContent =
          new Intl.DateTimeFormat(
            "en-NG",
            {
              weekday:"long"
            }
          ).format(
            new Date()
          ).toUpperCase();
      }

      const heroDate = $(
        "#heroDate"
      );

      if (heroDate) {
        heroDate.textContent =
          `${articles.length} published ${
            articles.length === 1
              ? "story"
              : "stories"
          }`;
      }

      if (feedStatus) {
        feedStatus.textContent =
          `${articles.length} ${
            articles.length === 1
              ? "story"
              : "stories"
          } published`;

        feedStatus.dataset.state =
          "live";
      }

      renderLeadStory(
        articles[0]
      );

      renderLatest(
        articles
      );

      renderTicker(
        articles
      );

      state.categoryArticles =
        buildCategoryBuckets(
          articles
        );

      Object.entries(
        state.categoryArticles
      ).forEach(
        ([key, categoryArticles]) => {
          mountCategorySection(
            key,
            categoryArticles
          );
        }
      );

      attachImageFallbacks();

      observeReveals();

      setupSearchData(
        articles
      );

    } catch (error) {

      console.error(
        "TrendRader homepage feed failed:",
        error
      );

      if (feedStatus) {
        feedStatus.textContent =
          "Published feed unavailable";

        feedStatus.dataset.state =
          "error";
      }

      showGlobalEmptyState(
        true
      );
    }
  }


  /* =========================================================
     EMPTY STATE
     ========================================================= */

  function showGlobalEmptyState(feedError = false) {
    const empty = $(
      "#emptyState"
    );

    if (!empty) {
      return;
    }

    empty.hidden = false;

    const heading = $(
      "h2",
      empty
    );

    const paragraph = $(
      "p",
      empty
    );

    if (feedError) {
      if (heading) {
        heading.textContent =
          "The news desk is temporarily unavailable.";
      }

      if (paragraph) {
        paragraph.textContent =
          "Published stories could not be loaded right now. Please try again shortly.";
      }
    }
  }

  function hideGlobalEmptyState() {
    const empty = $(
      "#emptyState"
    );

    if (empty) {
      empty.hidden = true;
    }
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  let searchArticles = [];

  function setupSearchData(articles) {
    searchArticles = articles;
  }

  function setupSearch() {
    const toggle = $(
      "#searchToggle"
    );

    const panel = $(
      "#searchPanel"
    );

    const input = $(
      "#searchInput"
    );

    const form = $(
      "#searchForm"
    );

    if (
      !toggle ||
      !panel
    ) {
      return;
    }

    const close = () => {
      panel.classList.remove(
        "open"
      );

      panel.setAttribute(
        "aria-hidden",
        "true"
      );

      toggle.setAttribute(
        "aria-expanded",
        "false"
      );
    };

    const open = () => {
      panel.classList.add(
        "open"
      );

      panel.setAttribute(
        "aria-hidden",
        "false"
      );

      toggle.setAttribute(
        "aria-expanded",
        "true"
      );

      window.setTimeout(
        () => input?.focus(),
        120
      );
    };

    toggle.addEventListener(
      "click",
      () => {
        const isOpen =
          panel.classList.contains(
            "open"
          );

        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    );

    form?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const query =
          String(
            input?.value ||
            ""
          ).trim().toLowerCase();

        if (!query) {
          input?.focus();
          return;
        }

        const match =
          searchArticles.find(
            (article) => {
              const haystack = `
                ${article.title}
                ${article.desc}
                ${article.category}
                ${article.tag}
              `.toLowerCase();

              return haystack.includes(
                query
              );
            }
          );

        if (match) {
          location.href =
            articleUrl(match);

          return;
        }

        if (input) {
          input.value = "";

          input.placeholder =
            "No matching story found";
        }
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          close();
        }
      }
    );
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  function setupNavigation() {
    const menuToggle = $(
      "#menuToggle"
    );

    const mobileNav = $(
      "#mobileNav"
    );

    if (
      !menuToggle ||
      !mobileNav
    ) {
      return;
    }

    menuToggle.addEventListener(
      "click",
      () => {
        const open =
          mobileNav.classList.toggle(
            "open"
          );

        menuToggle.classList.toggle(
          "menu-open",
          open
        );

        menuToggle.setAttribute(
          "aria-expanded",
          String(open)
        );

        menuToggle.setAttribute(
          "aria-label",
          open
            ? "Close menu"
            : "Open menu"
        );
      }
    );

    $$(".mobile-nav a")
      .forEach(
        (link) => {
          link.addEventListener(
            "click",
            () => {
              mobileNav.classList.remove(
                "open"
              );

              menuToggle.classList.remove(
                "menu-open"
              );

              menuToggle.setAttribute(
                "aria-expanded",
                "false"
              );

              menuToggle.setAttribute(
                "aria-label",
                "Open menu"
              );
            }
          );
        }
      );
  }


  /* =========================================================
     SCROLL
     ========================================================= */

  function setupScroll() {
    const progress = $(
      "#progressBar"
    );

    const header = $(
      "#siteHeader"
    );

    const update = () => {
      const max =
        document.documentElement
          .scrollHeight -
        window.innerHeight;

      if (progress) {
        progress.style.width =
          `${
            max > 0
              ? (
                  window.scrollY /
                  max
                ) * 100
              : 0
          }%`;
      }

      header?.classList.toggle(
        "scrolled",
        window.scrollY > 12
      );
    };

    window.addEventListener(
      "scroll",
      update,
      {
        passive:true
      }
    );

    update();
  }


  /* =========================================================
     NEWSLETTER
     ========================================================= */

  function setupNewsletter() {
    const form = $(
      "#newsletterForm"
    );

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const email = $(
          "#newsletterEmail"
        );

        const message = $(
          "#newsletterMessage"
        );

        if (
          !email ||
          !email.validity.valid
        ) {
          email?.focus();
          return;
        }

        email.value = "";

        if (message) {
          message.textContent =
            "You're on the list. Welcome to TrendRader.";
        }
      }
    );
  }


  /* =========================================================
     CURSOR GLOW
     ========================================================= */

  function setupCursor() {
    const glow = $(
      ".cursor-glow"
    );

    if (
      !glow ||
      reducedMotion ||
      !window.matchMedia(
        "(hover:hover)"
      ).matches
    ) {
      return;
    }

    let visible = false;

    window.addEventListener(
      "pointermove",
      (event) => {
        glow.style.left =
          `${event.clientX}px`;

        glow.style.top =
          `${event.clientY}px`;

        if (!visible) {
          visible = true;
          glow.style.opacity = "1";
        }
      },
      {
        passive:true
      }
    );

    window.addEventListener(
      "pointerleave",
      () => {
        glow.style.opacity = "0";
        visible = false;
      }
    );
  }


  /* =========================================================
     REVEALS
     ========================================================= */

  function observeReveals(root = document) {
    if (
      reducedMotion ||
      !("IntersectionObserver" in window)
    ) {
      $$(".reveal", root).forEach(
        (element) => {
          element.classList.add(
            "visible"
          );
        }
      );

      return;
    }

    document.documentElement.classList.add(
      "js-reveal-enabled"
    );

    const observer =
      new IntersectionObserver(
        (entries) => {
          entries.forEach(
            (entry) => {
              if (
                entry.isIntersecting
              ) {
                entry.target.classList.add(
                  "visible"
                );

                observer.unobserve(
                  entry.target
                );
              }
            }
          );
        },
        {
          threshold:.08,
          rootMargin:
            "0px 0px -30px"
        }
      );

    $$(".reveal", root)
      .forEach(
        (element, index) => {
          element.style.transitionDelay =
            `${Math.min(
              index * 35,
              180
            )}ms`;

          observer.observe(
            element
          );
        }
      );
  }


  /* =========================================================
     GENERIC JSON FETCH
     ========================================================= */

  async function fetchJson(path) {
    const response =
      await fetch(
        path,
        {
          cache:"no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        `${path} returned ${response.status}`
      );
    }

    return response.json();
  }


  /* =========================================================
     ARTICLE PAGE SUPPORT
     ========================================================= */

  function safeBodyHtml(html) {
    const template =
      document.createElement(
        "template"
      );

    template.innerHTML =
      String(html || "");

    template.content
      .querySelectorAll(
        "script,style,object,embed,form"
      )
      .forEach(
        (node) => node.remove()
      );

    template.content
      .querySelectorAll(
        "[onload],[onclick],[onerror],[onmouseover]"
      )
      .forEach(
        (node) => {
          [...node.attributes]
            .forEach(
              (attr) => {
                if (
                  /^on/i.test(
                    attr.name
                  )
                ) {
                  node.removeAttribute(
                    attr.name
                  );
                }
              }
            );
        }
      );

    return template.innerHTML;
  }

  function inlineFormat(
    value,
    attributes = {}
  ) {
    let text =
      escapeHtml(value);

    if (attributes.bold) {
      text =
        `<strong>${text}</strong>`;
    }

    if (attributes.italic) {
      text =
        `<em>${text}</em>`;
    }

    if (attributes.underline) {
      text =
        `<u>${text}</u>`;
    }

    if (attributes.strike) {
      text =
        `<s>${text}</s>`;
    }

    if (attributes.link) {
      text =
        `<a href="${escapeHtml(attributes.link)}" rel="noopener noreferrer">${text}</a>`;
    }

    return text;
  }

  function quillDeltaToHtml(delta) {
    if (
      !delta ||
      !Array.isArray(delta.ops)
    ) {
      return "";
    }

    let html = "";
    let line = "";
    let listType = null;

    const closeList = () => {
      if (listType) {
        html += `</${listType}>`;
        listType = null;
      }
    };

    delta.ops.forEach(
      (op) => {
        const insert =
          op.insert;

        if (
          typeof insert === "object" &&
          insert.image
        ) {
          line += `
            <img
              src="${escapeHtml(insert.image)}"
              alt="TrendRader article image"
              loading="lazy"
            >
          `;

          return;
        }

        if (
          typeof insert !== "string"
        ) {
          return;
        }

        const lines =
          insert.split("\n");

        lines.forEach(
          (part, index) => {
            if (part) {
              line += inlineFormat(
                part,
                op.attributes || {}
              );
            }

            if (
              index ===
              lines.length - 1
            ) {
              return;
            }

            const attrs =
              op.attributes || {};

            const block =
              attrs.header
                ? `h${Math.min(
                    3,
                    Math.max(
                      2,
                      Number(
                        attrs.header
                      )
                    )
                  )}`
                : attrs.blockquote
                  ? "blockquote"
                  : attrs.list === "ordered"
                    ? "ol"
                    : attrs.list === "bullet"
                      ? "ul"
                      : null;

            if (
              block === "ol" ||
              block === "ul"
            ) {
              if (
                listType !==
                block
              ) {
                closeList();
                listType =
                  block;
                html += `<${block}>`;
              }

              html += `<li>${line}</li>`;
            } else {
              closeList();

              if (
                block ===
                "blockquote"
              ) {
                html +=
                  `<blockquote><p>${line}</p></blockquote>`;
              } else if (
                block
              ) {
                html +=
                  `<${block}>${line}</${block}>`;
              } else if (
                line.trim()
              ) {
                html +=
                  `<p>${line}</p>`;
              }
            }

            line = "";
          }
        );
      }
    );

    closeList();

    if (line.trim()) {
      html += `<p>${line}</p>`;
    }

    return html;
  }

  function getServerRenderedArticle(
    slug = ""
  ) {
    const title =
      String(
        $(".article-title")?.textContent ||
        ""
      ).trim();

    const description =
      String(
        $(".article-dek")?.textContent ||
        ""
      ).trim();

    const image =
      String(
        $("#heroImage")?.getAttribute("src") ||
        ""
      ).trim();

    const imageAlt =
      String(
        $("#heroImage")?.getAttribute("alt") ||
        title
      ).trim();

    const category =
      String(
        $(".article-kicker > span:last-child")?.textContent ||
        "News"
      ).trim();

    const tag =
      String(
        $(".kicker-label")?.textContent ||
        "News Report"
      ).trim();

    const author =
      String(
        $(".author strong")?.textContent ||
        "TrendRader Editorial"
      ).trim();

    const canonical =
      String(
        $('link[rel="canonical"]')?.getAttribute("href") ||
        ""
      ).trim();

    const canonicalSlug =
      slug ||
      canonical
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(
          /\.html$/i,
          ""
        ) ||
      "";

    const body =
      $("#articleBody");

    const bodyHtml =
      body
        ? body.innerHTML.trim()
        : "";

    const hasBodyContent =
      Boolean(
        bodyHtml &&
        bodyHtml
          .replace(
            /<[^>]*>/g,
            " "
          )
          .replace(
            /&nbsp;/g,
            " "
          )
          .trim()
          .length > 20 &&
        !/^\{\{ARTICLE_BODY\}\}$/.test(
          bodyHtml
        )
      );

    if (
      !title ||
      !canonicalSlug
    ) {
      return null;
    }

    return normalizeArticle({
      title,
      desc:description,
      image,
      imageAlt,
      category,
      tag,
      author,
      slug:canonicalSlug,
      url:
        canonical ||
        `${BASE_SITE}/articles/${canonicalSlug}.html`,
      date:
        $('meta[name="date"]')
          ?.getAttribute("content") ||
        "",
      modified:
        $('meta[name="last-modified"]')
          ?.getAttribute("content") ||
        "",
      bodyHtml:
        hasBodyContent
          ? bodyHtml
          : ""
    });
  }

  async function resolveArticle() {
    const runtime =
      $("#articleRuntimeData");

    const rawRuntime =
      runtime
        ?.textContent
        ?.trim() ||
      "";

    const slug =
      getSlugFromLocation();

    const serverArticle =
      getServerRenderedArticle(
        slug
      );

    const hasPublishedMarkup =
      Boolean(
        serverArticle
      );

    let runtimeArticle =
      null;

    if (
      rawRuntime &&
      !/^\{\{/.test(
        rawRuntime
      )
    ) {
      try {
        const parsed =
          JSON.parse(
            rawRuntime
          );

        if (
          parsed &&
          typeof parsed === "object" &&
          parsed.title
        ) {
          runtimeArticle =
            normalizeArticle(
              parsed
            );

          if (runtimeArticle) {
            runtimeArticle.slug =
              runtimeArticle.slug ||
              slug;

            runtimeArticle.url =
              parsed.url ||
              runtimeArticle.url;

            runtimeArticle.category =
              String(
                parsed.categoryLabel ||
                parsed.category ||
                runtimeArticle.category ||
                "News"
              ).trim();
          }
        }
      } catch (error) {
        console.warn(
          "TrendRader runtime article data could not be parsed.",
          error
        );
      }
    }

    let articles = [];
    let databaseError = null;

    try {
      const payload =
        await fetchJson(
          articleDatabaseUrl()
        );

      const raw =
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload.articles)
            ? payload.articles
            : Array.isArray(payload.items)
              ? payload.items
              : [];

      articles =
        sortArticles(
          raw
            .map(normalizeArticle)
            .filter(isPublished)
        );

    } catch (error) {
      databaseError =
        error;

      console.warn(
        "TrendRader article database could not be loaded.",
        error
      );
    }

    let article = null;

    if (
      slug &&
      articles.length
    ) {
      article =
        articles.find(
          (item) =>
            item.slug === slug ||
            String(
              item.url || ""
            )
              .replace(
                /\/$/,
                ""
              )
              .endsWith(
                `${slug}.html`
              )
        ) || null;
    }

    if (
      !article &&
      runtimeArticle
    ) {
      article =
        runtimeArticle;
    }

    if (
      !article &&
      serverArticle
    ) {
      article =
        serverArticle;
    }

    if (
      !article &&
      articles.length &&
      !slug
    ) {
      article =
        articles[0];
    }

    if (!article) {
      if (databaseError) {
        throw new Error(
          `Published article data could not be loaded. ${databaseError.message}`
        );
      }

      throw new Error(
        "No published TrendRader article matches this URL."
      );
    }

    let bodyHtml = "";

    const existingBody =
      $("#articleBody");

    const existingBodyHtml =
      existingBody
        ? existingBody.innerHTML.trim()
        : "";

    const existingBodyIsReal =
      Boolean(
        existingBodyHtml &&
        existingBodyHtml
          .replace(
            /<[^>]*>/g,
            " "
          )
          .replace(
            /&nbsp;/g,
            " "
          )
          .trim()
          .length > 20 &&
        !/^\{\{ARTICLE_BODY\}\}$/.test(
          existingBodyHtml
        )
      );

    if (
      article.bodyHtml ||
      article.content ||
      article.body
    ) {
      bodyHtml =
        safeBodyHtml(
          article.bodyHtml ||
          article.content ||
          article.body
        );

    } else if (
      existingBodyIsReal
    ) {
      bodyHtml =
        safeBodyHtml(
          existingBodyHtml
        );

    } else if (
      article.delta
    ) {
      try {
        const deltaPath =
          article.delta.startsWith("http")
            ? article.delta
            : new URL(
                `${siteRootPrefix()}${article.delta.replace(/^\.\//, "")}`,
                location.href
              ).href;

        const delta =
          await fetchJson(
            deltaPath
          );

        bodyHtml =
          quillDeltaToHtml(
            delta
          );

      } catch (error) {
        console.warn(
          "TrendRader article delta could not be loaded.",
          error
        );
      }
    }

    return {
      article,
      articles,
      bodyHtml,
      rawRuntime,
      source:
        runtimeArticle
          ? "runtime"
          : serverArticle
            ? "server"
            : "feed",
      databaseError
    };
  }

  function hydrateArticlePage(
    resolved
  ) {
    if (!resolved) {
      return;
    }

    const {
      article,
      articles,
      bodyHtml
    } = resolved;

    const title =
      article.title;

    const description =
      article.desc;

    const image =
      article.image;

    const category =
      article.category;

    const tag =
      article.tag;

    const author =
      article.author;

    const read =
      readTime(
        article,
        bodyHtml.replace(
          /<[^>]+>/g,
          " "
        )
      );

    const canonical =
      article.url &&
      /^https?:\/\//i.test(
        article.url
      )
        ? article.url
        : article.url
          ? `${BASE_SITE}/${article.url.replace(/^\//, "")}`
          : `${BASE_SITE}/articles/${article.slug}.html`;

    document.title =
      `${article.seoTitle || title} — TrendRader`;

    setMeta(
      'meta[name="description"]',
      description
    );

    setMeta(
      'meta[name="author"]',
      author
    );

    setMeta(
      'meta[property="og:title"]',
      article.seoTitle || title
    );

    setMeta(
      'meta[property="og:description"]',
      description
    );

    setMeta(
      'meta[property="og:url"]',
      canonical
    );

    setMeta(
      'meta[property="og:image"]',
      image
    );

    setMeta(
      'meta[name="twitter:title"]',
      article.seoTitle || title
    );

    setMeta(
      'meta[name="twitter:description"]',
      description
    );

    setMeta(
      'meta[name="twitter:image"]',
      image
    );

    setCanonical(
      canonical
    );

    const replacements = {
      ".kicker-label":tag,
      ".article-kicker > span:last-child":category,
      ".article-title":title,
      ".article-dek":description,
      ".author strong":author,
      ".meta-item strong":null
    };

    Object.entries(
      replacements
    ).forEach(
      ([selector, value]) => {
        const el =
          $(selector);

        if (
          el &&
          value !== null
        ) {
          el.textContent =
            value;
        }
      }
    );

    const dateEl =
      $$(".meta-item strong")[0];

    if (dateEl) {
      dateEl.textContent =
        formatDate(
          article.date
        );
    }

    const readEl =
      $$(".meta-item strong")[1];

    if (readEl) {
      readEl.textContent =
        `${read} min`;
    }

    const hero =
      $("#heroImage");

    if (
      hero &&
      image
    ) {
      hero.src =
        image;

      hero.alt =
        String(
          article.imageAlt ||
          title
        );

      hero.removeAttribute(
        "data-template-image"
      );
    }

    if (
      !image &&
      hero
    ) {
      hero.remove();
    }

    const body =
      $("#articleBody");

    if (
      body &&
      bodyHtml
    ) {
      const tags =
        $("#articleTags");

      body.innerHTML =
        bodyHtml;

      if (tags) {
        body.appendChild(
          tags
        );
      }
    }

    const initials =
      author
        .split(/\s+/)
        .filter(Boolean)
        .map(
          (part) =>
            part[0]
        )
        .join("")
        .slice(0,2)
        .toUpperCase() ||
      "T";

    [
      "#authorAvatar",
      "#authorAvatarLarge"
    ].forEach(
      (selector) => {
        const el =
          $(selector);

        if (el) {
          el.textContent =
            initials;
        }
      }
    );

    const authorName =
      $("#authorName");

    if (authorName) {
      authorName.textContent =
        author;
    }

    const authorBio =
      $("#authorBio");

    if (
      authorBio &&
      article.authorBio
    ) {
      authorBio.textContent =
        article.authorBio;
    }

    const tagsEl =
      $("#articleTags");

    const keywords =
      Array.isArray(
        article.keywords
      )
        ? article.keywords
        : String(
            article.keywords ||
            ""
          )
            .split(",")
            .map(
              (item) =>
                item.trim()
            )
            .filter(Boolean);

    if (
      tagsEl &&
      keywords.length
    ) {
      tagsEl.innerHTML =
        `<span>Topics</span>${
          keywords
            .slice(0,8)
            .map(
              (keyword) =>
                `<a href="../index.html#latest">${escapeHtml(keyword)}</a>`
            )
            .join("")
        }`;
    }

    buildOutline();

    renderRelated(
      articles,
      article
    );

    updateSchemaFallback(
      article,
      canonical,
      read
    );

    if (
      slug &&
      !location.pathname.endsWith(
        `${slug}.html`
      )
    ) {
      history.replaceState(
        null,
        "",
        `?slug=${encodeURIComponent(slug)}`
      );
    }
  }

  function buildOutline() {
    const outline =
      $("#storyOutline");

    const body =
      $("#articleBody");

    if (
      !outline ||
      !body
    ) {
      return;
    }

    const headings =
      $$(
        "h2,h3",
        body
      );

    outline.innerHTML =
      headings
        .slice(0,6)
        .map(
          (heading, index) => {
            if (!heading.id) {
              heading.id =
                `section-${index + 1}`;
            }

            return `
              <a href="#${escapeHtml(heading.id)}">
                <span>${String(index + 1).padStart(2,"0")}</span>
                ${escapeHtml(heading.textContent)}
              </a>
            `;
          }
        )
        .join("");

    if (!headings.length) {
      outline.innerHTML =
        `<span class="outline-empty">Published story</span>`;
    }
  }

  function renderRelated(
    articles,
    current
  ) {
    const grid =
      $("#relatedGrid");

    if (!grid) {
      return;
    }

    const candidates =
      articles.filter(
        (article) =>
          article.slug !==
          current.slug &&
          article.title
      );

    const currentTokens =
      new Set(
        `
          ${current.title}
          ${current.desc}
          ${current.category}
          ${current.tag}
        `
          .toLowerCase()
          .match(
            /[a-z0-9]{4,}/g
          ) || []
      );

    const related =
      candidates
        .map(
          (article) => {
            const tokens =
              `
                ${article.title}
                ${article.desc}
                ${article.category}
                ${article.tag}
              `
                .toLowerCase()
                .match(
                  /[a-z0-9]{4,}/g
                ) || [];

            const overlap =
              tokens.reduce(
                (
                  score,
                  token
                ) =>
                  score +
                  (
                    currentTokens.has(
                      token
                    )
                      ? 1
                      : 0
                  ),
                0
              );

            const sameCategory =
              article.category.toLowerCase() ===
              current.category.toLowerCase()
                ? 4
                : 0;

            return {
              article,
              score:
                overlap +
                sameCategory
            };
          }
        )
        .sort(
          (a,b) =>
            b.score -
              a.score ||
            new Date(
              b.article.date
            ) -
            new Date(
              a.article.date
            )
        )
        .slice(0,3)
        .map(
          (item) =>
            item.article
        );

    grid.innerHTML =
      related
        .map(
          (article, index) => {
            const image =
              article.image
                ? `
                  <img
                    src="${escapeHtml(article.image)}"
                    alt="${escapeHtml(article.title)}"
                    loading="lazy"
                    width="1000"
                    height="625"
                  >
                `
                : "";

            return `
              <a
                class="related-card reveal"
                href="${escapeHtml(articleUrl(article))}"
              >

                <div class="related-image">
                  ${image}
                  <span>
                    ${String(index + 1).padStart(2,"0")}
                  </span>
                </div>

                <div class="related-meta">
                  <span>${escapeHtml(article.tag)}</span>
                  <i></i>
                  <span>${readTime(article)} min</span>
                </div>

                <h3>
                  ${escapeHtml(article.title)}
                </h3>

                <div class="related-arrow">
                  ${externalArrowSvg()}
                </div>

              </a>
            `;
          }
        )
        .join("");

    attachImageFallbacks(
      grid
    );

    observeReveals(
      grid
    );
  }

  function updateSchemaFallback(
    article,
    canonical,
    read
  ) {
    const existing =
      $$(
        'script[type="application/ld+json"]'
      );

    const unresolved =
      existing.some(
        (node) =>
          /\{\{/.test(
            node.textContent || ""
          )
      );

    if (!unresolved) {
      return;
    }

    existing.forEach(
      (node) =>
        node.remove()
    );

    const schema = {
      "@context":"https://schema.org",
      "@type":"NewsArticle",
      "headline":article.title,
      "description":article.desc,
      "url":canonical,
      "datePublished":article.date,
      "dateModified":
        article.modified ||
        article.date,
      "author":{
        "@type":"Organization",
        "name":
          article.author ||
          "TrendRader Editorial"
      },
      "publisher":{
        "@type":"Organization",
        "name":"TrendRader",
        "url":BASE_SITE,
        "logo":{
          "@type":"ImageObject",
          "url":
            `${BASE_SITE}/assets/logo.svg`
        }
      },
      "image":
        article.image
          ? [article.image]
          : [],
      "articleSection":
        article.category,
      "keywords":
        Array.isArray(
          article.keywords
        )
          ? article.keywords.join(", ")
          : String(
              article.keywords ||
              ""
            ),
      "mainEntityOfPage":{
        "@type":"WebPage",
        "@id":canonical
      },
      "isAccessibleForFree":
        true,
      "timeRequired":
        `PT${read}M`
    };

    const script =
      document.createElement(
        "script"
      );

    script.type =
      "application/ld+json";

    script.textContent =
      JSON.stringify(
        schema
      );

    document.head.appendChild(
      script
    );
  }


  /* =========================================================
     PAGE DETECTION
     ========================================================= */

  function isHomePage() {
    return Boolean(
      $("#latestGrid") &&
      $("#leadStoryMount")
    );
  }

  function isArticlePage() {
    return Boolean(
      $("#articleBody") ||
      $(".article-title") ||
      $("#articleRuntimeData")
    );
  }


  /* =========================================================
     INIT
     ========================================================= */

  async function init() {

    setupNavigation();
    setupSearch();
    setupScroll();
    setupNewsletter();
    setupCursor();

    const footerYear =
      $("#footerYear");

    if (footerYear) {
      footerYear.textContent =
        new Date()
          .getFullYear();
    }

    if (isHomePage()) {
      await initHomePage();
    }

    if (isArticlePage()) {
      try {
        const resolved =
          await resolveArticle();

        if (resolved) {
          try {
            hydrateArticlePage(
              resolved
            );
          } catch (error) {
            console.error(
              "TrendRader article hydration failed:",
              error
            );

            const body =
              $("#articleBody");

            const hasRealBody =
              Boolean(
                body &&
                body.innerHTML
                  .replace(
                    /<[^>]*>/g,
                    " "
                  )
                  .replace(
                    /&nbsp;/g,
                    " "
                  )
                  .trim()
                  .length > 20
              );

            if (!hasRealBody) {
              setMeta(
                'meta[name="robots"]',
                "noindex, follow"
              );

              if (body) {
                body.innerHTML = `
                  <div class="article-load-error">
                    <p>
                      This article is temporarily unavailable.
                    </p>

                    <a href="../index.html">
                      Return to TrendRader
                    </a>
                  </div>
                `;
              }
            }
          }
        }

      } catch (error) {

        console.error(
          "TrendRader article load failed:",
          error
        );

        const body =
          $("#articleBody");

        const hasRealBody =
          Boolean(
            body &&
            body.innerHTML
              .replace(
                /<[^>]*>/g,
                " "
              )
              .replace(
                /&nbsp;/g,
                " "
              )
              .trim()
              .length > 20
          );

        if (!hasRealBody) {
          document.title =
            "TrendRader — Article";

          setMeta(
            'meta[name="robots"]',
            "noindex, follow"
          );

          if (body) {
            body.innerHTML = `
              <div class="article-load-error">
                <p>
                  This article is temporarily unavailable.
                </p>

                <a href="../index.html">
                  Return to TrendRader
                </a>
              </div>
            `;
          }
        }
      }
    }

    observeReveals();
  }

  init();

})();