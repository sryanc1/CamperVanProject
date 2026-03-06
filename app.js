// ── app.js ───────────────────────────────────────────────────
// Entry point. Wires modules together and handles UI events.

import { render }           from "./js/render.js";
import { initSync }         from "./js/sync.js";
import { initModalListeners } from "./js/modal.js";
import { initAuth }         from "./js/auth.js";
import {
  addCategory, removeCategory,
  addItem,     removeItem,
  addOption,   editOption,   removeOption,
  selectOption,
  setBudget, togglePurchased, updateCategoryNotes,
} from "./js/actions.js";

// ── Bootstrap ────────────────────────────────────────────────
initSync(render);           // tell sync.js how to trigger a re-render
initModalListeners();       // wire modal overlay click/submit handlers
initAuth();                 // start Firebase auth listener

// Budget input — debounced so it doesn't write on every keystroke
const budgetInput = document.getElementById("budget-input");
let budgetTimer = null;
budgetInput.addEventListener("input", () => {
  clearTimeout(budgetTimer);
  budgetTimer = setTimeout(() => setBudget(budgetInput.value), 600);
});

// ── Sidebar toggle ───────────────────────────────────────────
const sidebar        = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const hamburger      = document.getElementById("hamburger");

const openSidebar  = () => { sidebar.classList.add("open");    sidebarOverlay.classList.add("visible"); };
const closeSidebar = () => { sidebar.classList.remove("open"); sidebarOverlay.classList.remove("visible"); };

hamburger.addEventListener("click", () =>
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar()
);
sidebarOverlay.addEventListener("click", closeSidebar);

// ── Floor plan drawer toggle ─────────────────────────────────
const floorplanBtn    = document.getElementById("floorplan-btn");
const floorplanDrawer = document.getElementById("floorplan-drawer");

floorplanBtn.addEventListener("click", () => {
  const isOpen = floorplanDrawer.classList.toggle("open");
  floorplanBtn.classList.toggle("active", isOpen);
  floorplanBtn.setAttribute("aria-expanded", isOpen);
  floorplanDrawer.setAttribute("aria-hidden", !isOpen);
});

// ── Event delegation ─────────────────────────────────────────
const appEl = document.getElementById("app");

// Sidebar "Add Category" button
document.getElementById("sidebar").addEventListener("click", e => {
  if (e.target.closest("[data-action='add-category']")) addCategory();
});

// Category notes — save on input (debounced)
let notesTimer = null;
appEl.addEventListener("input", e => {
  const el = e.target.closest("[data-action='edit-category-notes']");
  if (!el) return;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    updateCategoryNotes(el.dataset.category, el.value);
  }, 600);
});

// Main carousel area
appEl.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, category, item, option } = el.dataset;

  if (action === "add-category")    addCategory();
  if (action === "remove-category") removeCategory(category);
  if (action === "add-item")        addItem(category);
  if (action === "remove-item")     removeItem(category, item);
  if (action === "add-option")      addOption(category, item);
  if (action === "edit-option")      editOption(category, item, option);
  if (action === "remove-option")    removeOption(category, item, option);
  if (action === "select-option")    selectOption(category, item, option);
  if (action === "toggle-purchased") togglePurchased(category, item, option);
  if (action === "toggle-notes") {
    const panel = document.getElementById(`cat-notes-${category}`);
    if (panel) {
      const open = panel.style.display === "none";
      panel.style.display = open ? "block" : "none";
      if (open) panel.querySelector("textarea")?.focus();
    }
  }
  if (action === "toggle-item") {
    if (e.target.closest("button")) return;
    const itemEl = appEl.querySelector(`.item[data-item-id="${item}"]`)
      || el.closest(".item");
    if (itemEl) itemEl.classList.toggle("item-collapsed");
  }
});