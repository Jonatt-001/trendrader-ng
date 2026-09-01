(() => {
  "use strict";

  const BASE_SITE = "https://trendrader.space";
  const DB_PATH = "./assets/articles.json";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { articles: [], filtered: [] };
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
  const normalizePath = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
    return `./${raw.replace(/^\.\//, "")}`;
  };
  const articleUrl = (article) => {
    const explicit = String(article.url || "").trim();
    if (explicit && explicit !== "#" && !/^index\.html$/i.test(explicit)) return normalizePath(explicit);
    const slug = String(article.slug || "").trim();
    return slug ? `./articles/${encodeURIComponent(slug)}.html` : "#";
  };
  const title = (a) => String(a?.title || a?.headline || "").trim();
  const description = (a) => String(a?.desc || a?.description || a?.excerpt || a?.dek || "").trim();
  const image = (a) => String(a?.image || a?.imageUrl || a?.featuredImage || "").trim();
  const category = (a) => String(a?.category || a?.meta || "News").trim();
  const tag = (a) => String(a?.tag || a?.contentType || "News").trim();
  const author = (a) => String(a?.author || "TrendRader Editorial").trim();
  const date = (a) => a?.date || a?.publishedAt || a?.datePublished || a?.createdAt || "";
  const isPublished = (a) => {
    if (!a || !title(a)) return false;
    const status = String(a.status || a.state || "").toLowerCase();
    if (["draft","unpublished","archived","deleted"].includes(status)) return false;
    if (a.page && String(a.page).toLowerCase() !== "news") return false;
    return Boolean(a.url || a.slug);
  };
  const sortArticles = (items) => [...items].sort((a,b) => new Date(date(b) || 0) - new Date(date(a) || 0));
  const formatDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Recently published" : new Intl.DateTimeFormat("en-NG", {day:"numeric",month:"short",year:"numeric"}).format(d);
  };
  const relativeDate = (value) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Recently";
    const diff = Math.max(0, Date.now() - d.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return formatDate(value);
  };
  const readTime = (a) => {
    const n = Number(a?.readTime);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 4;
  };

  function imageMarkup(article, className, eager = false) {
    const src = image(article);
    if (!src) return `<div class="${className} image-fallback" aria-hidden="true"><span>TrendRader</span></div>`;
    return `<div class="${className}"><img src="${escapeHtml(src)}" alt="${escapeHtml(article.imageAlt || title(article))}" width="1200" height="675" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
  }

  function cardMarkup(article, index) {
    return `<article class="story-card reveal"><a href="${escapeHtml(articleUrl(article))}" aria-label="Read: ${escapeHtml(title(article))}">
      ${imageMarkup(article, "story-image")}
      <div class="story-info"><span>${escapeHtml(category(article))}</span><i></i><time datetime="${escapeHtml(date(article))}">${escapeHtml(relativeDate(date(article)))}</time></div>
      <h3>${escapeHtml(title(article))}</h3>
      ${description(article) ? `<p>${escapeHtml(description(article))}</p>` : ""}
    </a></article>`;
  }

  function categoryCardMarkup(article) {
    return `<article class="category-card reveal"><a href="${escapeHtml(articleUrl(article))}" aria-label="Read: ${escapeHtml(title(article))}">
      ${imageMarkup(article, "category-image")}
      <div class="story-info"><span>${escapeHtml(category(article))}</span><i></i><time datetime="${escapeHtml(date(article))}">${escapeHtml(relativeDate(date(article)))}</time></div>
      <h3>${escapeHtml(title(article))}</h3>
      ${description(article) ? `<p>${escapeHtml(description(article))}</p>` : ""}
    </a></article>`;
  }

  function renderLead(article) {
    const mount = $("#leadStoryMount");
    if (!mount || !article) return;
    mount.hidden = false;
    mount.innerHTML = `<a class="lead-story" href="${escapeHtml(articleUrl(article))}" aria-label="Read featured story: ${escapeHtml(title(article))}">
      <div class="lead-image">${imageMarkup(article, "lead-image", true).replace('class="lead-image"','class="lead-image-inner"')}<div class="image-shade"></div><div class="lead-index"><span>01</span><i></i><span>${escapeHtml(tag(article))}</span></div><div class="lead-arrow" aria-hidden="true">↗</div></div>
      <div class="lead-content"><div class="story-category"><span>${escapeHtml(category(article))}</span><i></i><span>LEAD</span></div><h2>${escapeHtml(title(article))}</h2>${description(article) ? `<p>${escapeHtml(description(article))}</p>` : ""}<div class="story-byline"><span>By ${escapeHtml(author(article))}</span><span class="byline-line"></span><span>${readTime(article)} min read</span></div></div>
    </a>`;
  }

  function renderTicker(items) {
    const ticker = $("#liveTicker"), track = $("#tickerTrack");
    if (!ticker || !track) return;
    const live = items.slice(0, 6);
    if (live.length < 2) { ticker.hidden = true; return; }
    const links = live.map(a => `<a href="${escapeHtml(articleUrl(a))}">${escapeHtml(title(a))}</a><i>•</i>`).join("");
    track.innerHTML = `<div class="ticker-content">${links}</div><div class="ticker-content" aria-hidden="true">${links}</div>`;
    ticker.hidden = false;
  }

  function renderLatest(items = state.articles) {
    const grid = $("#latestGrid");
    if (!grid) return;
    grid.innerHTML = items.slice(0, 12).map(cardMarkup).join("");
    if (!items.length) grid.innerHTML = `<div class="feed-empty"><strong>No published stories match this search.</strong><span>Try another topic or return to the latest feed.</span></div>`;
    observeReveals(grid);
  }

  function renderCategory(id, wanted, limit = 3) {
    const grid = $(`#${id}`), section = grid?.closest("[data-category]");
    if (!grid || !section) return;
    const target = wanted.toLowerCase();
    const matches = state.articles.filter(a => {
      const values = [category(a), a.subcategory || "", a.meta || "", a.categoryLabel || ""].map(v => String(v).toLowerCase());
      return values.some(v => v === target || v.split(/[\s/>&]+/).includes(target));
    }).slice(0, limit);
    section.hidden = !matches.length;
    if (matches.length) { grid.innerHTML = matches.map(categoryCardMarkup).join(""); observeReveals(grid); }
  }

  function renderTechnology() {
    const grid = $("#technologyGrid"), section = $("#technology");
    if (!grid || !section) return;
    const matches = state.articles.filter(a => category(a).toLowerCase() === "technology").slice(0,4);
    section.hidden = !matches.length;
    if (!matches.length) return;
    grid.innerHTML = matches.map(a => `<a class="dark-card reveal" href="${escapeHtml(articleUrl(a))}">${imageMarkup(a,"",false)}<div><div class="story-info"><span>${escapeHtml(tag(a))}</span><i></i><time>${escapeHtml(relativeDate(date(a)))}</time></div><h3>${escapeHtml(title(a))}</h3></div></a>`).join("");
    observeReveals(grid);
  }

  function renderSearchResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) { state.filtered = state.articles; renderLatest(); $("#feedStatus").textContent = `${state.articles.length} published ${state.articles.length === 1 ? "story" : "stories"}`; return; }
    const matches = state.articles.filter(a => `${title(a)} ${description(a)} ${category(a)} ${tag(a)} ${author(a)} ${Array.isArray(a.keywords) ? a.keywords.join(' ') : a.keywords || ''}`.toLowerCase().includes(q));
    state.filtered = matches;
    $("#feedStatus").textContent = `${matches.length} result${matches.length === 1 ? "" : "s"} for "${query}"`;
    $("#latest")?.scrollIntoView({behavior:reducedMotion ? "auto" : "smooth", block:"start"});
    renderLatest(matches);
  }

  function observeReveals(root = document) {
    $$(".reveal", root).forEach(el => {
      el.classList.add("visible");
      if (reducedMotion) return;
      el.animate([{opacity:0, transform:"translateY(8px)"},{opacity:1, transform:"translateY(0)"}], {duration:420,easing:"cubic-bezier(.22,1,.36,1)",fill:"both"});
    });
  }

  function showFeedError(message) {
    const empty = $("#emptyState");
    const status = $("#feedStatus");
    if (empty) {
      empty.hidden = false;
      const h = $("h2", empty), p = $("p", empty);
      if (h) h.textContent = "The published feed is temporarily unavailable.";
      if (p) p.textContent = message || "TrendRader could not load its published article database.";
    }
    if (status) status.textContent = "Feed unavailable";
    $("#leadStoryMount")?.setAttribute("hidden", "");
  }

  async function loadPublishedArticles() {
    const status = $("#feedStatus");
    try {
      const response = await fetch(`${DB_PATH}?v=${Date.now()}`, {cache:"no-store", credentials:"same-origin"});
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}.`);
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
      $("#heroDate").textContent = `Updated ${formatDate(date(state.articles[0]))}`;
    } catch (error) {
      console.error("TrendRader feed failed:", error);
      showFeedError(error.message);
    }
  }

  function setupNavigation() {
    const menu = $("#menuToggle"), nav = $("#mobileNav");
    menu?.addEventListener("click", () => { const open = nav.classList.toggle("open"); menu.setAttribute("aria-expanded", String(open)); });
    $$(".mobile-nav a").forEach(link => link.addEventListener("click", () => { nav.classList.remove("open"); menu.setAttribute("aria-expanded","false"); }));
    const searchToggle = $("#searchToggle"), panel = $("#searchPanel"), input = $("#searchInput");
    searchToggle?.addEventListener("click", () => { const open = panel.classList.toggle("open"); panel.setAttribute("aria-hidden",String(!open)); searchToggle.setAttribute("aria-expanded",String(open)); if(open) setTimeout(()=>input?.focus(),120); });
    $("#searchForm")?.addEventListener("submit", e => { e.preventDefault(); renderSearchResults(input?.value || ""); });
  }

  function setupNewsletter() {
    $("#newsletterForm")?.addEventListener("submit", e => { e.preventDefault(); const input=$("#newsletterEmail"), message=$("#newsletterMessage"); if(!input?.validity.valid){input?.focus();return;} input.value=""; message.textContent="You're on the list. Welcome to TrendRader."; });
  }
  function setupScroll() { const header=$("#siteHeader"); window.addEventListener("scroll",()=>header?.classList.toggle("scrolled",window.scrollY>12),{passive:true}); }
  function setupCursor() { const glow=$(".cursor-glow"); if(!glow || reducedMotion || !matchMedia("(hover:hover)").matches)return; window.addEventListener("pointermove",e=>{glow.style.left=`${e.clientX}px`;glow.style.top=`${e.clientY}px`;glow.style.opacity="1";},{passive:true}); }
  function setupYear() { const y=$("#footerYear"); if(y)y.textContent=new Date().getFullYear(); const t=$("#todayLabel"); if(t)t.textContent=new Intl.DateTimeFormat("en-NG",{month:"long",year:"numeric"}).format(new Date()); }

  setupYear(); setupNavigation(); setupNewsletter(); setupScroll(); setupCursor(); loadPublishedArticles();
})();
