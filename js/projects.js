// ── projects.js ──────────────────────────────────────────────
// Project picker, creation, and member management.

import {
  db, setDoc, addDoc, getDoc, updateDoc, serverTimestamp,
  projectRef, projectsCol, buildDocRef, userDocRef,
  query, where, getDocs, collection,
} from "../firebase.js";
import { getUserProjects, getPendingUsers, approveUser, rejectUser, addProjectToUser } from "./users.js";
import { loadApp } from "./auth.js";
import { createInvite } from "./invites.js";

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
  let projects = [];
  try {
    projects = await getUserProjects(user.uid);
  } catch (err) {
    console.error("Failed to load projects:", err);
  }
  const listEl = document.getElementById("picker-list");
  if (!listEl) return;

  if (projects.length === 0) {
    listEl.innerHTML = `<p class="picker-empty">No projects yet — create one below.</p>`;
    return;
  }

  listEl.innerHTML = projects.map(p => {
    const role    = p.members[user.uid];
    const isOwner = role === "owner";
    return `
      <div class="picker-project" data-project-id="${p.id}">
        <div class="picker-project-info">
          <span class="picker-project-name">${p.name}</span>
          <span class="picker-project-role ${role}">${role}</span>
        </div>
        <div class="picker-project-actions">
          ${isOwner ? `<button class="btn-secondary btn-sm invite-btn"
            data-project-id="${p.id}" data-project-name="${p.name}">✉ Invite</button>` : ""}
          <button class="btn-primary btn-sm picker-open-btn" data-project-id="${p.id}">Open</button>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".picker-open-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const projectId = btn.dataset.projectId;
      const project   = projects.find(p => p.id === projectId);
      removeOverlay();
      loadApp(user, userDoc, project);
    });
  });

  listEl.querySelectorAll(".invite-btn").forEach(btn => {
    btn.addEventListener("click", () =>
      showInviteForm(user, userDoc, btn.dataset.projectId, btn.dataset.projectName)
    );
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
        // Store project ID on user doc and create empty build doc
        await Promise.all([
          addProjectToUser(user.uid, docRef.id),
          setDoc(buildDocRef(docRef.id), { categories: [], budget: 0 }),
        ]);
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

// ── Invite form ──────────────────────────────────────────────
function showInviteForm(user, userDoc, projectId, projectName) {
  removeOverlay();
  const overlay = createOverlay("invite-overlay");
  overlay.innerHTML = `
    <div class="picker-card">
      <div class="picker-header">
        <h2 class="picker-title">✉ Invite Collaborator</h2>
      </div>
      <div class="picker-body">
        <p class="picker-hint" style="margin-bottom:16px">
          Inviting to: <strong>${projectName}</strong>
        </p>
        <label class="modal-label">Email address
          <input type="email" id="invite-email-input" class="modal-input"
            placeholder="collaborator@email.com" />
        </label>
        <p class="picker-hint">
          They must sign in with this exact Google account. The link expires in 7 days or after first use.
        </p>
        <div id="invite-result" style="display:none"></div>
      </div>
      <div class="picker-footer">
        <button class="btn-secondary" id="invite-back-btn">← Back</button>
        <button class="btn-primary" id="invite-send-btn">Generate Link</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById("invite-back-btn")
    .addEventListener("click", () => showProjectPicker(user, userDoc));

  document.getElementById("invite-send-btn").addEventListener("click", async () => {
    const email  = document.getElementById("invite-email-input").value.trim();
    const result = document.getElementById("invite-result");
    const btn    = document.getElementById("invite-send-btn");

    if (!email || !email.includes("@")) {
      result.innerHTML = `<p class="picker-error" style="display:block">Please enter a valid email address.</p>`;
      result.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Generating…";

    try {
      const token   = await createInvite(projectId, projectName, user.displayName, email);
      const baseUrl = window.location.origin + window.location.pathname;
      const link    = `${baseUrl}?invite=${token}`;

      result.style.display = "block";
      result.innerHTML = `
        <div class="invite-result-box">
          <p class="invite-result-label">Share this link with <strong>${email}</strong>:</p>
          <div class="invite-link-row">
            <input class="modal-input invite-link-input" readonly value="${link}" id="invite-link-val" />
            <button class="btn-secondary btn-sm" id="copy-invite-btn">Copy</button>
          </div>
          <p class="picker-hint">Single-use · expires in 7 days · Google account must match email above</p>
        </div>`;

      document.getElementById("copy-invite-btn").addEventListener("click", () => {
        navigator.clipboard.writeText(link);
        document.getElementById("copy-invite-btn").textContent = "Copied ✓";
      });

      // Select the link text for easy manual copy
      document.getElementById("invite-link-val").select();

      btn.style.display = "none";
    } catch (err) {
      result.style.display = "block";
      result.innerHTML = `<p class="picker-error" style="display:block">Failed to generate invite. Please try again.</p>`;
      btn.disabled = false;
      btn.textContent = "Generate Link";
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────
function createOverlay(id) {
  const el = document.createElement("div");
  el.id        = id;
  el.className = "picker-overlay";
  return el;
}

export function removeAllOverlays() {
  document.querySelectorAll(
    "#project-picker, #new-project-overlay, #admin-panel-overlay, #invite-overlay"
  ).forEach(el => el.remove());
}

function removeOverlay() { removeAllOverlays(); }

function showError(el, msg) {
  el.textContent    = msg;
  el.style.display  = "block";
}