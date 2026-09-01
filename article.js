const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const BASE_SITE = "https://trendrader.space";

function siteRootPrefix() {
  return location.pathname.includes("/articles/") ? "../" : "./";
}

function articleDatabaseUrl() {
  return new URL(`${siteRootPrefix()}assets/articles.json`, location.href).href;
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

function normalizeArticle(article) {
  return {
    ...article,
    title: String(article.title || article.headline || "").trim(),
    desc: String(article.desc || article.description || article.excerpt || article.dek || "").trim(),
    image: String(article.image || article.imageUrl || article.featuredImage || "").trim(),
    category: String(article.categoryLabel || article.category || article.meta || "News").trim(),
    tag: String(article.tag || article.contentType || "News").trim(),
    author: String(article.author || "TrendRader Editorial").trim(),
    date: article.date || article.publishedAt || article.datePublished || article.createdAt || "",
    slug: String(article.slug || "").trim(),
    url: String(article.url || article.page || "").trim(),
    delta: String(article.delta || "").trim(),
    modified: article.modified || article.dateModified || article.date || ""
  };
}

function isPublished(article) {
  const status = String(article.status || article.state || "").toLowerCase();
  const page = String(article.page || "").toLowerCase();
  if (["draft","unpublished","archived","deleted"].includes(status)) return false;
  if (page && page !== "news") return false;
  return Boolean(article.title && (article.slug || article.url));
}

function sortArticles(items) {
  return [...items].sort((a,b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function articleUrl(article) {
  if (article.url && article.url !== "#") {
    if (/^https?:\/\//i.test(article.url)) return article.url;
    const clean = article.url.replace(/^\.\//, "").replace(/^\//, "");
    return new URL(`${siteRootPrefix()}${clean}`, location.href).href;
  }
  return new URL(`${siteRootPrefix()}articles/${encodeURIComponent(article.slug)}.html`, location.href).href;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently published";
  return new Intl.DateTimeFormat("en-NG", { day:"numeric", month:"long", year:"numeric" }).format(date);
}

function readTime(article, bodyText = "") {
  const supplied = Number(article.readTime);
  if (Number.isFinite(supplied) && supplied > 0) return Math.round(supplied);
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200) || 1);
}

function setMeta(selector, content) {
  const el = $(selector);
  if (el && content) el.setAttribute("content", content);
}

function setCanonical(url) {
  const canonical = $('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", url);
}

function getSlugFromLocation() {
  const query = new URLSearchParams(location.search).get("slug");
  if (query) return decodeURIComponent(query);
  const path = location.pathname.split("/").filter(Boolean);
  const file = path[path.length - 1] || "";
  if (file.endsWith(".html") && file !== "article.html") return file.replace(/\.html$/i, "");
  return "";
}

function safeBodyHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  template.content.querySelectorAll("script,style,object,embed,form").forEach((node) => node.remove());
  template.content.querySelectorAll("[onload],[onclick],[onerror],[onmouseover]").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      if (/^on/i.test(attr.name)) node.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}

function inlineFormat(value, attributes = {}) {
  let text = escapeHtml(value);
  if (attributes.bold) text = `<strong>${text}</strong>`;
  if (attributes.italic) text = `<em>${text}</em>`;
  if (attributes.underline) text = `<u>${text}</u>`;
  if (attributes.strike) text = `<s>${text}</s>`;
  if (attributes.link) text = `<a href="${escapeHtml(attributes.link)}" rel="noopener noreferrer">${text}</a>`;
  return text;
}

function quillDeltaToHtml(delta) {
  if (!delta || !Array.isArray(delta.ops)) return "";
  let html = "";
  let line = "";
  let listType = null;
  const closeList = () => {
    if (listType) { html += `</${listType}>`; listType = null; }
  };
  delta.ops.forEach((op) => {
    const insert = op.insert;
    if (typeof insert === "object" && insert.image) {
      line += `<img src="${escapeHtml(insert.image)}" alt="TrendRader article image" loading="lazy">`;
      return;
    }
    if (typeof insert !== "string") return;
    const lines = insert.split("\n");
    lines.forEach((part, index) => {
      if (part) line += inlineFormat(part, op.attributes || {});
      if (index === lines.length - 1) return;
      const attrs = op.attributes || {};
      const block = attrs.header ? `h${Math.min(3, Math.max(2, Number(attrs.header)))}`
        : attrs.blockquote ? "blockquote"
        : attrs.list === "ordered" ? "ol"
        : attrs.list === "bullet" ? "ul"
        : null;
      if (block === "ol" || block === "ul") {
        if (listType !== block) { closeList(); listType = block; html += `<${block}>`; }
        html += `<li>${line}</li>`;
      } else {
        closeList();
        if (block === "blockquote") html += `<blockquote><p>${line}</p></blockquote>`;
        else if (block) html += `<${block}>${line}</${block}>`;
        else if (line.trim()) html += `<p>${line}</p>`;
      }
      line = "";
    });
  });
  closeList();
  if (line.trim()) html += `<p>${line}</p>`;
  return html;
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

async function resolveArticle() {
  const runtime = $("#articleRuntimeData");
  const rawRuntime = runtime?.textContent?.trim() || "";
  const hasTemplateTokens = /\{\{[A-Z_]+\}\}/.test(document.documentElement.innerHTML);
  const slug = getSlugFromLocation();

  if (!hasTemplateTokens && !slug && !rawRuntime) return null;

  let runtimeArticle = null;
  if (rawRuntime && !/\{\{/.test(rawRuntime)) {
    try {
      const parsed = JSON.parse(rawRuntime);
      if (parsed && typeof parsed === "object" && parsed.title) {
        runtimeArticle = normalizeArticle(parsed);
        runtimeArticle.slug = runtimeArticle.slug || slug;
        runtimeArticle.url = parsed.url || runtimeArticle.url;
        runtimeArticle.category = String(parsed.categoryLabel || parsed.category || runtimeArticle.category || "News").trim();
      }
    } catch (error) {
      console.warn("TrendRader runtime article data could not be parsed.", error);
    }
  }

  let articles = [];
  let databaseError = null;
  try {
    const payload = await fetchJson(articleDatabaseUrl());
    const raw = Array.isArray(payload) ? payload : Array.isArray(payload.articles) ? payload.articles : Array.isArray(payload.items) ? payload.items : [];
    articles = sortArticles(raw.map(normalizeArticle).filter(isPublished));
  } catch (error) {
    databaseError = error;
    console.warn("TrendRader article database could not be loaded.", error);
  }

  let article = null;
  if (slug && articles.length) {
    article = articles.find((item) => item.slug === slug || item.url.replace(/\/$/, "").endsWith(`${slug}.html`)) || null;
  }
  if (!article && runtimeArticle) article = runtimeArticle;
  if (!article && articles.length && !slug) article = articles[0];
  if (!article) {
    if (databaseError) throw new Error(`Published article data could not be loaded. ${databaseError.message}`);
    throw new Error("No published TrendRader article matches this URL.");
  }

  let bodyHtml = "";
  const existingBody = $("#articleBody");
  const existingBodyHtml = existingBody && !hasTemplateTokens ? existingBody.innerHTML.trim() : "";

  if (article.bodyHtml || article.content || article.body) {
    bodyHtml = safeBodyHtml(article.bodyHtml || article.content || article.body);
  } else if (existingBodyHtml) {
    bodyHtml = safeBodyHtml(existingBodyHtml);
  } else if (article.delta) {
    try {
      const deltaPath = article.delta.startsWith("http")
        ? article.delta
        : new URL(`${siteRootPrefix()}${article.delta.replace(/^\.\//, "")}`, location.href).href;
      const delta = await fetchJson(deltaPath);
      bodyHtml = quillDeltaToHtml(delta);
    } catch (error) {
      console.warn("TrendRader article delta could not be loaded.", error);
    }
  }

  return { article, articles, bodyHtml, rawRuntime };
}

function hydrateArticlePage(resolved) {
  if (!resolved) return;
  const { article, articles, bodyHtml } = resolved;
  const title = article.title;
  const description = article.desc;
  const image = article.image;
  const category = article.category;
  const tag = article.tag;
  const author = article.author;
  const read = readTime(article, bodyHtml.replace(/<[^>]+>/g, " "));
  const canonical = article.url && /^https?:\/\//i.test(article.url)
    ? article.url
    : article.url
      ? `${BASE_SITE}/${article.url.replace(/^\//, "")}`
      : `${BASE_SITE}/articles/${article.slug}.html`;

  document.title = `${article.seoTitle || title} — TrendRader`;
  setMeta('meta[name="description"]', description);
  setMeta('meta[name="author"]', author);
  setMeta('meta[property="og:title"]', article.seoTitle || title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:url"]', canonical);
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[name="twitter:title"]', article.seoTitle || title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', image);
  setCanonical(canonical);

  const replacements = {
    ".kicker-label": tag,
    ".article-kicker > span:last-child": category,
    ".article-title": title,
    ".article-dek": description,
    ".author strong": author,
    ".meta-item strong": null
  };
  Object.entries(replacements).forEach(([selector, value]) => {
    const el = $(selector);
    if (el && value !== null) el.textContent = value;
  });
  const dateEl = $$(".meta-item strong")[0];
  if (dateEl) dateEl.textContent = formatDate(article.date);
  const readEl = $$(".meta-item strong")[1];
  if (readEl) readEl.textContent = `${read} min`;
  const hero = $("#heroImage");
  if (hero && image) {
    hero.src = image;
    hero.alt = String(article.imageAlt || title);
    hero.removeAttribute("data-template-image");
  }
  if (!image && hero) hero.remove();

  const body = $("#articleBody");
  if (body && bodyHtml) {
    const tags = $("#articleTags");
    body.innerHTML = bodyHtml;
    if (tags) body.appendChild(tags);
  }

  const initials = author.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0,2).toUpperCase() || "T";
  ["#authorAvatar","#authorAvatarLarge"].forEach((selector) => {
    const el = $(selector);
    if (el) el.textContent = initials;
  });
  const authorName = $("#authorName");
  if (authorName) authorName.textContent = author;
  const authorBio = $("#authorBio");
  if (authorBio && article.authorBio) authorBio.textContent = article.authorBio;

  const tagsEl = $("#articleTags");
  const keywords = Array.isArray(article.keywords) ? article.keywords : String(article.keywords || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (tagsEl && keywords.length) {
    tagsEl.innerHTML = `<span>Topics</span>${keywords.slice(0,8).map((keyword) => `<a href="../index.html#latest">${escapeHtml(keyword)}</a>`).join("")}`;
  }

  buildOutline();
  renderRelated(articles, article);
  updateSchemaFallback(article, canonical, read);
  if (slug && !location.pathname.endsWith(`${slug}.html`)) {
    history.replaceState(null, "", `?slug=${encodeURIComponent(slug)}`);
  }
}

function buildOutline() {
  const outline = $("#storyOutline");
  const body = $("#articleBody");
  if (!outline || !body) return;
  const headings = $$("h2,h3", body);
  outline.innerHTML = headings.slice(0, 6).map((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    return `<a href="#${escapeHtml(heading.id)}"><span>${String(index + 1).padStart(2,"0")}</span>${escapeHtml(heading.textContent)}</a>`;
  }).join("");
  if (!headings.length) outline.innerHTML = `<span class="outline-empty">Published story</span>`;
}

function renderRelated(articles, current) {
  const grid = $("#relatedGrid");
  if (!grid) return;
  const candidates = articles.filter((article) => article.slug !== current.slug && article.title);
  const currentTokens = new Set(`${current.title} ${current.desc} ${current.category} ${current.tag}`.toLowerCase().match(/[a-z0-9]{4,}/g) || []);
  const related = candidates.map((article) => {
    const tokens = `${article.title} ${article.desc} ${article.category} ${article.tag}`.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
    const overlap = tokens.reduce((score, token) => score + (currentTokens.has(token) ? 1 : 0), 0);
    const sameCategory = article.category.toLowerCase() === current.category.toLowerCase() ? 4 : 0;
    return { article, score: overlap + sameCategory };
  }).sort((a,b) => b.score - a.score || new Date(b.article.date) - new Date(a.article.date)).slice(0,3).map((item) => item.article);

  grid.innerHTML = related.map((article, index) => {
    const image = article.image ? `<img src="${escapeHtml(article.image)}" alt="${escapeHtml(article.title)}" loading="lazy" width="1000" height="625">` : "";
    return `<a class="related-card reveal" href="${escapeHtml(articleUrl(article))}">
      <div class="related-image">${image}<span>${String(index + 1).padStart(2,"0")}</span></div>
      <div class="related-meta"><span>${escapeHtml(article.tag)}</span><i></i><span>${readTime(article)} min</span></div>
      <h3>${escapeHtml(article.title)}</h3><div class="related-arrow">↗</div>
    </a>`;
  }).join("");
  observeReveals(grid);
}

function updateSchemaFallback(article, canonical, read) {
  const existing = $$('script[type="application/ld+json"]');
  const unresolved = existing.some((node) => /\{\{/.test(node.textContent || ""));
  if (!unresolved) return;
  existing.forEach((node) => node.remove());
  const schema = {
    "@context":"https://schema.org",
    "@type":"NewsArticle",
    "headline":article.title,
    "description":article.desc,
    "url":canonical,
    "datePublished":article.date,
    "dateModified":article.modified || article.date,
    "author":{"@type":"Organization","name":article.author || "TrendRader Editorial"},
    "publisher":{"@type":"Organization","name":"TrendRader","url":BASE_SITE,"logo":{"@type":"ImageObject","url":`${BASE_SITE}/assets/logo.svg`}},
    "image":article.image ? [article.image] : [],
    "articleSection":article.category,
    "keywords":Array.isArray(article.keywords) ? article.keywords.join(", ") : String(article.keywords || ""),
    "mainEntityOfPage":{"@type":"WebPage","@id":canonical},
    "isAccessibleForFree":true,
    "timeRequired":`PT${read}M`
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
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
}

function setupScroll() {
  const progress = $("#progressBar");
  const header = $("#siteHeader");
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
    header?.classList.toggle("scrolled", window.scrollY > 12);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function setupShare() {
  const modal = $("#shareModal");
  const open = () => { modal?.classList.add("open"); modal?.setAttribute("aria-hidden","false"); };
  const close = () => { modal?.classList.remove("open"); modal?.setAttribute("aria-hidden","true"); };
  $("#shareTop")?.addEventListener("click", open);
  $("#shareRail")?.addEventListener("click", open);
  $("#closeShare")?.addEventListener("click", close);
  $("#shareBackdrop")?.addEventListener("click", close);
  $$("[data-share]").forEach((button) => button.addEventListener("click", async () => {
    const type = button.dataset.share;
    const url = location.href;
    const title = document.title;
    if (type === "copy") {
      try { await navigator.clipboard.writeText(url); $("#shareMessage").textContent = "Link copied to clipboard."; }
      catch { $("#shareMessage").textContent = url; }
      return;
    }
    const target = type === "x"
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
      : `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(target, "share", "width=700,height=600,noopener,noreferrer");
  }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
}

function setupLightbox() {
  const lightbox = $("#lightbox");
  const image = $("#heroImage");
  $("#expandImage")?.addEventListener("click", () => {
    if (!image?.src) return;
    $("#lightboxImage").src = image.src;
    $("#lightboxImage").alt = image.alt;
    lightbox?.classList.add("open");
    lightbox?.setAttribute("aria-hidden","false");
  });
  const close = () => { lightbox?.classList.remove("open"); lightbox?.setAttribute("aria-hidden","true"); };
  $("#closeLightbox")?.addEventListener("click", close);
  lightbox?.addEventListener("click", (event) => { if (event.target === lightbox) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
}

function setupNewsletter() {
  $("#newsletterForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = $("#email");
    const message = $("#newsletterMessage");
    if (!email?.validity.valid) { email?.focus(); return; }
    email.value = "";
    message.textContent = "You're on the list. Welcome to TrendRader.";
  });
}

function setupCursor() {
  const glow = $(".cursor-glow");
  if (!glow || reducedMotion || !window.matchMedia("(hover:hover)").matches) return;
  window.addEventListener("pointermove", (event) => {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }, { passive: true });
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
  $$(".reveal", root).forEach((element, index) => {
    if (!reducedMotion) element.style.transitionDelay = `${Math.min(index * 40, 220)}ms`;
    observer.observe(element);
  });
}

async function init() {
  setupNavigation();
  setupScroll();
  setupShare();
  setupLightbox();
  setupNewsletter();
  setupCursor();
  $("#footerYear").textContent = new Date().getFullYear();

  try {
    const resolved = await resolveArticle();
    if (resolved) hydrateArticlePage(resolved);
  } catch (error) {
    console.error("TrendRader article load failed:", error);
    document.title = "TrendRader — Article";
    setMeta('meta[name="robots"]', "noindex, follow");
    const body = $("#articleBody");
    if (body) body.innerHTML = `<div class="article-load-error"><p>This article could not be loaded from the published TrendRader feed.</p><a href="../index.html">Return to TrendRader</a></div>`;
  }
  observeReveals();
}

init();
