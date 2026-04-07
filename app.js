// ── app.js ───────────────────────────────────────────────────
// Entry point. Wires modules together and handles UI events.

import { render, openDashboard, closeDashboard, renderDashboardPublic } from "./js/render.js";
import { getState }         from "./js/state.js";
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

// Budget input - debounced so it doesn't write on every keystroke
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
const budgetBtn       = document.getElementById("budget-btn");
const budgetDrawer    = document.getElementById("budget-drawer");

function toggleDrawer(btn, drawer, ...others) {
  const isOpen = drawer.classList.toggle("open");
  btn.classList.toggle("active", isOpen);
  btn.setAttribute("aria-expanded", isOpen);
  drawer.setAttribute("aria-hidden", !isOpen);
  // Close all other drawers in pairs [btn, drawer, btn, drawer ...]
  if (isOpen) {
    for (let i = 0; i < others.length; i += 2) {
      const oBtn = others[i], oDrawer = others[i + 1];
      if (oDrawer?.classList.contains("open")) {
        oDrawer.classList.remove("open");
        oBtn.classList.remove("active");
        oDrawer.setAttribute("aria-hidden", true);
      }
    }
  }
}

floorplanBtn.addEventListener("click", () => toggleDrawer(floorplanBtn, floorplanDrawer, budgetBtn, budgetDrawer, dashboardBtn, dashboardDrawer));
budgetBtn.addEventListener("click",    () => toggleDrawer(budgetBtn, budgetDrawer, floorplanBtn, floorplanDrawer, dashboardBtn, dashboardDrawer));

const dashboardDrawer = document.getElementById("dashboard-modal");
const dashboardBtn    = document.getElementById("dashboard-btn");
const dashboardClose  = document.getElementById("dashboard-close");

dashboardBtn.addEventListener("click", () =>
  toggleDrawer(dashboardBtn, dashboardDrawer, floorplanBtn, floorplanDrawer, budgetBtn, budgetDrawer));

// Re-render dashboard content each time it opens so data is fresh
document.getElementById("dashboard-modal").addEventListener("transitionend", () => {
  if (dashboardDrawer.classList.contains("open")) renderDashboardPublic();
});
dashboardClose.addEventListener("click", () => {
  dashboardDrawer.classList.remove("open");
  dashboardBtn.classList.remove("active");
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
  if (action === "edit-option")      editOption(category, item, option);
  if (action === "remove-option")    removeOption(category, item, option);
  if (action === "select-option") {
    // Radio buttons don't fire when re-clicking an already-checked input.
    // We intercept the click before the browser sets checked, so e.target.checked
    // still reflects the *previous* state - if it was already checked, deselect.
    e.preventDefault();
    selectOption(category, item, option);
  }
  if (action === "toggle-purchased") togglePurchased(category, item, option);
  if (action === "toggle-notes") {
    const panel = document.getElementById(`cat-notes-${category}`);
    if (panel) {
      const open = panel.style.display === "none";
      panel.style.display = open ? "block" : "none";
      if (open) panel.querySelector("textarea")?.focus();
    }
  }
  if (action === "save-category-notes") {
    const panel = document.getElementById(`cat-notes-${category}`);
    if (!panel) return;
    const textarea   = panel.querySelector(".cat-notes-textarea");
    const savedEl    = panel.querySelector(".cat-notes-saved");
    const conflictEl = panel.querySelector(".cat-notes-conflict");
    const notes      = textarea?.value || "";
    updateCategoryNotes(category, notes);
    // Update the saved marker so future conflict checks use the new baseline
    panel.dataset.savedNotes = notes;
    conflictEl.style.display = "none";
    savedEl.style.display    = "inline";
    setTimeout(() => { savedEl.style.display = "none"; }, 2000);
  }
  if (action === "notes-discard") {
    const panel = document.getElementById(`cat-notes-${category}`);
    if (!panel) return;
    const textarea   = panel.querySelector(".cat-notes-textarea");
    const conflictEl = panel.querySelector(".cat-notes-conflict");
    // Reset textarea to whatever Firestore currently has
    const current = getState().categories.find(c => c.id === category);
    if (textarea && current) {
      textarea.value       = current.notes || "";
      panel.dataset.savedNotes = current.notes || "";
    }
    conflictEl.style.display = "none";
  }
  if (action === "toggle-item") {
    if (e.target.closest("button")) return;
    const itemEl = appEl.querySelector(`.item[data-item-id="${item}"]`)
      || el.closest(".item");
    if (itemEl) itemEl.classList.toggle("item-collapsed");
  }
});