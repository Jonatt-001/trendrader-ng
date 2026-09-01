const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const state = { articles: [], filtered: [] };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

function normalizePath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return `./${raw.replace(/^\.\//, "")}`;
}

function articleUrl(article) {
  const explicit = String(article.url || article.page || "").trim();
  if (explicit && explicit !== "#" && explicit.toLowerCase() !== "index.html") return normalizePath(explicit);
  const slug = String(article.slug || "").trim();
  return slug ? `./articles/${encodeURIComponent(slug)}.html` : "./article.html";
}

function articleTitle(article) {
  return String(article.title || article.headline || "").trim();
}

function articleDescription(article) {
  return String(article.desc || article.description || article.excerpt || article.dek || "").trim();
}

function articleImage(article) {
  return String(article.image || article.imageUrl || article.featuredImage || article.featured_image || "").trim();
}

function articleCategory(article) {
  return String(article.category || article.meta || "News").trim();
}

function articleTag(article) {
  return String(article.tag || article.contentType || "News").trim();
}

function articleAuthor(article) {
  return String(article.author || "TrendRader Editorial").trim();
}

function articleDate(article) {
  return article.date || article.publishedAt || article.datePublished || article.createdAt || "";
}

function isPublished(article) {
  const status = String(article.status || article.state || "").trim().toLowerCase();
  if (status && ["draft","unpublished","archived","deleted"].includes(status)) return false;
  const page = String(article.page || "").trim().toLowerCase();
  if (page && page !== "news") return false;
  return Boolean(articleTitle(article) && (article.url || article.slug));
}

function sortArticles(items) {
  return [...items].sort((a,b) => new Date(articleDate(b) || 0) - new Date(articleDate(a) || 0));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return new Intl.DateTimeFormat("en-NG", { day:"numeric", month:"short", year:"numeric" }).format(date);
}

function relativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

function readTime(article) {
  const value = Number(article.readTime);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 4;
}

function imageMarkup(article, className = "", eager = false) {
  const image = articleImage(article);
  if (!image) {
    return `<div class="${className} image-fallback" aria-label="TrendRader story image unavailable"><span>TrendRader</span></div>`;
  }
  return `<div class="${className}"><img src="${escapeHtml(image)}" alt="${escapeHtml(articleTitle(article))}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} width="1200" height="675"></div>`;
}

function cardMarkup(article, index) {
  const title = escapeHtml(articleTitle(article));
  const desc = escapeHtml(articleDescription(article));
  const category = escapeHtml(articleCategory(article));
  const url = escapeHtml(articleUrl(article));
  return `<article class="story-card reveal">
    <a href="${url}" aria-label="Read: ${title}">
      ${imageMarkup(article, "story-image")}
      <div class="story-info"><span>${category}</span><i></i><time datetime="${escapeHtml(articleDate(article))}">${escapeHtml(relativeDate(articleDate(article)))}</time></div>
      <h3>${title}</h3>
      ${desc ? `<p>${desc}</p>` : ""}
    </a>
  </article>`;
}

function categoryCardMarkup(article, index) {
  const title = escapeHtml(articleTitle(article));
  const desc = escapeHtml(articleDescription(article));
  const category = escapeHtml(articleCategory(article));
  const url = escapeHtml(articleUrl(article));
  return `<article class="category-card reveal">
    <a href="${url}" aria-label="Read: ${title}">
      ${imageMarkup(article, "category-image")}
      <div class="story-info"><span>${category}</span><i></i><time>${escapeHtml(relativeDate(articleDate(article)))}</time></div>
      <h3>${title}</h3>
      ${desc ? `<p>${desc}</p>` : ""}
    </a>
  </article>`;
}

function renderLead(article) {
  const mount = $("#leadStoryMount");
  if (!mount || !article) return;
  const title = escapeHtml(articleTitle(article));
  const desc = escapeHtml(articleDescription(article));
  const category = escapeHtml(articleCategory(article));
  const tag = escapeHtml(articleTag(article));
  const author = escapeHtml(articleAuthor(article));
  const url = escapeHtml(articleUrl(article));
  const image = articleImage(article);
  mount.innerHTML = `<a class="lead-story reveal" href="${url}" aria-label="Read featured story: ${title}">
    <div class="lead-image">
      ${image ? `<img src="${escapeHtml(image)}" alt="${title}" fetchpriority="high" width="1600" height="900">` : `<div class="image-fallback" aria-label="TrendRader featured story image unavailable"><span>TrendRader</span></div>`}
      <div class="image-shade"></div>
      <div class="lead-index"><span>01</span><i></i><span>${tag}</span></div>
      <div class="lead-arrow" aria-hidden="true">↗</div>
    </div>
    <div class="lead-content">
      <div class="story-category"><span>${category}</span><i></i><span>FEATURED</span></div>
      <h2>${title}</h2>
      ${desc ? `<p>${desc}</p>` : ""}
      <div class="story-byline"><span>By ${author}</span><span class="byline-line"></span><span>${readTime(article)} min read</span></div>
    </div>
  </a>`;
  observeReveals(mount);
}

function renderTicker(items) {
  const ticker = $("#liveTicker");
  const track = $("#tickerTrack");
  const live = items.slice(0, 6);
  if (!ticker || !track || live.length < 2) return;
  const links = live.map((item) => `<a href="${escapeHtml(articleUrl(item))}">${escapeHtml(articleTitle(item))}</a><i>•</i>`).join("");
  track.innerHTML = `<div class="ticker-content">${links}</div><div class="ticker-content" aria-hidden="true">${links}</div>`;
  ticker.hidden = false;
}

function renderCategory(id, category, limit = 3) {
  const grid = $(`#${id}`);
  const section = grid?.closest("[data-category]");
  if (!grid || !section) return;
  const matches = state.articles.filter((article) => articleCategory(article).toLowerCase() === category.toLowerCase()).slice(0, limit);
  if (!matches.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = matches.map(categoryCardMarkup).join("");
  observeReveals(grid);
}

function renderTechnology() {
  const grid = $("#technologyGrid");
  const section = $("#technology");
  if (!grid || !section) return;
  const matches = state.articles.filter((article) => articleCategory(article).toLowerCase() === "technology").slice(0, 4);
  if (!matches.length) { section.hidden = true; return; }
  section.hidden = false;
  grid.innerHTML = matches.map((article) => {
    const title = escapeHtml(articleTitle(article));
    const url = escapeHtml(articleUrl(article));
    return `<a class="dark-card reveal" href="${url}">
      ${imageMarkup(article, "")}
      <div><div class="story-info"><span>${escapeHtml(articleTag(article))}</span><i></i><time>${escapeHtml(relativeDate(articleDate(article)))}</time></div><h3>${title}</h3></div>
    </a>`;
  }).join("");
  observeReveals(grid);
}

function renderLatest(items = state.articles) {
  const grid = $("#latestGrid");
  if (!grid) return;
  const visible = items.slice(0, 9);
  grid.innerHTML = visible.map(cardMarkup).join("");
  observeReveals(grid);
}

function renderSearchResults(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    renderLatest(state.articles);
    $("#feedStatus").textContent = `${state.articles.length} published ${state.articles.length === 1 ? "story" : "stories"}`;
    return;
  }
  const matches = state.articles.filter((article) => {
    const haystack = [articleTitle(article), articleDescription(article), articleCategory(article), articleTag(article), articleAuthor(article)].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
  $("#latest").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  $("#feedStatus").textContent = `${matches.length} result${matches.length === 1 ? "" : "s"} for "${query}"`;
  renderLatest(matches);
}

function observeReveals(root = document) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px" });
  $$(".reveal", root).forEach((el, index) => {
    if (!reducedMotion) el.style.transitionDelay = `${Math.min(index * 35, 210)}ms`;
    observer.observe(el);
  });
}

async function loadPublishedArticles() {
  const status = $("#feedStatus");
  try {
    const response = await fetch("./assets/articles.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const payload = await response.json();
    const raw = Array.isArray(payload) ? payload : Array.isArray(payload.articles) ? payload.articles : Array.isArray(payload.items) ? payload.items : [];
    state.articles = sortArticles(raw.filter(isPublished));
    state.filtered = state.articles;

    if (!state.articles.length) {
      $("#emptyState").hidden = false;
      $("#leadStoryMount").hidden = true;
      if (status) status.textContent = "No published stories";
      return;
    }

    $("#emptyState").hidden = true;
    renderLead(state.articles[0]);
    renderLatest();
    renderTicker(state.articles);
    renderCategory("politicsGrid", "politics");
    renderTechnology();
    renderCategory("businessGrid", "business");
    renderCategory("entertainmentGrid", "entertainment");
    renderCategory("sportsGrid", "sports");
    renderCategory("trendingGrid", "trending");
    if (status) status.textContent = `${state.articles.length} published ${state.articles.length === 1 ? "story" : "stories"}`;
    const latest = state.articles[0];
    $("#heroDate").textContent = latest ? `Updated ${formatDate(articleDate(latest))}` : "Latest published stories";
  } catch (error) {
    console.error("TrendRader feed failed:", error);
    $("#emptyState").hidden = false;
    $("#emptyState h2").textContent = "The news feed is temporarily unavailable.";
    $("#emptyState p").textContent = "TrendRader could not load its published article database. Check the publication build and assets/articles.json.";
    if (status) status.textContent = "Feed unavailable";
  }
}

function setupNavigation() {
  const menuToggle = $("#menuToggle");
  const mobileNav = $("#mobileNav");
  menuToggle?.addEventListener("click", () => {
    const open = mobileNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  $$(".mobile-nav a").forEach((link) => link.addEventListener("click", () => {
    mobileNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));

  const searchToggle = $("#searchToggle");
  const searchPanel = $("#searchPanel");
  const searchInput = $("#searchInput");
  searchToggle?.addEventListener("click", () => {
    const open = searchPanel.classList.toggle("open");
    searchPanel.setAttribute("aria-hidden", String(!open));
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(() => searchInput?.focus(), 200);
  });
  $("#searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults(searchInput?.value || "");
  });
}

function setupNewsletter() {
  $("#newsletterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#newsletterEmail");
    const message = $("#newsletterMessage");
    if (!email?.validity.valid) { email?.focus(); return; }
    email.value = "";
    message.textContent = "You're on the list. Welcome to TrendRader.";
    message.style.color = "#e86150";
  });
}

function setupScroll() {
  const header = $("#siteHeader");
  window.addEventListener("scroll", () => header?.classList.toggle("scrolled", window.scrollY > 12), { passive: true });
}

function setupCursor() {
  const glow = $(".cursor-glow");
  if (!glow || reducedMotion || !window.matchMedia("(hover:hover)").matches) return;
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
}

$("#footerYear").textContent = new Date().getFullYear();
$("#todayLabel").textContent = new Intl.DateTimeFormat("en-NG", { month:"long", year:"numeric" }).format(new Date());
setupNavigation();
setupNewsletter();
setupScroll();
setupCursor();
loadPublishedArticles();
