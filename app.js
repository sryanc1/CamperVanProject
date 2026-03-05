// ── app.js ───────────────────────────────────────────────────
// Entry point. Wires modules together and handles UI events.

import { render }           from "./js/render.js";
import { initSync }         from "./js/sync.js";
import { initModalListeners } from "./js/modal.js";
import { initAuth }         from "./js/auth.js";
import {
  addCategory, removeCategory,
  addItem,     removeItem,
  addOption,   removeOption,
  selectOption,
} from "./js/actions.js";

// ── Bootstrap ────────────────────────────────────────────────
initSync(render);           // tell sync.js how to trigger a re-render
initModalListeners();       // wire modal overlay click/submit handlers
initAuth();                 // start Firebase auth listener

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
  if (action === "remove-option")   removeOption(category, item, option);
  if (action === "select-option")   selectOption(category, item, option);
});