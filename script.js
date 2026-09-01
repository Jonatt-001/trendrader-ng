const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const menuToggle = document.getElementById("menuToggle");
const mobileNav = document.getElementById("mobileNav");
menuToggle.addEventListener("click", () => {
  const open = mobileNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

const searchToggle = document.getElementById("searchToggle");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");
searchToggle.addEventListener("click", () => {
  const open = searchPanel.classList.toggle("open");
  if (open) setTimeout(() => searchInput.focus(), 300);
});

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;
  document.querySelector(".section-heading h2").textContent = `Results for "${query}"`;
  document.getElementById("latest").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -45px" });

document.querySelectorAll(".reveal").forEach((el, i) => {
  if (!reducedMotion) el.style.transitionDelay = `${Math.min(i * 35, 220)}ms`;
  observer.observe(el);
});

const glow = document.querySelector(".cursor-glow");
if (!reducedMotion && window.matchMedia("(hover:hover)").matches) {
  window.addEventListener("pointermove", (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
  }, { passive: true });
}

if (!reducedMotion && window.matchMedia("(hover:hover)").matches) {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `perspective(1000px) rotateX(${-y * 2.5}deg) rotateY(${x * 2.5}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

document.getElementById("newsletterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("newsletterEmail");
  const message = document.getElementById("newsletterMessage");
  if (!email.validity.valid) {
    email.focus();
    return;
  }
  message.textContent = "You're on the list. Welcome to TrendRader.";
  message.style.color = "#ff4b2b";
  email.value = "";
});

document.querySelectorAll(".mobile-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});
