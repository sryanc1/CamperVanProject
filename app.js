import { auth, PROJECT_DOC, signIn, signOut, onAuthStateChanged, onSnapshot, setDoc }
  from "./firebase.js";

const appEl    = document.getElementById("app");
const authEl   = document.getElementById("auth-bar");
const sidebar  = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const hamburger = document.getElementById("hamburger");

// ---------- PREDEFINED CATEGORIES ----------
const PRESET_CATEGORIES = [
  { name: "Electrical",          icon: "⚡", description: "Battery, inverter, solar, wiring" },
  { name: "Solar",               icon: "☀️", description: "Panels, charge controllers, mounts" },
  { name: "Plumbing",            icon: "🚿", description: "Water tank, pump, pipes, sink" },
  { name: "Insulation",          icon: "🧱", description: "Foam board, spray foam, vapour barrier" },
  { name: "Flooring",            icon: "🪵", description: "Subfloor, vinyl, wood, carpet" },
  { name: "Wall Cladding",       icon: "🪣", description: "Ply lining, tongue & groove, panelling" },
  { name: "Ceiling",             icon: "🏠", description: "Lining, lighting recesses, headlining" },
  { name: "Bed & Sleeping",      icon: "🛏️", description: "Bed frame, mattress, storage underneath" },
  { name: "Cabinetry",           icon: "🗄️", description: "Kitchen units, overhead storage, shelving" },
  { name: "Kitchen",             icon: "🍳", description: "Hob, sink, worktop, utensil storage" },
  { name: "Heating",             icon: "🔥", description: "Diesel heater, gas, underfloor heating" },
  { name: "Ventilation",         icon: "💨", description: "Roof fan, vents, condensation control" },
  { name: "Lighting",            icon: "💡", description: "LED strips, spotlights, switches" },
  { name: "Windows & Skylights", icon: "🪟", description: "Side windows, roof lights, blinds" },
  { name: "Doors",               icon: "🚪", description: "Barn doors, sliding, sliding mechanism" },
  { name: "Garage & Storage",    icon: "📦", description: "Rear garage, under-bed, racking" },
  { name: "Seating & Lounge",    icon: "🛋️", description: "Seat cushions, sofa conversion, table" },
  { name: "Exterior",            icon: "🚐", description: "Roof rack, awning, bodywork, paint" },
  { name: "Safety & Security",   icon: "🔒", description: "Locks, alarm, CO detector, fire ext." },
  { name: "Connectivity",        icon: "📡", description: "WiFi booster, mobile data, TV aerial" },
  { name: "Tools & Equipment",   icon: "🔧", description: "Build tools, fixings, adhesives" },
  { name: "Custom",              icon: "✏️", description: "Add your own category" },
];

// ---------- IMAGE SLUG ----------
// e.g. "Wall Cladding" → "wall-cladding"
// You put JPGs at: images/wall-cladding.jpg in your GitHub repo
function categorySlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------- STATE ----------
let state = { categories: [] };
let currentUser = null;
let unsubSnapshot = null;
let cardObserver = null;

// ---------- UTIL ----------
const uid = () => crypto.randomUUID();

// ---------- FIRESTORE SYNC ----------
let saveTimer = null;

function scheduleWrite() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!currentUser) return;
    setSyncStatus("saving");
    setDoc(PROJECT_DOC, { categories: state.categories })
      .then(() => setSyncStatus("saved"))
      .catch(err => { console.error("Write failed:", err); setSyncStatus("error"); });
  }, 800);
}

function setSyncStatus(status) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const map = {
    saving: { text: "Saving…",       colour: "var(--text-3)" },
    saved:  { text: "Saved ✓",       colour: "var(--green)"  },
    error:  { text: "Save failed ✗", colour: "var(--red)"    },
    live:   { text: "Live",          colour: "var(--amber)"  },
  };
  const s = map[status] || map.live;
  el.textContent = s.text;
  el.style.color  = s.colour;
}

function startListening() {
  if (unsubSnapshot) unsubSnapshot();
  unsubSnapshot = onSnapshot(PROJECT_DOC, snap => {
    state = snap.exists() ? snap.data() : { categories: [] };
    render();
    setSyncStatus("live");
  }, err => { console.error("Snapshot error:", err); setSyncStatus("error"); });
}

function stopListening() {
  if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
}

// ---------- AUTH ----------
const GOOGLE_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0">
  <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.8l6-6C34.5 3.1 29.6 1 24 1 14.8 1 7 6.7 3.7 14.8l7 5.4C12.4 13.5 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/>
  <path fill="#FBBC05" d="M10.7 28.6A14.7 14.7 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7-5.4A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8.1-6.2z"/>
  <path fill="#34A853" d="M24 47c5.6 0 10.3-1.8 13.7-5L30.3 36.3c-1.9 1.3-4.3 2.1-6.8 2.1-6.3 0-11.6-4.2-13.5-10l-8.1 6.2C5.9 41.6 14.3 47 24 47z"/>
</svg>`;

function attachSignIn(btnId) {
  const btn = document.getElementById(btnId);
  if (btn) btn.addEventListener("click", () => signIn().catch(err => console.error("Sign-in failed:", err)));
}

function renderAuthBar(user) {
  if (!authEl) return;
  if (user) {
    const gate = document.getElementById("sign-in-gate");
    if (gate) gate.remove();

    authEl.innerHTML = `
      <div class="auth-user">
        <img class="auth-avatar" src="${user.photoURL || ""}" alt="${user.displayName}" />
        <span class="auth-name">${user.displayName}</span>
        <span id="sync-status" class="sync-status">Live</span>
        <button class="btn-secondary btn-sm" id="sign-out-btn">Sign out</button>
      </div>
    `;
    document.getElementById("sign-out-btn").addEventListener("click", () => signOut());
  } else {
    authEl.innerHTML = "";
    if (!document.getElementById("sign-in-gate")) {
      const gate = document.createElement("div");
      gate.id = "sign-in-gate";
      gate.innerHTML = `
        <div class="sign-in-card">
          <div class="sign-in-logo">🚐</div>
          <h2 class="sign-in-title">Van Build Planner</h2>
          <p class="sign-in-sub">Sign in to access your shared build tracker.</p>
          <button class="btn-google-large" id="sign-in-btn-gate">
            ${GOOGLE_SVG}
            Sign in with Google
          </button>
          <p class="sign-in-note">Only authorised accounts can access this project.</p>
        </div>
      `;
      document.body.appendChild(gate);
      attachSignIn("sign-in-btn-gate");
    }
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  renderAuthBar(user);
  if (user) {
    startListening();
    appEl.style.display = "";
  } else {
    stopListening();
    state = { categories: [] };
    appEl.style.display = "none";
    appEl.innerHTML = "";
  }
});

// ---------- SIDEBAR TOGGLE ----------
function openSidebar() {
  sidebar.classList.add("open");
  sidebarOverlay.classList.add("visible");
}
function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("visible");
}

hamburger.addEventListener("click", () => {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});
sidebarOverlay.addEventListener("click", closeSidebar);

// ---------- ACTIONS ----------
function setState(newState) {
  state = newState;
  render();
  scheduleWrite();
}

async function addCategory() {
  const usedNames = new Set(state.categories.map(c => c.name));
  const result = await showCategoryPicker(usedNames);
  if (!result) return;

  setState({
    ...state,
    categories: [...state.categories, {
      id: uid(),
      name: result.trim(),
      icon: PRESET_CATEGORIES.find(p => p.name === result.trim())?.icon || "📁",
      complete: false,
      items: []
    }]
  });
}

function showCategoryPicker(usedNames) {
  return new Promise(resolve => {
    modalResolve = resolve;

    const optionsHTML = PRESET_CATEGORIES.map(p => {
      const used = usedNames.has(p.name);
      return `
        <div class="cat-option ${used ? "cat-option-used" : ""}"
             data-pick="${used ? "" : p.name}"
             title="${p.description}">
          <span class="cat-icon">${p.icon}</span>
          <div class="cat-info">
            <span class="cat-name">${p.name}</span>
            <span class="cat-desc">${p.description}</span>
          </div>
          ${used ? '<span class="cat-used-badge">Added</span>' : ""}
        </div>`;
    }).join("");

    document.getElementById("modal-overlay").innerHTML = `
      <div class="modal modal-wide">
        <h3 class="modal-title">Add a Category</h3>
        <div class="cat-grid">${optionsHTML}</div>
        <div id="custom-name-wrap" style="display:none; margin-top:14px;">
          <input id="custom-cat-input" class="modal-input" type="text"
            placeholder="Enter category name…"
            style="width:100%;box-sizing:border-box;" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-modal="cancel">Cancel</button>
          <button type="button" class="btn-primary" id="cat-confirm-btn" disabled>Add Category</button>
        </div>
      </div>
    `;
    document.getElementById("modal-overlay").style.display = "flex";

    let selected = null;

    document.querySelectorAll(".cat-option:not(.cat-option-used)").forEach(el => {
      el.addEventListener("click", () => {
        document.querySelectorAll(".cat-option").forEach(o => o.classList.remove("cat-option-active"));
        el.classList.add("cat-option-active");
        selected = el.dataset.pick;
        const customWrap = document.getElementById("custom-name-wrap");
        const confirmBtn = document.getElementById("cat-confirm-btn");
        customWrap.style.display = selected === "Custom" ? "block" : "none";
        if (selected === "Custom") document.getElementById("custom-cat-input").focus();
        confirmBtn.disabled = false;
      });
    });

    document.getElementById("cat-confirm-btn").addEventListener("click", () => {
      if (!selected) return;
      if (selected === "Custom") {
        const val = document.getElementById("custom-cat-input").value.trim();
        if (!val) { document.getElementById("custom-cat-input").focus(); return; }
        closeModal(val);
      } else {
        closeModal(selected);
      }
    });
  });
}

async function removeCategory(categoryId) {
  const confirmed = await showConfirm("Remove this category and all its items?");
  if (!confirmed) return;
  setState({ ...state, categories: state.categories.filter(c => c.id !== categoryId) });
}

async function addItem(categoryId) {
  const result = await showModal([
    { name: "name", label: "Item Name", required: true, placeholder: "e.g. Leisure Battery, Roof Vent…" }
  ], "New Item");
  if (!result) return;
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: [...cat.items, { id: uid(), name: result.name.trim() || "New Item", selectedOptionId: null, options: [] }] }
        : cat
    )
  });
}

async function removeItem(categoryId, itemId) {
  const confirmed = await showConfirm("Remove this item and all its options?");
  if (!confirmed) return;
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId ? { ...cat, items: cat.items.filter(i => i.id !== itemId) } : cat
    )
  });
}

async function addOption(categoryId, itemId) {
  const result = await showModal([
    { name: "name", label: "Option Name", required: true, placeholder: "e.g. Renogy 100W Panel" },
    { name: "cost", label: "Cost (£)", type: "number", placeholder: "0.00" },
    { name: "url",  label: "URL", placeholder: "https://…" }
  ], "New Option");
  if (!result) return;
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(item =>
            item.id === itemId
              ? { ...item, options: [...item.options, { id: uid(), name: result.name.trim() || "New Option", cost: parseFloat(result.cost) || 0, url: result.url.trim(), image: "" }] }
              : item
          )}
        : cat
    )
  });
}

async function removeOption(categoryId, itemId, optionId) {
  const confirmed = await showConfirm("Remove this option?");
  if (!confirmed) return;
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(item =>
            item.id === itemId
              ? { ...item, options: item.options.filter(o => o.id !== optionId) }
              : item
          )}
        : cat
    )
  });
}

function selectOption(categoryId, itemId, optionId) {
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(item =>
            item.id === itemId ? { ...item, selectedOptionId: optionId } : item
          )}
        : cat
    )
  });
}

// ---------- MODAL ----------
let modalResolve = null;

function showModal(fields, title) {
  return new Promise(resolve => {
    modalResolve = resolve;
    const fieldsHTML = fields.map(f => `
      <label class="modal-label">
        ${f.label}
        <input type="${f.type || "text"}" name="${f.name}" class="modal-input"
          value="${f.default || ""}" placeholder="${f.placeholder || ""}" ${f.required ? "required" : ""} />
      </label>`).join("");

    document.getElementById("modal-overlay").innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <form id="modal-form">
          ${fieldsHTML}
          <div class="modal-actions">
            <button type="button" class="btn-secondary" data-modal="cancel">Cancel</button>
            <button type="submit" class="btn-primary">Confirm</button>
          </div>
        </form>
      </div>
    `;
    document.getElementById("modal-overlay").style.display = "flex";
    setTimeout(() => { const f = document.querySelector("#modal-form input"); if (f) f.focus(); }, 50);
  });
}

function showConfirm(message) {
  return new Promise(resolve => {
    modalResolve = resolve;
    document.getElementById("modal-overlay").innerHTML = `
      <div class="modal">
        <p class="modal-confirm-msg">${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-modal="cancel">Cancel</button>
          <button type="button" class="btn-danger" data-modal="confirm">Remove</button>
        </div>
      </div>
    `;
    document.getElementById("modal-overlay").style.display = "flex";
  });
}

function closeModal(result) {
  document.getElementById("modal-overlay").style.display = "none";
  document.getElementById("modal-overlay").innerHTML = "";
  if (modalResolve) { modalResolve(result); modalResolve = null; }
}

document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) closeModal(null);
  if (e.target.dataset.modal === "cancel")  closeModal(null);
  if (e.target.dataset.modal === "confirm") closeModal(true);
});

document.getElementById("modal-overlay").addEventListener("submit", e => {
  if (e.target.id === "modal-form") {
    e.preventDefault();
    closeModal(Object.fromEntries(new FormData(e.target)));
  }
});

// ---------- RENDER ----------
function render() {
  renderSidebar();
  renderCarousel();
}

function renderSidebar() {
  const nav = document.getElementById("sidebar-nav");
  if (!nav) return;

  if (state.categories.length === 0) {
    nav.innerHTML = `<li class="sidebar-empty">No categories yet</li>`;
    return;
  }

  nav.innerHTML = state.categories.map(cat => `
    <li class="nav-item" data-nav-category="${cat.id}" title="${cat.name}">
      <span class="nav-item-icon">${cat.icon || "📁"}</span>
      <span class="nav-item-name">${cat.name}</span>
    </li>
  `).join("");

  nav.querySelectorAll(".nav-item").forEach(el => {
    el.addEventListener("click", () => {
      scrollToCard(el.dataset.navCategory);
      closeSidebar();
    });
  });
}

function renderCarousel() {
  if (state.categories.length === 0) {
    appEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🚐</div>
        <p>Add your first category to get started.</p>
      </div>
    `;
    return;
  }

  appEl.innerHTML = `
    <div class="carousel" id="carousel">
      ${state.categories.map(renderCard).join("")}
    </div>
  `;

  setupCardObserver();
}

function renderCard(category) {
  const slug = categorySlug(category.name);
  const imgSrc = `images/${slug}.jpg`;

  return `
    <div class="card" data-category="${category.id}">
      <div class="card-hero">
        <img
          class="card-hero-img"
          src="${imgSrc}"
          alt="${category.name}"
          onerror="this.style.display='none'"
          onload="this.classList.add('loaded')"
        />
        <div class="card-hero-overlay"></div>
        <div class="card-hero-title">${category.icon || ""} ${category.name}</div>
        <div class="card-hero-actions">
          <button class="btn-danger-sm" data-action="remove-category" data-category="${category.id}">✕ Remove</button>
        </div>
      </div>

      <div class="card-body">
        ${category.items.length === 0
          ? `<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px 0">No items yet</p>`
          : category.items.map(item => renderItem(category, item)).join("")
        }
      </div>

      <div class="card-body-footer">
        <button class="btn-secondary btn-sm" style="width:100%" data-action="add-item" data-category="${category.id}">
          + Add Item
        </button>
      </div>
    </div>
  `;
}

function renderItem(category, item) {
  return `
    <div class="item">
      <div class="item-header">
        <strong>${item.name}</strong>
        <div class="item-actions">
          <button class="btn-secondary btn-sm" data-action="add-option" data-category="${category.id}" data-item="${item.id}">+ Option</button>
          <button class="btn-danger-sm" data-action="remove-item" data-category="${category.id}" data-item="${item.id}">✕</button>
        </div>
      </div>
      ${item.options.map(option => renderOption(category, item, option)).join("")}
    </div>
  `;
}

function renderOption(category, item, option) {
  const urlHTML = option.url
    ? `<a href="${option.url}" target="_blank" rel="noopener" class="option-link">↗</a>`
    : "";
  return `
    <div class="option ${item.selectedOptionId === option.id ? "option-selected" : ""}">
      <input type="radio" name="radio-${item.id}"
        ${item.selectedOptionId === option.id ? "checked" : ""}
        data-action="select-option"
        data-category="${category.id}" data-item="${item.id}" data-option="${option.id}" />
      <span class="option-name">${option.name}</span>
      <span class="option-cost">£${option.cost.toFixed(2)}</span>
      ${urlHTML}
      <button class="btn-danger-sm" data-action="remove-option"
        data-category="${category.id}" data-item="${item.id}" data-option="${option.id}">✕</button>
    </div>
  `;
}

// ---------- CAROUSEL HELPERS ----------
function scrollToCard(categoryId) {
  const card = document.querySelector(`.card[data-category="${categoryId}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
}

function setupCardObserver() {
  if (cardObserver) cardObserver.disconnect();
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  cardObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.dataset.category;
        document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("nav-item-active"));
        const navItem = document.querySelector(`.nav-item[data-nav-category="${id}"]`);
        if (navItem) navItem.classList.add("nav-item-active");
      }
    });
  }, { threshold: 0.5, root: carousel });

  document.querySelectorAll(".card").forEach(card => cardObserver.observe(card));
}

// ---------- EVENT DELEGATION ----------
// Sidebar add-category button
document.getElementById("sidebar").addEventListener("click", e => {
  if (e.target.closest("[data-action='add-category']")) addCategory();
});

// Main app area
appEl.addEventListener("click", e => {
  const el     = e.target.closest("[data-action]");
  if (!el) return;
  const action   = el.dataset.action;
  const { category, item, option } = el.dataset;

  if (action === "add-category")    addCategory();
  if (action === "remove-category") removeCategory(category);
  if (action === "add-item")        addItem(category);
  if (action === "remove-item")     removeItem(category, item);
  if (action === "add-option")      addOption(category, item);
  if (action === "remove-option")   removeOption(category, item, option);
  if (action === "select-option")   selectOption(category, item, option);
});