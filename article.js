const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const progressBar=document.getElementById("progressBar");
const header=document.getElementById("siteHeader");

function updateScroll(){
  const scrollTop=window.scrollY;
  const doc=document.documentElement;
  const max=doc.scrollHeight-window.innerHeight;
  progressBar.style.width=`${max>0?(scrollTop/max)*100:0}%`;
  header.classList.toggle("scrolled",scrollTop>20);
}
window.addEventListener("scroll",updateScroll,{passive:true});updateScroll();

const menuToggle=document.getElementById("menuToggle");
const mobileNav=document.getElementById("mobileNav");
menuToggle.addEventListener("click",()=>{
  const open=mobileNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded",String(open));
});
document.querySelectorAll(".mobile-nav a").forEach(a=>a.addEventListener("click",()=>{
  mobileNav.classList.remove("open");menuToggle.setAttribute("aria-expanded","false");
}));

const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
},{threshold:.1,rootMargin:"0px 0px -40px"});
document.querySelectorAll(".reveal").forEach((el,i)=>{
  if(!reducedMotion)el.style.transitionDelay=`${Math.min(i*45,240)}ms`;
  observer.observe(el);
});

const glow=document.querySelector(".cursor-glow");
if(!reducedMotion&&window.matchMedia("(hover:hover)").matches){
  window.addEventListener("pointermove",e=>{
    glow.style.left=`${e.clientX}px`;glow.style.top=`${e.clientY}px`;
  },{passive:true});
  document.querySelectorAll(".tilt-card").forEach(card=>{
    card.addEventListener("pointermove",e=>{
      const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(1000px) rotateX(${-y*2}deg) rotateY(${x*2}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave",()=>card.style.transform="");
  });
}

const shareModal=document.getElementById("shareModal");
const openShare=()=>{shareModal.classList.add("open");shareModal.setAttribute("aria-hidden","false")};
const closeShare=()=>{shareModal.classList.remove("open");shareModal.setAttribute("aria-hidden","true")};
document.getElementById("shareTop").addEventListener("click",openShare);
document.getElementById("shareRail").addEventListener("click",openShare);
document.getElementById("closeShare").addEventListener("click",closeShare);
document.getElementById("shareBackdrop").addEventListener("click",closeShare);

document.querySelectorAll("[data-share]").forEach(btn=>{
  btn.addEventListener("click",async()=>{
    const type=btn.dataset.share,url=location.href,title=document.title;
    if(type==="copy"){
      try{await navigator.clipboard.writeText(url);document.getElementById("shareMessage").textContent="Link copied to clipboard."}
      catch{document.getElementById("shareMessage").textContent=url}
      return;
    }
    const target=type==="x"
      ?`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
      :`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(target,"share","width=700,height=600,noopener,noreferrer");
  });
});

const lightbox=document.getElementById("lightbox");
const lightboxImage=document.getElementById("lightboxImage");
document.getElementById("expandImage").addEventListener("click",()=>{
  lightboxImage.src=document.getElementById("heroImage").src;
  lightboxImage.alt=document.getElementById("heroImage").alt;
  lightbox.classList.add("open");lightbox.setAttribute("aria-hidden","false");
});
const closeLightbox=()=>{lightbox.classList.remove("open");lightbox.setAttribute("aria-hidden","true")};
document.getElementById("closeLightbox").addEventListener("click",closeLightbox);
lightbox.addEventListener("click",e=>{if(e.target===lightbox)closeLightbox()});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){closeShare();closeLightbox()}
});

document.getElementById("newsletterForm").addEventListener("submit",e=>{
  e.preventDefault();
  const email=document.getElementById("email"),msg=document.getElementById("newsletterMessage");
  if(!email.validity.valid){email.focus();return}
  email.value="";msg.textContent="You're on the list. Welcome to TrendRader.";msg.style.color="#ff4b2b";
});

if(!reducedMotion){
  const hero=document.querySelector(".hero-media");
  window.addEventListener("scroll",()=>{
    const r=hero.getBoundingClientRect();
    if(r.bottom>0&&r.top<innerHeight){
      const offset=(innerHeight/2-r.top)*.025;
      document.getElementById("heroImage").style.transform=`scale(1.01) translateY(${offset}px)`;
    }
  },{passive:true});
}

/* TrendRader article runtime: related-story hydration from the static publisher payload. */
(function hydrateRelatedStories() {
  const dataEl = document.getElementById("relatedArticlesData");
  if (!dataEl) return;
  try {
    const payload = JSON.parse(dataEl.textContent || "{}");
    const items = Array.isArray(payload.items) ? payload.items : [];
    const grid = document.querySelector(".related-grid");
    if (!grid || !items.length) return;
    grid.innerHTML = items.slice(0, 3).map((item, index) => {
      const safe = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
      }[char]));
      return `<a class="related-card reveal tilt-card" href="${safe(item.url || "#")}">
        <div class="related-image">
          <img src="${safe(item.image || "")}" alt="${safe(item.title || "Related TrendRader story")}" loading="lazy" width="1000" height="630">
          <span>${String(index + 1).padStart(2, "0")}</span>
        </div>
        <div class="related-meta">
          <span>${safe(item.tag || "News")}</span><i></i><span>${Math.max(1, Number(item.readTime || 4))} min</span>
        </div>
        <h3>${safe(item.title || "")}</h3>
        <div class="related-arrow">↗</div>
      </a>`;
    }).join("");
    if (!reducedMotion) {
      grid.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    }
  } catch (error) {
    console.warn("TrendRader related stories could not be hydrated.", error);
  }
})();
