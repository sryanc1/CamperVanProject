import { db } from "./firebase.js";

const appEl = document.getElementById("app");

// ---------- PREDEFINED CATEGORIES ----------
const PRESET_CATEGORIES = [
  { name: "Electrical",         icon: "⚡", description: "Battery, inverter, solar, wiring, lighting" },
  { name: "Plumbing",           icon: "🚿", description: "Water tank, pump, pipes, sink" },
  { name: "Flooring",           icon: "🪵", description: "Subfloor, vinyl, wood, carpet" },
  { name: "Wall Cladding",      icon: "🪣", description: "Ply lining, tongue & groove, panelling, insulation" },
  { name: "Bed & Sleeping",     icon: "🛏️", description: "Bed frame, mattress, storage underneath" },
  { name: "Cabinetry",          icon: "🗄️", description: "Kitchen units, overhead storage, shelving" },
  { name: "Ventilation",        icon: "💨", description: "Roof fan, vents, condensation control" },
  { name: "Windows & Skylights",icon: "🪟", description: "Side windows, roof lights, blinds" },
  { name: "Garage & Storage",   icon: "📦", description: "Rear garage, under-bed, racking" },
  { name: "Seating & Lounge",   icon: "🛋️", description: "Seat cushions, sofa conversion, table" },
  { name: "Exterior",           icon: "🚐", description: "Roof rack, awning, bodywork, paint" },
  { name: "Custom",             icon: "✏️", description: "Add your own category" },
];

// ---------- STATE ----------
let state = {
  categories: []
};

// ---------- UTIL ----------
const uid = () => crypto.randomUUID();

function setState(newState) {
  state = newState;
  render();
}

// ---------- MODAL ----------
let modalResolve = null;

function showModal(fields, title) {
  return new Promise(resolve => {
    modalResolve = resolve;

    const fieldsHTML = fields.map(f => {
      if (f.type === "textarea") {
        return `
          <label class="modal-label">
            ${f.label}
            <textarea name="${f.name}" class="modal-input" rows="2">${f.default || ""}</textarea>
          </label>`;
      }
      return `
        <label class="modal-label">
          ${f.label}
          <input 
            type="${f.type || "text"}" 
            name="${f.name}" 
            class="modal-input" 
            value="${f.default || ""}"
            placeholder="${f.placeholder || ""}"
            ${f.required ? "required" : ""}
          />
        </label>`;
    }).join("");

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

    // Focus first input
    setTimeout(() => {
      const first = document.querySelector("#modal-form input, #modal-form textarea");
      if (first) first.focus();
    }, 50);
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
  if (modalResolve) {
    modalResolve(result);
    modalResolve = null;
  }
}

// Modal event delegation
document.getElementById("modal-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("modal-overlay")) {
    closeModal(null);
  }
  if (e.target.dataset.modal === "cancel") closeModal(null);
  if (e.target.dataset.modal === "confirm") closeModal(true);
});

document.getElementById("modal-overlay").addEventListener("submit", e => {
  if (e.target.id === "modal-form") {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    closeModal(data);
  }
});

// ---------- ACTIONS ----------
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

        if (selected === "Custom") {
          customWrap.style.display = "block";
          document.getElementById("custom-cat-input").focus();
        } else {
          customWrap.style.display = "none";
        }
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

  setState({
    ...state,
    categories: state.categories.filter(c => c.id !== categoryId)
  });
}

async function addItem(categoryId) {
  const result = await showModal([
    { name: "name", label: "Item Name", required: true, placeholder: "e.g. Leisure Battery, Roof Vent…" }
  ], "New Item");
  if (!result) return;

  const newItem = {
    id: uid(),
    name: result.name.trim() || "New Item",
    selectedOptionId: null,
    options: []
  };

  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: [...cat.items, newItem] }
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
      cat.id === categoryId
        ? { ...cat, items: cat.items.filter(i => i.id !== itemId) }
        : cat
    )
  });
}

async function addOption(categoryId, itemId) {
  const result = await showModal([
    { name: "name",  label: "Option Name", required: true, placeholder: "e.g. Renogy 100W Panel" },
    { name: "cost",  label: "Cost (£)", type: "number", placeholder: "0.00" },
    { name: "url",   label: "URL", placeholder: "https://…" }
  ], "New Option");
  if (!result) return;

  const newOption = {
    id: uid(),
    name: result.name.trim() || "New Option",
    cost: parseFloat(result.cost) || 0,
    url: result.url.trim(),
    image: ""
  };

  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? {
            ...cat,
            items: cat.items.map(item =>
              item.id === itemId
                ? { ...item, options: [...item.options, newOption] }
                : item
            )
          }
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
        ? {
            ...cat,
            items: cat.items.map(item =>
              item.id === itemId
                ? { ...item, options: item.options.filter(o => o.id !== optionId) }
                : item
            )
          }
        : cat
    )
  });
}

function selectOption(categoryId, itemId, optionId) {
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? {
            ...cat,
            items: cat.items.map(item =>
              item.id === itemId
                ? { ...item, selectedOptionId: optionId }
                : item
            )
          }
        : cat
    )
  });
}

// ---------- RENDER ----------
function render() {
  appEl.innerHTML = `
    <div class="categories-toolbar">
      <h2>Categories</h2>
      <button class="btn-primary" data-action="add-category">+ Add Category</button>
    </div>
    ${state.categories.map(renderCategory).join("")}
  `;
}

function renderCategory(category) {
  return `
    <div class="category">
      <div class="category-header">
        <h2>${category.icon || ""} ${category.name}</h2>
        <div class="header-actions">
          <button class="btn-secondary" data-action="add-item" data-category="${category.id}">+ Add Item</button>
          <button class="btn-danger-sm" data-action="remove-category" data-category="${category.id}">✕ Remove</button>
        </div>
      </div>
      <div class="category-body">
        ${category.items.map(item => renderItem(category, item)).join("")}
      </div>
    </div>
  `;
}

function renderItem(category, item) {
  return `
    <div class="item">
      <div class="item-header">
        <strong>${item.name}</strong>
        <div class="header-actions">
          <button class="btn-secondary btn-sm" data-action="add-option" data-category="${category.id}" data-item="${item.id}">+ Add Option</button>
          <button class="btn-danger-sm" data-action="remove-item" data-category="${category.id}" data-item="${item.id}">✕</button>
        </div>
      </div>
      ${item.options.map(option => renderOption(category, item, option)).join("")}
    </div>
  `;
}

function renderOption(category, item, option) {
  const checked = item.selectedOptionId === option.id ? "checked" : "";
  const urlHTML = option.url
    ? `<a href="${option.url}" target="_blank" rel="noopener" class="option-link">↗ Link</a>`
    : "";

  return `
    <div class="option ${item.selectedOptionId === option.id ? "option-selected" : ""}">
      <input 
        type="radio" 
        name="radio-${item.id}" 
        ${checked}
        data-action="select-option"
        data-category="${category.id}"
        data-item="${item.id}"
        data-option="${option.id}"
      />
      <span class="option-name">${option.name}</span>
      <span class="option-cost">£${option.cost.toFixed(2)}</span>
      ${urlHTML}
      <button class="btn-danger-sm" data-action="remove-option" data-category="${category.id}" data-item="${item.id}" data-option="${option.id}">✕</button>
    </div>
  `;
}

// ---------- EVENT DELEGATION ----------
appEl.addEventListener("click", e => {
  const action = e.target.dataset.action;
  if (!action) return;

  const { category, item, option } = e.target.dataset;

  if (action === "add-category")    addCategory();
  if (action === "remove-category") removeCategory(category);
  if (action === "add-item")        addItem(category);
  if (action === "remove-item")     removeItem(category, item);
  if (action === "add-option")      addOption(category, item);
  if (action === "remove-option")   removeOption(category, item, option);
  if (action === "select-option")   selectOption(category, item, option);
});

// ---------- INIT ----------
render();
