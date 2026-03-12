// ── projects.js ──────────────────────────────────────────────
// Project picker, creation, and member management.

import {
  db, setDoc, addDoc, getDoc, updateDoc, serverTimestamp,
  projectRef, projectsCol, buildDocRef, userDocRef,
  query, where, getDocs, collection,
} from "../firebase.js";
import { getUserProjects, getPendingUsers, approveUser, rejectUser } from "./users.js";
import { loadApp } from "./auth.js";

let _currentUser    = null;
let _currentUserDoc = null;

// ── Project picker overlay ────────────────────────────────────
export async function showProjectPicker(user, userDoc) {
  _currentUser    = user;
  _currentUserDoc = userDoc;

  removeOverlay();
  const overlay = createOverlay("project-picker");
  overlay.innerHTML = `
    <div class="picker-card">
      <div class="picker-header">
        <h2 class="picker-title">🚐 Your Projects</h2>
        ${userDoc.isAdmin
          ? `<button class="btn-secondary btn-sm" id="admin-panel-btn">⚙ Admin</button>`
          : ""}
      </div>
      <div id="picker-list" class="picker-list">
        <div class="picker-loading">Loading projects…</div>
      </div>
      <div class="picker-footer">
        <button class="btn-primary" id="new-project-btn">+ New Project</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("new-project-btn")
    .addEventListener("click", () => showNewProjectForm(user, userDoc));
  if (userDoc.isAdmin) {
    document.getElementById("admin-panel-btn")
      .addEventListener("click", () => showAdminPanel(user, userDoc));
  }

  // Load projects
  const projects = await getUserProjects(user.uid);
  const listEl   = document.getElementById("picker-list");

  if (projects.length === 0) {
    listEl.innerHTML = `<p class="picker-empty">No projects yet — create one below.</p>`;
    return;
  }

  listEl.innerHTML = projects.map(p => `
    <div class="picker-project" data-project-id="${p.id}">
      <div class="picker-project-info">
        <span class="picker-project-name">${p.name}</span>
        <span class="picker-project-role ${p.members[user.uid]}">${p.members[user.uid]}</span>
      </div>
      <button class="btn-primary btn-sm picker-open-btn" data-project-id="${p.id}">Open</button>
    </div>`).join("");

  listEl.querySelectorAll(".picker-open-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const projectId = btn.dataset.projectId;
      const project   = projects.find(p => p.id === projectId);
      removeOverlay();
      loadApp(user, userDoc, project);
    });
  });
}

// ── New project form ──────────────────────────────────────────
function showNewProjectForm(user, userDoc) {
  removeOverlay();
  const overlay = createOverlay("new-project-overlay");
  overlay.innerHTML = `
    <div class="picker-card">
      <div class="picker-header">
        <h2 class="picker-title">New Project</h2>
      </div>
      <div class="picker-body">
        <label class="modal-label">Project name
          <input type="text" id="project-name-input" class="modal-input"
            placeholder="e.g. My Van Build" maxlength="60" />
        </label>
        <p class="picker-hint">You'll be the owner. You can invite collaborators after creating.</p>
        <p id="new-project-error" class="picker-error" style="display:none"></p>
      </div>
      <div class="picker-footer">
        <button class="btn-secondary" id="back-to-picker">← Back</button>
        <button class="btn-primary" id="create-project-btn">Create Project</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("back-to-picker")
    .addEventListener("click", () => showProjectPicker(user, userDoc));

  document.getElementById("create-project-btn")
    .addEventListener("click", async () => {
      const name = document.getElementById("project-name-input").value.trim();
      const errEl = document.getElementById("new-project-error");
      if (!name) { showError(errEl, "Please enter a project name."); return; }

      const btn = document.getElementById("create-project-btn");
      btn.disabled = true;
      btn.textContent = "Creating…";

      try {
        const members = { [user.uid]: "owner" };
        const docRef  = await addDoc(projectsCol(), {
          name, ownerId: user.uid, members,
          createdAt: serverTimestamp(),
        });
        // Create empty build doc
        await setDoc(buildDocRef(docRef.id), { categories: [], budget: 0 });
        removeOverlay();
        loadApp(user, userDoc, { id: docRef.id, name, members });
      } catch (err) {
        showError(errEl, "Failed to create project. Please try again.");
        btn.disabled = false;
        btn.textContent = "Create Project";
      }
    });
}

// ── Admin panel ───────────────────────────────────────────────
async function showAdminPanel(user, userDoc) {
  removeOverlay();
  const overlay = createOverlay("admin-panel-overlay");
  overlay.innerHTML = `
    <div class="picker-card picker-card-wide">
      <div class="picker-header">
        <h2 class="picker-title">⚙ Admin Panel</h2>
        <button class="btn-secondary btn-sm" id="admin-back-btn">← Back</button>
      </div>
      <div class="picker-body" id="admin-body">
        <div class="picker-loading">Loading…</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("admin-back-btn")
    .addEventListener("click", () => showProjectPicker(user, userDoc));

  await renderAdminBody(user, userDoc);
}

async function renderAdminBody(user, userDoc) {
  const bodyEl  = document.getElementById("admin-body");
  if (!bodyEl) return;

  const pending = await getPendingUsers();

  bodyEl.innerHTML = `
    <h3 class="admin-section-title">Pending Requests (${pending.length})</h3>
    ${pending.length === 0
      ? `<p class="picker-empty">No pending requests.</p>`
      : `<div class="admin-user-list">
          ${pending.map(u => `
            <div class="admin-user-row" data-uid="${u.uid}">
              <div class="admin-user-info">
                <span class="admin-user-name">${u.name || "Unknown"}</span>
                <span class="admin-user-email">${u.email}</span>
              </div>
              <div class="admin-user-actions">
                <button class="btn-primary btn-sm approve-btn" data-uid="${u.uid}">✓ Approve</button>
                <button class="btn-danger-sm reject-btn" data-uid="${u.uid}">✕ Reject</button>
              </div>
            </div>`).join("")}
        </div>`}`;

  bodyEl.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "Approving…";
      await approveUser(btn.dataset.uid);
      await renderAdminBody(user, userDoc);
    });
  });

  bodyEl.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Reject and delete this user request?")) return;
      await rejectUser(btn.dataset.uid);
      await renderAdminBody(user, userDoc);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function createOverlay(id) {
  const el = document.createElement("div");
  el.id        = id;
  el.className = "picker-overlay";
  return el;
}

function removeOverlay() {
  document.querySelectorAll(
    "#project-picker, #new-project-overlay, #admin-panel-overlay"
  ).forEach(el => el.remove());
}

function showError(el, msg) {
  el.textContent    = msg;
  el.style.display  = "block";
}