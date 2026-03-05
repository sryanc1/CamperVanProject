// ── actions.js ───────────────────────────────────────────────
// All state-mutating actions. setState lives here because it's
// the only module that needs render + scheduleWrite together.

import { getState, updateState, uid, PRESET_CATEGORIES } from "./state.js";
import { scheduleWrite }    from "./sync.js";
import { render }           from "./render.js";
import { showModal, showConfirm, closeModal } from "./modal.js";

// Central setState — update → render → persist
export function setState(newState) {
  updateState(newState);
  render();
  scheduleWrite();
}

// ── Categories ───────────────────────────────────────────────
export async function addCategory() {
  const state    = getState();
  const usedNames = new Set(state.categories.map(c => c.name));
  const result   = await showCategoryPicker(usedNames);
  if (!result) return;
  setState({
    ...state,
    categories: [...state.categories, {
      id:       uid(),
      name:     result.trim(),
      icon:     PRESET_CATEGORIES.find(p => p.name === result.trim())?.icon || "📁",
      complete: false,
      items:    [],
    }],
  });
}

export async function removeCategory(categoryId) {
  if (!await showConfirm("Remove this category and all its items?")) return;
  const state = getState();
  setState({ ...state, categories: state.categories.filter(c => c.id !== categoryId) });
}

// ── Items ────────────────────────────────────────────────────
export async function addItem(categoryId) {
  const result = await showModal([
    { name: "name", label: "Item Name", required: true, placeholder: "e.g. Leisure Battery, Roof Vent…" },
  ], "New Item");
  if (!result) return;
  const state = getState();
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: [...cat.items, { id: uid(), name: result.name.trim() || "New Item", selectedOptionId: null, options: [] }] }
        : cat
    ),
  });
}

export async function removeItem(categoryId, itemId) {
  if (!await showConfirm("Remove this item and all its options?")) return;
  const state = getState();
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId ? { ...cat, items: cat.items.filter(i => i.id !== itemId) } : cat
    ),
  });
}

// ── Options ──────────────────────────────────────────────────
export async function addOption(categoryId, itemId) {
  const result = await showModal([
    { name: "name",     label: "Option Name", required: true, placeholder: "e.g. Renogy 100W Panel" },
    { name: "cost",     label: "Cost ($)",    type: "number", placeholder: "0.00" },
    { name: "quantity", label: "Quantity",    type: "number", placeholder: "1" },
    { name: "url",      label: "Product URL", placeholder: "https://…" },
    { name: "notes",    label: "Notes",       placeholder: "Specs, dimensions, supplier notes…" },
  ], "New Option");
  if (!result) return;
  const state = getState();
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(item =>
            item.id === itemId
              ? { ...item, options: [...item.options, {
                  id:       uid(),
                  name:     result.name.trim()  || "New Option",
                  cost:     parseFloat(result.cost)     || 0,
                  quantity: parseInt(result.quantity)   || 1,
                  url:      result.url.trim(),
                  notes:    result.notes.trim(),
                  image:    "",
                }] }
              : item
          )}
        : cat
    ),
  });
}

export async function removeOption(categoryId, itemId, optionId) {
  if (!await showConfirm("Remove this option?")) return;
  const state = getState();
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
    ),
  });
}

export function selectOption(categoryId, itemId, optionId) {
  const state = getState();
  setState({
    ...state,
    categories: state.categories.map(cat =>
      cat.id === categoryId
        ? { ...cat, items: cat.items.map(item =>
            item.id === itemId ? { ...item, selectedOptionId: optionId } : item
          )}
        : cat
    ),
  });
}

// ── Category picker modal ────────────────────────────────────
export function showCategoryPicker(usedNames) {
  return new Promise(resolve => {
    // Borrow modal infrastructure via closeModal
    const overlay = document.getElementById("modal-overlay");
    let selected  = null;

    const optionsHTML = PRESET_CATEGORIES.map(p => {
      const used = usedNames.has(p.name);
      return `
        <div class="cat-option ${used ? "cat-option-used" : ""}"
             data-pick="${used ? "" : p.name}" title="${p.description}">
          <span class="cat-icon">${p.icon}</span>
          <div class="cat-info">
            <span class="cat-name">${p.name}</span>
            <span class="cat-desc">${p.description}</span>
          </div>
          ${used ? '<span class="cat-used-badge">Added</span>' : ""}
        </div>`;
    }).join("");

    overlay.innerHTML = `
      <div class="modal modal-wide">
        <h3 class="modal-title">Add a Category</h3>
        <div class="cat-grid">${optionsHTML}</div>
        <div id="custom-name-wrap" style="display:none;margin-top:14px;">
          <input id="custom-cat-input" class="modal-input" type="text"
            placeholder="Enter category name…" style="width:100%;box-sizing:border-box;" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="cat-cancel-btn">Cancel</button>
          <button type="button" class="btn-primary"   id="cat-confirm-btn" disabled>Add Category</button>
        </div>
      </div>`;
    overlay.style.display = "flex";

    document.querySelectorAll(".cat-option:not(.cat-option-used)").forEach(el => {
      el.addEventListener("click", () => {
        document.querySelectorAll(".cat-option").forEach(o => o.classList.remove("cat-option-active"));
        el.classList.add("cat-option-active");
        selected = el.dataset.pick;
        document.getElementById("custom-name-wrap").style.display = selected === "Custom" ? "block" : "none";
        if (selected === "Custom") document.getElementById("custom-cat-input").focus();
        document.getElementById("cat-confirm-btn").disabled = false;
      });
    });

    const done = val => { overlay.style.display = "none"; overlay.innerHTML = ""; resolve(val); };

    document.getElementById("cat-cancel-btn").addEventListener("click",  () => done(null));
    document.getElementById("cat-confirm-btn").addEventListener("click", () => {
      if (!selected) return;
      if (selected === "Custom") {
        const val = document.getElementById("custom-cat-input").value.trim();
        if (!val) { document.getElementById("custom-cat-input").focus(); return; }
        done(val);
      } else { done(selected); }
    });
  });
}