(() => {
  "use strict";

  const BASE_SITE = "https://trendrader.space";
  const DB_PATH = "./assets/articles.json";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    articles: [],
    filtered: [],
    searchQuery: "",
    loaded: false
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function siteRootPrefix() {
    return location.pathname.includes("/articles/") ? "../" : "./";
  }

  function articleDatabaseUrl() {
    return new URL(`${siteRootPrefix()}assets/articles.json`, location.href).href;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[char]));
  }

  function normalizeArticle(article) {
    const normalized = {
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
        article.title ||
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

    normalized.categoryKey = normalizeCategory(normalized.category);

    return normalized;
  }

  function normalizeCategory(value) {
    const category = String(value || "")
      .trim()
      .toLowerCase();

    if (
      category.includes("politic") ||
      category.includes("government") ||
      category.includes("election")
    ) {
      return "politics";
    }

    if (
      category.includes("tech") ||
      category.includes("ai") ||
      category.includes("science") ||
      category.includes("digital")
    ) {
      return "technology";
    }

    if (
      category.includes("business") ||
      category.includes("econom") ||
      category.includes("finance") ||
      category.includes("market")
    ) {
      return "business";
    }

    if (
      category.includes("entertain") ||
      category.includes("culture") ||
      category.includes("music") ||
      category.includes("movie") ||
      category.includes("celebr")
    ) {
      return "entertainment";
    }

    if (
      category.includes("sport") ||
      category.includes("football") ||
      category.includes("basketball") ||
      category.includes("athletics")
    ) {
      return "sports";
    }

    if (
      category.includes("trend") ||
      category.includes("viral") ||
      category.includes("buzz")
    ) {
      return "trending";
    }

    return category || "news";
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

    if (page && page !== "news") {
      return false;
    }

    return Boolean(
      article.title &&
      (article.slug || article.url)
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
      if (/^https?:\/\//i.test(article.url)) {
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

  function formatDate(value, options = {}) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Recently published";
    }

    return new Intl.DateTimeFormat(
      "en-NG",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...options
      }
    ).format(date);
  }

  function formatShortDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Latest";
    }

    return new Intl.DateTimeFormat(
      "en-NG",
      {
        day: "numeric",
        month: "short"
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

  function safeBodyHtml(html) {
    const template =
      document.createElement("template");

    template.innerHTML =
      String(html || "");

    template.content
      .querySelectorAll(
        "script,style,object,embed,form"
      )
      .forEach((node) => node.remove());

    template.content
      .querySelectorAll(
        "[onload],[onclick],[onerror],[onmouseover]"
      )
      .forEach((node) => {
        [...node.attributes].forEach(
          (attr) => {
            if (/^on/i.test(attr.name)) {
              node.removeAttribute(
                attr.name
              );
            }
          }
        );
      });

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

    delta.ops.forEach((op) => {
      const insert = op.insert;

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
                    Number(attrs.header)
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
              listType = block;
              html +=
                `<${block}>`;
            }

            html +=
              `<li>${line}</li>`;
          } else {
            closeList();

            if (
              block ===
              "blockquote"
            ) {
              html +=
                `<blockquote><p>${line}</p></blockquote>`;
            } else if (block) {
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
    });

    closeList();

    if (line.trim()) {
      html += `<p>${line}</p>`;
    }

    return html;
  }

  async function fetchJson(path) {
    const response =
      await fetch(
        path,
        {
          cache: "no-store",
          headers: {
            "Accept":
              "application/json"
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `${path} returned ${response.status}`
      );
    }

    return response.json();
  }

  function iconArrow() {
    return `
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M5 12h13"></path>
        <path d="m13 7 5 5-5 5"></path>
      </svg>
    `;
  }

  function safeImageMarkup(
    article,
    className,
    index = ""
  ) {
    const title =
      escapeHtml(
        article.imageAlt ||
        article.title
      );

    const number =
      index !== ""
        ? `
          <span class="image-number">
            ${String(index).padStart(2, "0")}
          </span>
        `
        : "";

    if (!article.image) {
      return `
        <div
          class="${className} image-fallback"
          aria-label="No image available"
        >
          <span>TRENDRADER</span>
          ${number}
        </div>
      `;
    }

    return `
      <div class="${className}">
        <img
          src="${escapeHtml(article.image)}"
          alt="${title}"
          loading="lazy"
          decoding="async"
          width="1200"
          height="750"
          onerror="this.closest('.${className.split(" ")[0]}')?.classList.add('image-load-failed');"
        >
        ${number}
      </div>
    `;
  }

  function renderLeadStory(article) {
    const mount =
      $("#leadStoryMount");

    if (!mount || !article) {
      return;
    }

    const url =
      articleUrl(article);

    mount.innerHTML = `
      <article
        class="lead-story reveal"
        data-reveal
      >
        <a
          href="${escapeHtml(url)}"
          aria-label="Read: ${escapeHtml(article.title)}"
        >

          <div class="lead-image">

            <div class="lead-image-inner">
              ${
                article.image
                  ? `
                    <img
                      src="${escapeHtml(article.image)}"
                      alt="${escapeHtml(article.imageAlt || article.title)}"
                      width="1400"
                      height="788"
                      fetchpriority="high"
                      decoding="async"
                    >
                  `
                  : `
                    <div
                      class="image-fallback"
                      style="width:100%;height:100%;display:grid;place-items:center"
                    >
                      <span>TRENDRADER</span>
                    </div>
                  `
              }
            </div>

            <div
              class="image-shade"
              aria-hidden="true"
            ></div>

            <div class="lead-index">
              <span>LEAD STORY</span>
              <i></i>
              <span>${escapeHtml(formatShortDate(article.date))}</span>
            </div>

            <div
              class="lead-arrow"
              aria-hidden="true"
            >
              ${iconArrow()}
            </div>

          </div>

          <div class="lead-content">

            <div class="story-category">
              <span>${escapeHtml(article.tag || article.category)}</span>
              <i></i>
              <span>${escapeHtml(article.category)}</span>
            </div>

            <h2>
              ${formatEditorialTitle(
                article.title
              )}
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
              <span>${escapeHtml(article.author)}</span>
              <span class="byline-line"></span>
              <span>${escapeHtml(formatDate(article.date))}</span>
            </div>

          </div>
        </a>
      </article>
    `;

    observeReveals(mount);
  }

  function formatEditorialTitle(title) {
    const safe =
      escapeHtml(title);

    const words =
      safe.split(/\s+/);

    if (words.length < 7) {
      return safe;
    }

    const splitAt =
      Math.max(
        3,
        Math.floor(
          words.length * 0.62
        )
      );

    const first =
      words.slice(0, splitAt).join(" ");

    const second =
      words.slice(splitAt).join(" ");

    return `
      ${first}
      <em>${second}</em>
    `;
  }

  function renderStoryCard(
    article,
    index = 0
  ) {
    const url =
      articleUrl(article);

    return `
      <article class="story-card reveal">

        <a
          href="${escapeHtml(url)}"
          aria-label="Read: ${escapeHtml(article.title)}"
        >

          ${safeImageMarkup(
            article,
            "story-image",
            index + 1
          )}

          <div class="story-info">
            <span>${escapeHtml(article.tag || article.category)}</span>
            <i></i>
            <span>${escapeHtml(article.category)}</span>
          </div>

          <h3>
            ${escapeHtml(article.title)}
          </h3>

          ${
            article.desc
              ? `
                <p>
                  ${escapeHtml(
                    truncate(
                      article.desc,
                      150
                    )
                  )}
                </p>
              `
              : ""
          }

        </a>
      </article>
    `;
  }

  function renderCategoryCard(
    article,
    index = 0
  ) {
    const url =
      articleUrl(article);

    return `
      <article class="category-card reveal">

        <a
          href="${escapeHtml(url)}"
          aria-label="Read: ${escapeHtml(article.title)}"
        >

          ${safeImageMarkup(
            article,
            "category-image",
            index + 1
          )}

          <div>

            <div class="story-info">
              <span>${escapeHtml(article.tag || article.category)}</span>
              <i></i>
              <span>${escapeHtml(formatShortDate(article.date))}</span>
            </div>

            <h3>
              ${escapeHtml(article.title)}
            </h3>

            ${
              article.desc
                ? `
                  <p>
                    ${escapeHtml(
                      truncate(
                        article.desc,
                        125
                      )
                    )}
                  </p>
                `
                : ""
            }

          </div>

        </a>

      </article>
    `;
  }

  function renderDarkCard(
    article,
    index = 0
  ) {
    const url =
      articleUrl(article);

    return `
      <article class="dark-card reveal">

        <a
          href="${escapeHtml(url)}"
          aria-label="Read: ${escapeHtml(article.title)}"
          style="display:contents"
        >

          <div>
            ${
              article.image
                ? `
                  <img
                    src="${escapeHtml(article.image)}"
                    alt="${escapeHtml(article.imageAlt || article.title)}"
                    loading="lazy"
                    decoding="async"
                    width="500"
                    height="500"
                  >
                `
                : `
                  <div
                    class="image-fallback"
                    style="width:100%;height:100%;display:grid;place-items:center"
                  >
                    <span>TRENDRADER</span>
                  </div>
                `
            }
          </div>

          <div>

            <div class="story-info">
              <span>${escapeHtml(article.tag || article.category)}</span>
              <i></i>
              <span>${escapeHtml(formatShortDate(article.date))}</span>
            </div>

            <h3>
              ${escapeHtml(article.title)}
            </h3>

          </div>

        </a>

      </article>
    `;
  }

  function renderEmptyGrid(
    grid,
    title = "No stories here yet."
  ) {
    if (!grid) {
      return;
    }

    grid.innerHTML = `
      <div class="feed-empty">
        <strong>${escapeHtml(title)}</strong>
        <span>
          Published stories will appear here automatically.
        </span>
      </div>
    `;
  }

  function categoryMatches(
    article,
    category
  ) {
    const key =
      normalizeCategory(
        article.category
      );

    if (key === category) {
      return true;
    }

    const tag =
      normalizeCategory(
        article.tag
      );

    return tag === category;
  }

  function renderLatest(
    articles
  ) {
    const grid =
      $("#latestGrid");

    if (!grid) {
      return;
    }

    const latest =
      articles.slice(0, 7);

    if (!latest.length) {
      renderEmptyGrid(
        grid,
        "No published stories yet."
      );
      return;
    }

    grid.innerHTML =
      latest
        .map(
          (article, index) =>
            renderStoryCard(
              article,
              index
            )
        )
        .join("");

    observeReveals(grid);
  }

  function renderCategory(
    category,
    articles,
    limit = 3
  ) {
    const grid =
      $(`#${category}Grid`);

    if (!grid) {
      return;
    }

    const items =
      articles
        .filter(
          (article) =>
            categoryMatches(
              article,
              category
            )
        )
        .slice(0, limit);

    if (!items.length) {
      renderEmptyGrid(
        grid,
        `No ${categoryLabel(category)} stories yet.`
      );
      return;
    }

    if (category === "technology") {
      grid.innerHTML =
        items
          .map(
            (article, index) =>
              renderDarkCard(
                article,
                index
              )
          )
          .join("");
    } else {
      grid.innerHTML =
        items
          .map(
            (article, index) =>
              renderCategoryCard(
                article,
                index
              )
          )
          .join("");
    }

    observeReveals(grid);
  }

  function categoryLabel(
    category
  ) {
    const labels = {
      politics:"politics",
      technology:"technology",
      business:"business",
      entertainment:"entertainment",
      sports:"sports",
      trending:"trending"
    };

    return (
      labels[category] ||
      "news"
    );
  }

  function deriveTrending(
    articles
  ) {
    const explicit =
      articles.filter(
        (article) =>
          categoryMatches(
            article,
            "trending"
          )
      );

    if (explicit.length >= 3) {
      return explicit;
    }

    return [...articles]
      .sort(
        (a, b) =>
          Number(b.views || b.engagement || 0) -
            Number(a.views || a.engagement || 0) ||
          new Date(b.date || 0) -
            new Date(a.date || 0)
      )
      .slice(0, 3);
  }

  function renderHomepage(
    articles
  ) {
    const published =
      sortArticles(
        articles
          .map(normalizeArticle)
          .filter(isPublished)
      );

    state.articles =
      published;

    state.filtered =
      published;

    state.loaded = true;

    const empty =
      $("#emptyState");

    if (!published.length) {
      if (empty) {
        empty.hidden = false;
      }

      renderLatest([]);
      renderCategory(
        "politics",
        []
      );
      renderCategory(
        "technology",
        []
      );
      renderCategory(
        "business",
        []
      );
      renderCategory(
        "entertainment",
        []
      );
      renderCategory(
        "sports",
        []
      );
      renderCategory(
        "trending",
        []
      );

      updateFeedStatus(
        "No published stories",
        "error"
      );

      return;
    }

    if (empty) {
      empty.hidden = true;
    }

    renderLeadStory(
      published[0]
    );

    renderLatest(
      published
    );

    renderCategory(
      "politics",
      published
    );

    renderCategory(
      "technology",
      published
    );

    renderCategory(
      "business",
      published
    );

    renderCategory(
      "entertainment",
      published
    );

    renderCategory(
      "sports",
      published
    );

    const trending =
      deriveTrending(
        published
      );

    renderCategory(
      "trending",
      trending
    );

    renderTicker(
      published
    );

    updateHomepageMeta(
      published
    );

    updateFeedStatus(
      `${published.length} published ${published.length === 1 ? "story" : "stories"}`,
      "live"
    );

    setupImageFallbacks();
  }

  function updateHomepageMeta(
    articles
  ) {
    const latest =
      articles[0];

    const heroDate =
      $("#heroDate");

    if (heroDate && latest) {
      heroDate.textContent =
        `Updated ${formatDate(latest.date)}`;
    }

    const today =
      $("#todayLabel");

    if (today) {
      today.textContent =
        new Intl.DateTimeFormat(
          "en-NG",
          {
            weekday:"long",
            day:"numeric",
            month:"short"
          }
        ).format(
          new Date()
        ).toUpperCase();
    }
  }

  function updateFeedStatus(
    text,
    stateName = ""
  ) {
    const status =
      $("#feedStatus");

    if (!status) {
      return;
    }

    status.textContent =
      text;

    if (stateName) {
      status.dataset.state =
        stateName;
    } else {
      delete status.dataset.state;
    }
  }

  function renderTicker(
    articles
  ) {
    const ticker =
      $("#liveTicker");

    const track =
      $("#tickerTrack");

    if (
      !ticker ||
      !track ||
      !articles.length
    ) {
      return;
    }

    const items =
      articles
        .slice(0, 8)
        .map(
          (article) => `
            <a href="${escapeHtml(articleUrl(article))}">
              ${escapeHtml(article.title)}
            </a>
            <i>/</i>
          `
        )
        .join("");

    track.innerHTML = `
      <div class="ticker-content">
        ${items}
      </div>

      <div
        class="ticker-content"
        aria-hidden="true"
      >
        ${items}
      </div>
    `;

    ticker.hidden = false;

    if (reducedMotion) {
      $$(".ticker-content").forEach(
        (element) => {
          element.style.animation =
            "none";
        }
      );
    }
  }

  function truncate(
    value,
    max
  ) {
    const text =
      String(value || "")
        .trim();

    if (
      text.length <= max
    ) {
      return text;
    }

    return `${text
      .slice(0, max)
      .replace(/\s+\S*$/, "")}…`;
  }

  function setupImageFallbacks() {
    $$("img").forEach(
      (image) => {
        image.addEventListener(
          "error",
          () => {
            const wrapper =
              image.closest(
                ".story-image,.category-image,.lead-image-inner,.dark-card > div:first-child"
              );

            if (!wrapper) {
              return;
            }

            wrapper.classList.add(
              "image-fallback"
            );

            image.remove();

            if (
              !wrapper.querySelector(
                "span"
              )
            ) {
              const label =
                document.createElement(
                  "span"
                );

              label.textContent =
                "TRENDRADER";

              wrapper.appendChild(
                label
              );
            }
          },
          {
            once:true
          }
        );
      }
    );
  }

  function setupNavigation() {
    const menuToggle =
      $("#menuToggle");

    const mobileNav =
      $("#mobileNav");

    if (
      menuToggle &&
      mobileNav
    ) {
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

          document.body.classList.toggle(
            "menu-active",
            open
          );
        }
      );
    }

    $$(".mobile-nav a").forEach(
      (link) => {
        link.addEventListener(
          "click",
          () => {
            mobileNav?.classList.remove(
              "open"
            );

            menuToggle?.classList.remove(
              "menu-open"
            );

            menuToggle?.setAttribute(
              "aria-expanded",
              "false"
            );

            menuToggle?.setAttribute(
              "aria-label",
              "Open menu"
            );

            document.body.classList.remove(
              "menu-active"
            );
          }
        );
      }
    );
  }

  function setupSearch() {
    const toggle =
      $("#searchToggle");

    const panel =
      $("#searchPanel");

    const input =
      $("#searchInput");

    const form =
      $("#searchForm");

    if (
      !toggle ||
      !panel
    ) {
      return;
    }

    const closeSearch =
      () => {
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

        toggle.setAttribute(
          "aria-label",
          "Open search"
        );

        document.body.classList.remove(
          "search-active"
        );
      };

    const openSearch =
      () => {
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

        toggle.setAttribute(
          "aria-label",
          "Close search"
        );

        document.body.classList.add(
          "search-active"
        );

        window.setTimeout(
          () => input?.focus(),
          120
        );
      };

    toggle.addEventListener(
      "click",
      () => {
        const open =
          panel.classList.contains(
            "open"
          );

        if (open) {
          closeSearch();
        } else {
          openSearch();
        }
      }
    );

    form?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const query =
          String(
            input?.value || ""
          ).trim();

        if (!query) {
          input?.focus();
          return;
        }

        const url =
          new URL(
            location.href
          );

        url.searchParams.set(
          "q",
          query
        );

        closeSearch();

        if (
          location.pathname.includes(
            "/articles/"
          )
        ) {
          location.href =
            `${siteRootPrefix()}index.html?q=${encodeURIComponent(query)}#latest`;

          return;
        }

        history.replaceState(
          null,
          "",
          url
        );

        applySearch(
          query
        );

        document
          .getElementById(
            "latest"
          )
          ?.scrollIntoView({
            behavior:
              reducedMotion
                ? "auto"
                : "smooth"
          });
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          closeSearch();

          const mobileNav =
            $("#mobileNav");

          const menuToggle =
            $("#menuToggle");

          mobileNav?.classList.remove(
            "open"
          );

          menuToggle?.classList.remove(
            "menu-open"
          );

          menuToggle?.setAttribute(
            "aria-expanded",
            "false"
          );

          document.body.classList.remove(
            "menu-active"
          );
        }

        if (
          (event.metaKey ||
            event.ctrlKey) &&
          event.key.toLowerCase() ===
            "k"
        ) {
          event.preventDefault();
          openSearch();
        }
      }
    );

    const params =
      new URLSearchParams(
        location.search
      );

    const query =
      params.get("q");

    if (
      query &&
      input
    ) {
      input.value =
        query;

      window.setTimeout(
        () => {
          if (
            state.loaded
          ) {
            applySearch(
              query
            );
          }
        },
        50
      );
    }
  }

  function applySearch(
    query
  ) {
    const normalized =
      String(query || "")
        .trim()
        .toLowerCase();

    state.searchQuery =
      normalized;

    if (!normalized) {
      state.filtered =
        state.articles;

      renderLatest(
        state.articles
      );

      updateFeedStatus(
        `${state.articles.length} published stories`,
        "live"
      );

      return;
    }

    const tokens =
      normalized
        .split(/\s+/)
        .filter(Boolean);

    const results =
      state.articles.filter(
        (article) => {
          const haystack =
            [
              article.title,
              article.desc,
              article.category,
              article.tag,
              article.author
            ]
              .join(" ")
              .toLowerCase();

          return tokens.every(
            (token) =>
              haystack.includes(token)
          );
        }
      );

    state.filtered =
      results;

    const grid =
      $("#latestGrid");

    if (grid) {
      if (!results.length) {
        grid.innerHTML = `
          <div class="feed-empty">
            <strong>
              No results for "${escapeHtml(query)}".
            </strong>

            <span>
              Try a different keyword or browse the latest stories.
            </span>
          </div>
        `;
      } else {
        grid.innerHTML =
          results
            .slice(0, 12)
            .map(
              (article, index) =>
                renderStoryCard(
                  article,
                  index
                )
            )
            .join("");

        observeReveals(
          grid
        );
      }
    }

    updateFeedStatus(
      `${results.length} ${results.length === 1 ? "result" : "results"} for "${query}"`,
      results.length
        ? "live"
        : "error"
    );
  }

  function setupScroll() {
    const progress =
      $("#progressBar");

    const header =
      $("#siteHeader");

    const update =
      () => {
        const max =
          document.documentElement
            .scrollHeight -
          window.innerHeight;

        if (progress) {
          progress.style.width =
            `${max > 0
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    (window.scrollY /
                      max) *
                      100
                  )
                )
              : 0}%`;
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

  function setupNewsletter() {
    const form =
      $("#newsletterForm");

    if (!form) {
      return;
    }

    form.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const email =
          $("#newsletterEmail");

        const message =
          $("#newsletterMessage");

        if (
          !email ||
          !email.validity.valid
        ) {
          email?.focus();
          return;
        }

        email.value =
          "";

        if (message) {
          message.textContent =
            "You're on the list. Welcome to TrendRader.";
        }
      }
    );
  }

  function setupCursor() {
    const glow =
      $(".cursor-glow");

    if (
      !glow ||
      reducedMotion ||
      !window.matchMedia(
        "(hover:hover)"
      ).matches
    ) {
      return;
    }

    let visible =
      false;

    window.addEventListener(
      "pointermove",
      (event) => {
        glow.style.left =
          `${event.clientX}px`;

        glow.style.top =
          `${event.clientY}px`;

        if (!visible) {
          visible = true;
          glow.style.opacity =
            "1";
        }
      },
      {
        passive:true
      }
    );

    window.addEventListener(
      "pointerleave",
      () => {
        glow.style.opacity =
          "0";
        visible = false;
      }
    );
  }

  function observeReveals(
    root = document
  ) {
    const elements =
      $$(".reveal", root);

    if (!elements.length) {
      return;
    }

    if (
      reducedMotion ||
      !("IntersectionObserver" in window)
    ) {
      elements.forEach(
        (element) =>
          element.classList.add(
            "visible"
          )
      );

      return;
    }

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
            "0px 0px -35px"
        }
      );

    elements.forEach(
      (element, index) => {
        element.style.transitionDelay =
          `${Math.min(
            index * 35,
            210
          )}ms`;

        observer.observe(
          element
        );
      }
    );
  }

  function isArticlePage() {
    return Boolean(
      $("#articleBody") ||
      $(".article-title")
    );
  }

  function getServerRenderedArticle(
    slug = ""
  ) {
    const title =
      String(
        $(".article-title")
          ?.textContent ||
          ""
      ).trim();

    const description =
      String(
        $(".article-dek")
          ?.textContent ||
          ""
      ).trim();

    const image =
      String(
        $("#heroImage")
          ?.getAttribute("src") ||
          ""
      ).trim();

    const imageAlt =
      String(
        $("#heroImage")
          ?.getAttribute("alt") ||
          title
      ).trim();

    const category =
      String(
        $(".article-kicker > span:last-child")
          ?.textContent ||
          "News"
      ).trim();

    const tag =
      String(
        $(".kicker-label")
          ?.textContent ||
          "News Report"
      ).trim();

    const author =
      String(
        $(".author strong")
          ?.textContent ||
          "TrendRader Editorial"
      ).trim();

    const canonical =
      String(
        $('link[rel="canonical"]')
          ?.getAttribute("href") ||
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
          typeof parsed ===
            "object" &&
          parsed.title
        ) {
          runtimeArticle =
            normalizeArticle(
              parsed
            );

          if (
            runtimeArticle
          ) {
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
    let databaseError =
      null;

    try {
      const payload =
        await fetchJson(
          articleDatabaseUrl()
        );

      const raw =
        Array.isArray(payload)
          ? payload
          : Array.isArray(
              payload.articles
            )
              ? payload.articles
              : Array.isArray(
                  payload.items
                )
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

    let article =
      null;

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
        ) ||
        null;
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

    let bodyHtml =
      "";

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
          article.delta.startsWith(
            "http"
          )
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
      databaseError,
      hasPublishedMarkup
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
      article.seoTitle ||
        title
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
      article.seoTitle ||
        title
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
        `
          <span>Topics</span>
          ${keywords
            .slice(0,8)
            .map(
              (keyword) =>
                `<a href="${siteRootPrefix()}index.html#latest">${escapeHtml(keyword)}</a>`
            )
            .join("")}
        `;
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
                <span>
                  ${String(
                    index + 1
                  ).padStart(2,"0")}
                </span>
                ${escapeHtml(
                  heading.textContent
                )}
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
        `${current.title} ${current.desc} ${current.category} ${current.tag}`
          .toLowerCase()
          .match(
            /[a-z0-9]{4,}/g
          ) ||
          []
      );

    const related =
      candidates
        .map(
          (article) => {
            const tokens =
              `${article.title} ${article.desc} ${article.category} ${article.tag}`
                .toLowerCase()
                .match(
                  /[a-z0-9]{4,}/g
                ) ||
                [];

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
              article.category
                .toLowerCase() ===
              current.category
                .toLowerCase()
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
          (article,index) => {
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
                    ${String(
                      index + 1
                    ).padStart(2,"0")}
                  </span>
                </div>

                <div class="related-meta">
                  <span>
                    ${escapeHtml(article.tag)}
                  </span>

                  <i></i>

                  <span>
                    ${readTime(article)} min
                  </span>
                </div>

                <h3>
                  ${escapeHtml(article.title)}
                </h3>

                <div class="related-arrow">
                  ${iconArrow()}
                </div>

              </a>
            `;
          }
        )
        .join("");

    observeReveals(
      grid
    );

    setupImageFallbacks();
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
            node.textContent ||
            ""
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
      "@context":
        "https://schema.org",

      "@type":
        "NewsArticle",

      "headline":
        article.title,

      "description":
        article.desc,

      "url":
        canonical,

      "datePublished":
        article.date,

      "dateModified":
        article.modified ||
        article.date,

      "author":{
        "@type":
          "Organization",
        "name":
          article.author ||
          "TrendRader Editorial"
      },

      "publisher":{
        "@type":
          "Organization",
        "name":
          "TrendRader",
        "url":
          BASE_SITE,
        "logo":{
          "@type":
            "ImageObject",
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
          ? article.keywords.join(
              ", "
            )
          : String(
              article.keywords ||
              ""
            ),

      "mainEntityOfPage":{
        "@type":
          "WebPage",
        "@id":
          canonical
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

  async function initHomepage() {
    try {
      updateFeedStatus(
        "Loading published stories...",
        "loading"
      );

      const payload =
        await fetchJson(
          articleDatabaseUrl()
        );

      const raw =
        Array.isArray(payload)
          ? payload
          : Array.isArray(
              payload.articles
            )
              ? payload.articles
              : Array.isArray(
                  payload.items
                )
                ? payload.items
                : [];

      renderHomepage(
        raw
      );
    } catch (error) {
      console.error(
        "TrendRader homepage feed failed:",
        error
      );

      updateFeedStatus(
        "Feed temporarily unavailable",
        "error"
      );

      const empty =
        $("#emptyState");

      if (empty) {
        empty.hidden =
          false;

        const heading =
          empty.querySelector(
            "h2"
          );

        const paragraph =
          empty.querySelector(
            "p"
          );

        if (heading) {
          heading.textContent =
            "The news desk is reconnecting.";
        }

        if (paragraph) {
          paragraph.textContent =
            "Published stories could not be loaded right now. The page will remain available while the editorial feed recovers.";
        }
      }

      [
        "#latestGrid",
        "#politicsGrid",
        "#technologyGrid",
        "#businessGrid",
        "#entertainmentGrid",
        "#sportsGrid",
        "#trendingGrid"
      ].forEach(
        (selector) => {
          const grid =
            $(selector);

          if (grid) {
            renderEmptyGrid(
              grid,
              "Stories temporarily unavailable."
            );
          }
        }
      );
    }
  }

  async function initArticle() {
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
              body.innerHTML =
                `
                  <div class="article-load-error">
                    <p>
                      This article is temporarily unavailable.
                    </p>
                    <a href="${siteRootPrefix()}index.html">
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
          body.innerHTML =
            `
              <div class="article-load-error">
                <p>
                  This article is temporarily unavailable.
                </p>

                <a href="${siteRootPrefix()}index.html">
                  Return to TrendRader
                </a>
              </div>
            `;
        }
      }
    }
  }

  function setupArticleUtilities() {
    setupShare();
    setupLightbox();
  }

  function setupShare() {
    const modal =
      $("#shareModal");

    if (!modal) {
      return;
    }

    const open =
      () => {
        modal.classList.add(
          "open"
        );

        modal.setAttribute(
          "aria-hidden",
          "false"
        );
      };

    const close =
      () => {
        modal.classList.remove(
          "open"
        );

        modal.setAttribute(
          "aria-hidden",
          "true"
        );
      };

    $("#shareTop")
      ?.addEventListener(
        "click",
        open
      );

    $("#shareRail")
      ?.addEventListener(
        "click",
        open
      );

    $("#closeShare")
      ?.addEventListener(
        "click",
        close
      );

    $("#shareBackdrop")
      ?.addEventListener(
        "click",
        close
      );

    $$("[data-share]")
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            async () => {
              const type =
                button.dataset.share;

              const url =
                location.href;

              const title =
                document.title;

              if (
                type ===
                "copy"
              ) {
                try {
                  await navigator
                    .clipboard
                    .writeText(
                      url
                    );

                  const message =
                    $("#shareMessage");

                  if (message) {
                    message.textContent =
                      "Link copied to clipboard.";
                  }
                } catch {
                  const message =
                    $("#shareMessage");

                  if (message) {
                    message.textContent =
                      url;
                  }
                }

                return;
              }

              const target =
                type === "x"
                  ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
                  : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

              window.open(
                target,
                "share",
                "width=700,height=600,noopener,noreferrer"
              );
            }
          );
        }
      );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          close();
        }
      }
    );
  }

  function setupLightbox() {
    const lightbox =
      $("#lightbox");

    const image =
      $("#heroImage");

    if (
      !lightbox ||
      !image
    ) {
      return;
    }

    $("#expandImage")
      ?.addEventListener(
        "click",
        () => {
          if (!image.src) {
            return;
          }

          const target =
            $("#lightboxImage");

          if (target) {
            target.src =
              image.src;

            target.alt =
              image.alt;
          }

          lightbox.classList.add(
            "open"
          );

          lightbox.setAttribute(
            "aria-hidden",
            "false"
          );
        }
      );

    const close =
      () => {
        lightbox.classList.remove(
          "open"
        );

        lightbox.setAttribute(
          "aria-hidden",
          "true"
        );
      };

    $("#closeLightbox")
      ?.addEventListener(
        "click",
        close
      );

    lightbox.addEventListener(
      "click",
      (event) => {
        if (
          event.target ===
          lightbox
        ) {
          close();
        }
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          close();
        }
      }
    );
  }

  async function init() {
    setupNavigation();
    setupSearch();
    setupScroll();
    setupNewsletter();
    setupCursor();
    setupArticleUtilities();

    const footerYear =
      $("#footerYear");

    if (footerYear) {
      footerYear.textContent =
        String(
          new Date().getFullYear()
        );
    }

    if (isArticlePage()) {
      await initArticle();
    } else {
      await initHomepage();
    }

    observeReveals();
    setupImageFallbacks();
  }

  init();
})();