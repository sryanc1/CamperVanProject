// ── render.js ────────────────────────────────────────────────
// All DOM rendering: sidebar, carousel, cards, items, options, previews.

import { getState }     from "./state.js";
import { categorySlug } from "./state.js";

const appEl = document.getElementById("app");
const previewCache = {};  // url → { title, domain, favicon } | "loading" | "error"
let   cardObserver = null;

// ── Helpers ──────────────────────────────────────────────────
function optionEffectiveCost(opt) {
  // Use actual cost if purchased, otherwise estimated cost × quantity
  if (opt.purchased && opt.actualCost != null) return opt.actualCost;
  return opt.cost * (opt.quantity || 1);
}

function categoryTotal(category) {
  return category.items.reduce((sum, item) => {
    if (!item.selectedOptionId) return sum;
    const opt = item.options.find(o => o.id === item.selectedOptionId);
    if (!opt) return sum;
    return sum + optionEffectiveCost(opt);
  }, 0);
}

function grandTotal() {
  return getState().categories.reduce((sum, cat) => sum + categoryTotal(cat), 0);
}

function varianceTotal() {
  // Spent − original estimates on purchased options
  // Negative = under budget (good), Positive = over budget (bad)
  return getState().categories.reduce((sum, cat) =>
    sum + cat.items.reduce((s, item) =>
      s + item.options.reduce((os, o) => {
        if (!o.purchased || o.actualCost == null || o.originalCost == null) return os;
        return os + (o.actualCost - o.originalCost);
      }, 0)
    , 0)
  , 0);
}

function spentTotal() {
  return getState().categories.reduce((sum, cat) =>
    sum + cat.items.reduce((s, item) =>
      s + item.options.reduce((os, o) =>
        os + (o.purchased && o.actualCost != null ? o.actualCost : 0)
      , 0)
    , 0)
  , 0);
}

function renderTotals() {
  const total     = grandTotal();
  const spent     = spentTotal();
  const budget    = getState().budget || 0;
  const remaining = budget > 0 ? budget - spent : null;

  const pctEstimated = budget > 0 ? Math.min(total / budget, 1) : 0;
  const pctSpent     = budget > 0 ? Math.min(spent / budget, 1) : 0;

  // Status colour driven by spent vs budget
  const spentStatus = budget > 0
    ? (spent / budget > 1 ? "over" : spent / budget > 0.8 ? "warn" : "ok")
    : "ok";

  // Budget input
  const budgetInput = document.getElementById("budget-input");
  if (budgetInput && budgetInput.value === "" && budget > 0) {
    budgetInput.value = budget;
  }

  // Header — estimated pill + budget input only
  const headerEl = document.getElementById("header-total");
  if (headerEl) {
    headerEl.style.display = total > 0 ? "flex" : "none";
    headerEl.querySelector(".header-total-amount").textContent = `$${total.toFixed(2)}`;
  }


  // Budget drawer stats — IDs are on the card divs, amounts on the child span
  const set = (id, val) => {
    const el = document.getElementById(id);
    const amountEl = el?.querySelector(".budget-stat-amount");
    if (amountEl) amountEl.textContent = val;
  };
  const setStatus = (id, status) => { const el = document.getElementById(id); if (el) el.dataset.status = status; };

  const variance = varianceTotal();
  const hasVariance = getState().categories.some(cat =>
    cat.items.some(item => item.options.some(o => o.purchased && o.originalCost != null))
  );

  set("bd-budget",    budget > 0 ? `$${budget.toFixed(2)}` : "Not set");
  set("bd-estimated", `$${total.toFixed(2)}`);
  set("bd-spent",     `$${spent.toFixed(2)}`);
  set("bd-remaining", remaining !== null ? `$${remaining.toFixed(2)}` : "—");
  set("bd-variance",  hasVariance
    ? `${variance > 0 ? "+" : ""}$${variance.toFixed(2)}`
    : "—");

  setStatus("bd-spent",     spentStatus);
  setStatus("bd-remaining", remaining !== null
    ? (remaining < 0 ? "over" : remaining < budget * 0.2 ? "warn" : "ok")
    : "ok");
  setStatus("bd-variance",  !hasVariance ? "none" : variance > 0 ? "over" : variance < 0 ? "good" : "ok");

  // Progress bars
  const setBar = (id, pct, status) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = `${(pct * 100).toFixed(1)}%`;
    el.dataset.status = status;
  };
  setBar("bd-bar-estimated", pctEstimated, pctEstimated > 1 ? "over" : pctEstimated > 0.8 ? "warn" : "ok");
  setBar("bd-bar-spent",     pctSpent,     spentStatus);

  const pctFmt = pct => budget > 0 ? `${(pct * 100).toFixed(0)}%` : "—";
  set("bd-pct-estimated", pctFmt(pctEstimated));
  set("bd-pct-spent",     pctFmt(pctSpent));
}

// ── Entry point ──────────────────────────────────────────────
export function render() {
  renderSidebar();
  renderCarousel();
  renderTotals();
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

  nav.innerHTML = categories.map(cat => {
    const total = categoryTotal(cat);
    const totalBadge = total > 0 ? `<span class="nav-item-total">$${total.toFixed(2)}</span>` : "";
    return `
    <li class="nav-item" data-nav-category="${cat.id}" title="${cat.name}">
      <span class="nav-item-icon">${cat.icon || "📁"}</span>
      <span class="nav-item-name">${cat.name}</span>
      ${totalBadge}
    </li>`;
  }).join("");

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
  const total  = categoryTotal(category);
  const totalHTML = total > 0 ? `<span class="card-hero-total">$${total.toFixed(2)}</span>` : "";
  return `
    <div class="card" data-category="${category.id}">

      <!-- Hero image — scrolls away -->
      <div class="card-hero">
        <img class="card-hero-img" src="${imgSrc}" alt="${category.name}"
          onerror="this.style.display='none'" onload="this.classList.add('loaded')" />
        <div class="card-hero-overlay"></div>
        <div class="card-hero-actions">
          <button class="btn-danger-sm" data-action="remove-category" data-category="${category.id}">✕ Remove</button>
        </div>
      </div>

      <!-- Sticky title bar — pins to top when hero scrolls out of view -->
      <div class="card-sticky-title">
        <div class="card-sticky-title-text">
          <span>${category.icon || ""} ${category.name}</span>
          ${totalHTML}
        </div>
        <button class="btn-notes-toggle ${category.notes ? 'has-notes' : ''}"
          data-action="toggle-notes" data-category="${category.id}"
          title="${category.notes ? 'View/edit notes' : 'Add notes'}">
          📝
        </button>
      </div>

      <!-- Category notes panel -->
      <div class="cat-notes-panel" id="cat-notes-${category.id}" style="display:none"
           data-saved-notes="${(category.notes || "").replace(/"/g, '&quot;')}">
        <textarea
          class="cat-notes-textarea"
          placeholder="Measurements, constraints, decisions made…"
          rows="4"
        >${category.notes || ""}</textarea>
        <div class="cat-notes-footer">
          <span class="cat-notes-conflict" style="display:none">
            ⚠ Updated remotely —
            <button class="btn-link" data-action="notes-discard" data-category="${category.id}">discard my changes</button>
          </span>
          <span class="cat-notes-saved" style="display:none">Saved ✓</span>
          <button class="btn-secondary btn-sm" data-action="save-category-notes" data-category="${category.id}">
            Save
          </button>
        </div>
      </div>

      <!-- Items -->
      <div class="card-body">
        ${category.items.length === 0
          ? `<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px 0">No items yet</p>`
          : category.items.map(item => renderItem(category, item)).join("")}
      </div>

      <!-- Sticky footer -->
      <div class="card-body-footer">
        <button class="btn-secondary btn-sm" style="width:100%" data-action="add-item" data-category="${category.id}">
          + Add Item
        </button>
      </div>

    </div>`;
}

// ── Item ─────────────────────────────────────────────────────
function itemSelectedCost(item) {
  if (!item.selectedOptionId) return null;
  const opt = item.options.find(o => o.id === item.selectedOptionId);
  if (!opt) return null;
  return optionEffectiveCost(opt);
}

function renderItem(category, item) {
  const cost  = itemSelectedCost(item);
  const selectedOpt = item.options.find(o => o.id === item.selectedOptionId);
  const displayCost = selectedOpt?.purchased && selectedOpt?.actualCost != null
    ? selectedOpt.actualCost
    : cost;
  const isPaid = selectedOpt?.purchased && selectedOpt?.actualCost != null;
  const costBadge = displayCost !== null
    ? `<span class="item-cost-badge ${isPaid ? "item-cost-paid" : ""}">$${displayCost.toFixed(2)}</span>`
    : (item.options.length > 0 ? `<span class="item-cost-badge item-cost-unset">—</span>` : "");

  const isPurchased = item.options.some(o => o.purchased);

  return `
    <div class="item item-collapsed ${isPurchased ? "item-complete" : ""}">
      <div class="item-header" data-action="toggle-item" data-category="${category.id}" data-item="${item.id}" style="cursor:pointer">
        <div class="item-title-row">
          <span class="item-chevron">▶</span>
          <strong>${item.name}</strong>
          ${costBadge}
        </div>
        <div class="item-actions">
          <button class="btn-secondary btn-sm" data-action="add-option"
            data-category="${category.id}" data-item="${item.id}">+ Option</button>
          <button class="btn-danger-sm" data-action="remove-item"
            data-category="${category.id}" data-item="${item.id}">✕</button>
        </div>
      </div>
      <div class="item-body">
        ${item.options.map(option => renderOption(category, item, option)).join("")}
      </div>
    </div>`;
}

// ── Option ───────────────────────────────────────────────────
function renderOption(category, item, option) {
  const qty     = option.quantity && option.quantity > 1 ? `<span class="item-qty">×${option.quantity}</span>` : "";
  const notes   = option.notes ? `<p class="item-notes">${option.notes}</p>` : "";
  const preview = option.url
    ? `<div class="link-preview" id="preview-${option.id}">${renderPreview(option.url)}</div>`
    : "";
  const purchased = option.purchased || false;
  const purchasedClass = purchased ? "option-purchased" : "";
  const actualBadge = purchased && option.actualCost != null
    ? `<span class="actual-cost-badge">paid $${option.actualCost.toFixed(2)}</span>`
    : "";
  return `
    <div class="option ${item.selectedOptionId === option.id ? "option-selected" : ""} ${purchasedClass}">
      <div class="option-row">
        <!-- Line 1: select + name + remove -->
        <div class="option-line option-line-1">
          <input type="radio" name="radio-${item.id}"
            ${item.selectedOptionId === option.id ? "checked" : ""}
            data-action="select-option"
            data-category="${category.id}" data-item="${item.id}" data-option="${option.id}" />
          <span class="option-name">${option.name}</span>
          <button class="btn-danger-sm" data-action="remove-option"
            data-category="${category.id}" data-item="${item.id}" data-option="${option.id}">✕</button>
        </div>
        <!-- Line 2a: pricing info -->
        <div class="option-line option-line-2a">
          <div class="option-line-2a-left">
            <span class="option-cost">$${option.cost.toFixed(2)}</span>
            ${qty}
          </div>
          ${actualBadge}
        </div>
        <!-- Line 2b: actions -->
        <div class="option-line option-line-2b">
          <button class="btn-secondary btn-sm" data-action="edit-option"
            data-category="${category.id}" data-item="${item.id}" data-option="${option.id}">✎ Edit</button>
          <label class="purchased-label" title="Mark as purchased">
            <input type="checkbox" class="purchased-checkbox"
              ${purchased ? "checked" : ""}
              data-action="toggle-purchased"
              data-category="${category.id}" data-item="${item.id}" data-option="${option.id}" />
            <span class="purchased-tick">✓</span>
            <span class="purchased-label-text">${purchased ? "Purchased" : "Mark purchased"}</span>
          </label>
        </div>
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
// ── Dashboard ────────────────────────────────────────────────
export function openDashboard() {
  const modal = document.getElementById("dashboard-modal");
  if (!modal) return;
  renderDashboard();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

export function closeDashboard() {
  const modal = document.getElementById("dashboard-modal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

export function renderDashboardPublic() { renderDashboard(); }

function renderDashboard() {
  const { categories } = getState();
  const tbody   = document.getElementById("dashboard-tbody");
  const emptyEl = document.getElementById("dashboard-empty");
  const tableEl = document.getElementById("dashboard-table");
  if (!tbody) return;

  if (categories.length === 0) {
    tableEl.style.display = "none";
    emptyEl.style.display = "block";
    return;
  }
  tableEl.style.display = "";
  emptyEl.style.display = "none";

  tbody.innerHTML = categories.map(cat => {
    if (cat.items.length === 0) {
      return `
        <tr class="db-row-category">
          <td class="db-cat-cell" colspan="4">
            ${cat.name}
            <span class="db-no-items">no items</span>
          </td>
        </tr>`;
    }

    return cat.items.map((item, idx) => {
      const selected   = item.selectedOptionId
        ? item.options.find(o => o.id === item.selectedOptionId)
        : null;
      const purchased  = selected?.purchased || false;
      const isFirst    = idx === 0;

      const catCell = isFirst
        ? `<td class="db-cat-cell" rowspan="${cat.items.length}">${cat.name}</td>`
        : "";

      const optionCell = selected
        ? `<span class="db-selected-tick">✓</span>`
        : `<span class="db-no-selection">—</span>`;

      const purchasedCell = selected
        ? (purchased
            ? `<span class="db-purchased-tick">✓</span>`
            : `<span class="db-purchased-empty">·</span>`)
        : "";

      return `
        <tr class="${!selected ? "db-row-gap" : purchased ? "db-row-purchased" : "db-row-selected"}">
          ${catCell}
          <td class="db-item-cell">${item.name}</td>
          <td class="db-option-cell">${optionCell}</td>
          <td class="db-purchased-cell">${purchasedCell}</td>
        </tr>`;
    }).join("");
  }).join("");
}

export function scrollToCard(categoryId) {
  const card = document.querySelector(`.card[data-category="${categoryId}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
}

// Called by sync.js when a Firestore update arrives.
// If a notes panel is open and dirty (unsaved local changes), flag the conflict.
export function checkNotesConflicts(updatedCategories) {
  updatedCategories.forEach(cat => {
    const panel = document.getElementById(`cat-notes-${cat.id}`);
    if (!panel || panel.style.display === "none") return;

    const textarea   = panel.querySelector(".cat-notes-textarea");
    const savedNotes = panel.dataset.savedNotes;
    const localDirty = textarea && textarea.value !== savedNotes;

    // Remote value changed from what we last saved
    const remoteChanged = cat.notes !== savedNotes;

    if (localDirty && remoteChanged) {
      // Show conflict warning, offer to discard
      panel.querySelector(".cat-notes-conflict").style.display = "inline";
      panel.querySelector(".cat-notes-saved").style.display    = "none";
    } else if (remoteChanged && !localDirty) {
      // No local edits — silently update the textarea and saved marker
      if (textarea) textarea.value = cat.notes || "";
      panel.dataset.savedNotes = cat.notes || "";
    }
  });
}

function setupCardObserver() {
  if (cardObserver) cardObserver.disconnect();
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  // Track ALL currently-visible cards, not just the batch of changes
  const visibleCards = new Set();

  cardObserver = new IntersectionObserver(entries => {
    // Update the visible set — entries only contains cards that changed state
    entries.forEach(e => {
      if (e.isIntersecting) visibleCards.add(e.target);
      else                  visibleCards.delete(e.target);
    });

    if (visibleCards.size === 0) return;

    // Pick the leftmost visible card by actual DOM scroll position
    const leftmost = [...visibleCards].reduce((best, card) => {
      const left = card.getBoundingClientRect().left;
      return left < best.left ? { card, left } : best;
    }, { card: null, left: Infinity }).card;

    if (!leftmost) return;
    const id = leftmost.dataset.category;
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("nav-item-active"));
    document.querySelector(`.nav-item[data-nav-category="${id}"]`)?.classList.add("nav-item-active");
  }, { threshold: 0.5, root: carousel });
  document.querySelectorAll(".card").forEach(card => cardObserver.observe(card));
}