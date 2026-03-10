// ── auth.js ──────────────────────────────────────────────────
// Google sign-in gate and auth bar.

import { auth, signIn, signOut, onAuthStateChanged } from "../firebase.js";
import { openDashboard } from "./render.js";
import { updateState }    from "./state.js";
import { render }         from "./render.js";
import { setCurrentUser, startListening, stopListening } from "./sync.js";

const authEl = document.getElementById("auth-bar");
const appEl  = document.getElementById("app");

const GOOGLE_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" style="flex-shrink:0">
  <path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.8l6-6C34.5 3.1 29.6 1 24 1 14.8 1 7 6.7 3.7 14.8l7 5.4C12.4 13.5 17.7 9.5 24 9.5z"/>
  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/>
  <path fill="#FBBC05" d="M10.7 28.6A14.7 14.7 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7-5.4A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8.1-6.2z"/>
  <path fill="#34A853" d="M24 47c5.6 0 10.3-1.8 13.7-5L30.3 36.3c-1.9 1.3-4.3 2.1-6.8 2.1-6.3 0-11.6-4.2-13.5-10l-8.1 6.2C5.9 41.6 14.3 47 24 47z"/>
</svg>`;

function renderAuthBar(user) {
  if (!authEl) return;
  if (user) {
    document.getElementById("sign-in-gate")?.remove();
    authEl.innerHTML = `
      <div class="auth-user">
        <img class="auth-avatar" src="${user.photoURL || ""}" alt="${user.displayName}" />
        <span class="auth-name">${user.displayName}</span>
        <span id="sync-status" class="sync-status">Live</span>
        <button class="btn-secondary btn-sm" id="sign-out-btn">Sign out</button>
      </div>`;
    document.getElementById("sign-out-btn").addEventListener("click", () => signOut(auth));
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
            ${GOOGLE_SVG} Sign in with Google
          </button>
          <p class="sign-in-note">Only authorised accounts can access this project.</p>
        </div>`;
      document.body.appendChild(gate);
      document.getElementById("sign-in-btn-gate")
        .addEventListener("click", () => signIn().catch(err => console.error("Sign-in failed:", err)));
    }
  }
}

export function initAuth() {
  onAuthStateChanged(auth, user => {
    setCurrentUser(user);
    renderAuthBar(user);
    if (user) {
      startListening();
      appEl.style.display = "";
      // Slight delay so Firestore data loads before dashboard renders
      setTimeout(openDashboard, 800);
    } else {
      stopListening();
      updateState({ categories: [] });
      appEl.style.display = "none";
      appEl.innerHTML = "";
    }
  });
}