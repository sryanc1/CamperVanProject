// ── render.js ────────────────────────────────────────────────
// All DOM rendering: sidebar, carousel, cards, items, options, previews.

import { getState }     from "./state.js";
import { categorySlug } from "./state.js";

const appEl = document.getElementById("app");
const previewCache = {};  // url → { title, domain, favicon } | "loading" | "error"
let   cardObserver = null;

// ── Entry point ──────────────────────────────────────────────
export function render() {
  renderSidebar();
  renderCarousel();
}

// ── Sidebar ──────────────────────────────────────────────────
export function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;
  const { categories } = getState();

  if (categories.length === 0) {
    nav.innerHTML = `<li class="sidebar-empty" style="font-size:12px;color:var(--text-3);padding:8px 10px">No categories yet</li>`;
    return;
  }

  nav.innerHTML = categories.map(cat => `
    <li class="nav-item" data-nav-category="${cat.id}" title="${cat.name}">
      <span class="nav-item-icon">${cat.icon || "📁"}</span>
      <span class="nav-item-name">${cat.name}</span>
    </li>`).join("");

  nav.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      scrollToCard(el.dataset.navCategory);
      // Close sidebar on mobile
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("sidebar-overlay").classList.remove("visible");
    });
  });
}

// ── Carousel ─────────────────────────────────────────────────
function renderCarousel() {
  const { categories } = getState();

  if (categories.length === 0) {
    appEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚐</div>
        <p>Add your first category to get started.</p>
      </div>`;
    return;
  }

  appEl.innerHTML = `
    <div class="carousel" id="carousel">
      ${categories.map(renderCard).join("")}
    </div>`;

  setupCardObserver();
}

// ── Card ─────────────────────────────────────────────────────
function renderCard(category) {
  const imgSrc = `images/${categorySlug(category.name)}.jpg`;
  return `
    <div class="card" data-category="${category.id}">
      <div class="card-hero">
        <img class="card-hero-img" src="${imgSrc}" alt="${category.name}"
          onerror="this.style.display='none'" onload="this.classList.add('loaded')" />
        <div class="card-hero-overlay"></div>
        <div class="card-hero-title">${category.icon || ""} ${category.name}</div>
        <div class="card-hero-actions">
          <button class="btn-danger-sm" data-action="remove-category" data-category="${category.id}">✕ Remove</button>
        </div>
      </div>
      <div class="card-body">
        ${category.items.length === 0
          ? `<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px 0">No items yet</p>`
          : category.items.map(item => renderItem(category, item)).join("")}
      </div>
      <div class="card-body-footer">
        <button class="btn-secondary btn-sm" style="width:100%" data-action="add-item" data-category="${category.id}">
          + Add Item
        </button>
      </div>
    </div>`;
}

// ── Item ─────────────────────────────────────────────────────
function renderItem(category, item) {
  return `
    <div class="item">
      <div class="item-header">
        <strong>${item.name}</strong>
        <div class="item-actions">
          <button class="btn-secondary btn-sm" data-action="add-option"
            data-category="${category.id}" data-item="${item.id}">+ Option</button>
          <button class="btn-danger-sm" data-action="remove-item"
            data-category="${category.id}" data-item="${item.id}">✕</button>
        </div>
      </div>
      ${item.options.map(option => renderOption(category, item, option)).join("")}
    </div>`;
}

// ── Option ───────────────────────────────────────────────────
function renderOption(category, item, option) {
  const qty     = option.quantity && option.quantity > 1 ? `<span class="item-qty">×${option.quantity}</span>` : "";
  const notes   = option.notes ? `<p class="item-notes">${option.notes}</p>` : "";
  const preview = option.url
    ? `<div class="link-preview" id="preview-${option.id}">${renderPreview(option.url)}</div>`
    : "";
  return `
    <div class="option ${item.selectedOptionId === option.id ? "option-selected" : ""}">
      <div class="option-row">
        <input type="radio" name="radio-${item.id}"
          ${item.selectedOptionId === option.id ? "checked" : ""}
          data-action="select-option"
          data-category="${category.id}" data-item="${item.id}" data-option="${option.id}" />
        <span class="option-name">${option.name}</span>
        ${qty}
        <span class="option-cost">$${option.cost.toFixed(2)}</span>
        <button class="btn-danger-sm" data-action="remove-option"
          data-category="${category.id}" data-item="${item.id}" data-option="${option.id}">✕</button>
      </div>
      ${notes}
      ${preview}
    </div>`;
}

// ── Link preview ─────────────────────────────────────────────
function renderPreview(url) {
  if (!url) return "";
  const cached = previewCache[url];
  if (cached && cached !== "loading" && cached !== "error") return previewCardHTML(cached, url);
  if (!cached) { previewCache[url] = "loading"; fetchPreview(url); }
  return `<div class="link-preview-loading">⧖ Loading preview…</div>`;
}

function previewCardHTML(data, url) {
  const favicon = data.favicon
    ? `<img class="preview-favicon" src="${data.favicon}" onerror="this.style.display='none'" />`
    : "";
  return `
    <a class="preview-card" href="${url}" target="_blank" rel="noopener">
      ${favicon}
      <div class="preview-text">
        <span class="preview-title">${data.title || data.domain}</span>
        <span class="preview-domain">${data.domain}</span>
      </div>
      <span class="preview-arrow">↗</span>
    </a>`;
}

async function fetchPreview(url) {
  try {
    const api  = `https://api.microlink.io?url=${encodeURIComponent(url)}&palette=false&audio=false&video=false&iframe=false`;
    const json = await fetch(api).then(r => r.json());
    const host = new URL(url).hostname.replace("www.", "");
    if (json.status === "success") {
      previewCache[url] = {
        title:   json.data.title || "",
        domain:  host,
        favicon: json.data.logo?.url || `https://www.google.com/s2/favicons?domain=${host}&sz=32`,
      };
    } else {
      previewCache[url] = { title: "", domain: host,
        favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=32` };
    }
  } catch {
    previewCache[url] = { title: "", favicon: "",
      domain: (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } })() };
  }
  // Patch in-place without re-rendering
  document.querySelectorAll(".link-preview").forEach(el => {
    const allOpts = getState().categories.flatMap(c => c.items.flatMap(i => i.options));
    const opt = allOpts.find(o => o.url === url && el.id === `preview-${o.id}`);
    if (opt) el.innerHTML = previewCardHTML(previewCache[url], url);
  });
}

// ── Carousel helpers ─────────────────────────────────────────
export function scrollToCard(categoryId) {
  const card = document.querySelector(`.card[data-category="${categoryId}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
}

function setupCardObserver() {
  if (cardObserver) cardObserver.disconnect();
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = entry.target.dataset.category;
      document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("nav-item-active"));
      document.querySelector(`.nav-item[data-nav-category="${id}"]`)?.classList.add("nav-item-active");
    });
  }, { threshold: 0.5, root: carousel });
  document.querySelectorAll(".card").forEach(card => cardObserver.observe(card));
}