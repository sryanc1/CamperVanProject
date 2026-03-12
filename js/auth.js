// ── auth.js ──────────────────────────────────────────────────
// Auth gate, user status routing, auth bar.

import { auth, signIn, signOut, onAuthStateChanged } from "../firebase.js";
import { ensureUserDoc }                             from "./users.js";
import { openDashboard }                             from "./render.js";
import { updateState }                               from "./state.js";
import { setCurrentUser, startListening, stopListening, setCurrentProject } from "./sync.js";
import { showProjectPicker }                         from "./projects.js";
import { getInviteTokenFromURL, acceptInvite, clearInviteFromURL } from "./invites.js";

const authEl = document.getElementById("auth-bar");
const appEl  = document.getElementById("app");

const GOOGLE_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0">
  <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.8l6-6C34.5 3.1 29.6 1 24 1 14.8 1 7 6.7 3.7 14.8l7 5.4C12.4 13.5 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/>
  <path fill="#FBBC05" d="M10.7 28.6A14.7 14.7 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7-5.4A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8.1-6.2z"/>
  <path fill="#34A853" d="M24 47c5.6 0 10.3-1.8 13.7-5L30.3 36.3c-1.9 1.3-4.3 2.1-6.8 2.1-6.3 0-11.6-4.2-13.5-10l-8.1 6.2C5.9 41.6 14.3 47 24 47z"/>
</svg>`;

// ── Auth bar (top strip) ──────────────────────────────────────
function renderAuthBar(user, userDoc) {
  if (!authEl || !user) { if (authEl) authEl.innerHTML = ""; return; }
  const adminBadge = userDoc?.isAdmin
    ? `<span class="auth-admin-badge">Admin</span>` : "";
  authEl.innerHTML = `
    <div class="auth-user">
      <img class="auth-avatar" src="${user.photoURL || ""}" alt="${user.displayName}" />
      <span class="auth-name">${user.displayName}</span>
      ${adminBadge}
      <span id="sync-status" class="sync-status">Live</span>
      <button class="btn-secondary btn-sm" id="switch-project-btn">⇄ Projects</button>
      <button class="btn-secondary btn-sm" id="sign-out-btn">Sign out</button>
    </div>`;
  document.getElementById("sign-out-btn")
    .addEventListener("click", () => signOut(auth));
  document.getElementById("switch-project-btn")
    .addEventListener("click", () => showProjectPicker(user, userDoc));
}

// ── Sign-in gate ──────────────────────────────────────────────
function showSignInGate() {
  document.getElementById("sign-in-gate")?.remove();
  document.getElementById("pending-gate")?.remove();
  const gate = document.createElement("div");
  gate.id = "sign-in-gate";
  gate.innerHTML = `
    <div class="sign-in-bg"></div>
    <div class="sign-in-card">
      <h2 class="sign-in-title">#Van Life</h2>
      <p class="sign-in-p">Plan, Budget, Build</p>
      <button class="btn-google-large" id="sign-in-btn-gate">
        ${GOOGLE_SVG} Sign in with Google
      </button>
    </div>`;
  document.body.appendChild(gate);
  document.getElementById("sign-in-btn-gate")
    .addEventListener("click", () => signIn().catch(console.error));
}

// ── Pending approval screen ───────────────────────────────────
function showPendingGate(user) {
  document.getElementById("sign-in-gate")?.remove();
  document.getElementById("pending-gate")?.remove();
  const gate = document.createElement("div");
  gate.id = "pending-gate";
  gate.innerHTML = `
    <div class="sign-in-bg"></div>
    <div class="sign-in-card">
      <div class="pending-icon">⏳</div>
      <h2 class="sign-in-title">Request Pending</h2>
      <p class="pending-msg">
        Thanks ${user.displayName?.split(" ")[0] || ""}! Your account request
        has been submitted. You'll have access once an admin approves it.
      </p>
      <button class="btn-secondary btn-sm" id="pending-sign-out">Sign out</button>
    </div>`;
  document.body.appendChild(gate);
  document.getElementById("pending-sign-out")
    .addEventListener("click", () => signOut(auth));
}

// ── Load app for an approved user + project ───────────────────
export function loadApp(user, userDoc, project) {
  document.getElementById("sign-in-gate")?.remove();
  document.getElementById("pending-gate")?.remove();
  renderAuthBar(user, userDoc);

  // Update project name in header brand
  const brandName = document.querySelector(".page-brand-name");
  if (brandName) brandName.textContent = project.name || "Van Build Planner";

  setCurrentProject(project.id);
  startListening();
  appEl.style.display = "";
  setTimeout(openDashboard, 800);
}

// ── Invite accept screen ─────────────────────────────────────
async function showInviteAcceptScreen(user, userDoc, token) {
  document.getElementById("sign-in-gate")?.remove();
  document.getElementById("pending-gate")?.remove();

  const gate = document.createElement("div");
  gate.id = "invite-gate";
  gate.innerHTML = `
    <div class="sign-in-bg"></div>
    <div class="sign-in-card">
      <div class="pending-icon">🔗</div>
      <h2 class="sign-in-title">Joining Project…</h2>
      <p class="pending-msg">Please wait while we verify your invite.</p>
    </div>`;
  document.body.appendChild(gate);

  const result = await acceptInvite(token, user);
  clearInviteFromURL();

  const card = gate.querySelector(".sign-in-card");
  if (result.ok) {
    card.innerHTML = `
      <div class="pending-icon">✅</div>
      <h2 class="sign-in-title">You're in!</h2>
      <p class="pending-msg">You've been added to <strong>${result.projectName}</strong>.</p>
      <button class="btn-primary" id="invite-continue-btn">Open Project</button>`;
    document.getElementById("invite-continue-btn").addEventListener("click", () => {
      gate.remove();
      showProjectPicker(user, userDoc);
    });
  } else {
    card.innerHTML = `
      <div class="pending-icon">⚠️</div>
      <h2 class="sign-in-title">Invite Invalid</h2>
      <p class="pending-msg">${result.reason}</p>
      <button class="btn-primary" id="invite-continue-btn">Go to My Projects</button>`;
    document.getElementById("invite-continue-btn").addEventListener("click", () => {
      gate.remove();
      showProjectPicker(user, userDoc);
    });
  }
}

// ── Main auth listener ────────────────────────────────────────
export function initAuth() {
  onAuthStateChanged(auth, async user => {
    setCurrentUser(user);

    if (!user) {
      stopListening();
      updateState({ categories: [] });
      appEl.style.display = "none";
      authEl.innerHTML = "";
      showSignInGate();
      return;
    }

    // Ensure user doc exists, get status
    const userDoc = await ensureUserDoc(user);

    if (userDoc.status !== "approved") {
      appEl.style.display = "none";
      showPendingGate(user);
      return;
    }

    // Check for invite token in URL first
    const inviteToken = getInviteTokenFromURL();
    if (inviteToken) {
      showInviteAcceptScreen(user, userDoc, inviteToken);
      return;
    }

    // Approved — show project picker
    showProjectPicker(user, userDoc);
  });
}