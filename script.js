const config = window.PORTFOLIO_CONFIG || {};
const githubName = config.githubUsername || "samzz37";
const githubUrl = `https://github.com/${encodeURIComponent(githubName)}`;
const linkedInUrl = config.linkedinUrl || "";

document.querySelectorAll("[data-github-profile]").forEach((link) => { link.href = githubUrl; });
document.querySelectorAll("[data-linkedin], [data-social='linkedin']").forEach((link) => {
  if (linkedInUrl) link.href = linkedInUrl;
  else link.hidden = true;
});

const profileAvatar = document.querySelector(".profile-avatar");
if (profileAvatar && config.githubAvatar) profileAvatar.src = config.githubAvatar;
if (profileAvatar && config.displayName) profileAvatar.alt = config.displayName;

const instagram = document.querySelector("[data-social='instagram']");
if (instagram && config.instagramUrl) { instagram.href = config.instagramUrl; instagram.hidden = false; }
const instagramSecondary = document.querySelector("[data-social='instagram-secondary']");
if (instagramSecondary && config.instagramSecondaryUrl) { instagramSecondary.href = config.instagramSecondaryUrl; instagramSecondary.hidden = false; }

const whatsappDigits = (config.whatsappNumber || "").replace(/\D/g, "");
const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
const whatsappButton = document.querySelector("[data-whatsapp]");
const whatsappSocial = document.querySelector("[data-social='whatsapp']");
if (whatsappUrl && whatsappButton) { whatsappButton.href = whatsappUrl; whatsappButton.hidden = false; }
if (whatsappUrl && whatsappSocial) { whatsappSocial.href = whatsappUrl; whatsappSocial.hidden = false; }

const resumePath = config.resumePath || "";
document.querySelectorAll("[data-resume], [data-social='resume']").forEach((link) => {
  if (resumePath) { link.href = resumePath; link.hidden = false; }
});

document.querySelectorAll("[data-price]").forEach((price) => {
  const value = config.prices?.[price.dataset.price];
  if (value) price.textContent = value;
});

document.querySelectorAll("[data-repo]").forEach((card) => {
  const repoName = card.dataset.repo;
  const projectLink = card.querySelector(".project-visual");
  if (projectLink) projectLink.href = `${githubUrl}/${encodeURIComponent(repoName)}`;
  const stats = card.querySelector(".project-stats");
  if (stats) stats.textContent = "GitHub project";
});
document.querySelectorAll("[data-github-all]").forEach((link) => { link.href = `${githubUrl}?tab=repositories`; });

// Read public repository metadata from GitHub; curated project cards stay visible if the API is unavailable.
const projectCards = [...document.querySelectorAll(".project-card[data-repo]")];
fetch(`https://api.github.com/users/${encodeURIComponent(githubName)}/repos?per_page=100&sort=updated`)
  .then((response) => { if (!response.ok) throw new Error("GitHub is temporarily unavailable"); return response.json(); })
  .then((repositories) => {
    const byName = new Map(repositories.map((repo) => [repo.name.toLowerCase(), repo]));
    projectCards.forEach((card) => {
      const repo = byName.get(card.dataset.repo.toLowerCase());
      const stats = card.querySelector(".project-stats");
      if (!repo || !stats) return;
      const bits = [];
      if (repo.language) bits.push(repo.language);
      bits.push(`★ ${repo.stargazers_count}`);
      stats.textContent = bits.join(" · ");
      const link = card.querySelector(".project-visual");
      if (link) link.href = repo.html_url;
    });
  })
  .catch(() => { /* Keep the project cards and GitHub links useful when offline. */ });

const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
menuToggle?.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  menuToggle.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
  mainNav?.classList.toggle("is-open", !open);
});
mainNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuToggle?.setAttribute("aria-expanded", "false");
  menuToggle?.setAttribute("aria-label", "Open navigation");
  mainNav.classList.remove("is-open");
}));

const scene = document.querySelector("#scene");
const heroArt = document.querySelector(".hero-art");
if (scene && heroArt && matchMedia("(pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  heroArt.addEventListener("pointermove", (event) => {
    const bounds = heroArt.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    scene.style.setProperty("--tilt-x", `${x * 18 - 25}deg`);
    scene.style.setProperty("--tilt-y", `${y * -14 - 8}deg`);
  });
  heroArt.addEventListener("pointerleave", () => {
    scene.style.setProperty("--tilt-x", "-25deg");
    scene.style.setProperty("--tilt-y", "-8deg");
  });
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();
