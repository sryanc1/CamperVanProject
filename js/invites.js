// ── invites.js ───────────────────────────────────────────────
// Invite link generation and acceptance.

import {
  db, getDoc, setDoc, deleteDoc, updateDoc,
  inviteRef, projectRef, userDocRef, arrayUnion, serverTimestamp,
} from "../firebase.js";
import { addProjectToUser } from "./users.js";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Generate a random token
function generateToken() {
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, "0")).join("");
}

// ── Create invite ─────────────────────────────────────────────
export async function createInvite(projectId, projectName, inviterName, targetEmail) {
  const token   = generateToken();
  const expires = Date.now() + INVITE_EXPIRY_MS;

  await setDoc(inviteRef(token), {
    projectId,
    projectName,
    inviterName,
    targetEmail:  targetEmail.toLowerCase().trim(),
    createdAt:    Date.now(),
    expiresAt:    expires,
    used:         false,
  });

  return token;
}

// ── Accept invite ─────────────────────────────────────────────
// Called when a signed-in user lands with ?invite=token in the URL
export async function acceptInvite(token, user) {
  const ref  = inviteRef(token);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return { ok: false, reason: "This invite link is invalid or has already been used." };
  }

  const invite = snap.data();

  if (invite.used) {
    return { ok: false, reason: "This invite has already been used." };
  }

  if (Date.now() > invite.expiresAt) {
    await deleteDoc(ref);
    return { ok: false, reason: "This invite has expired. Ask the project owner to send a new one." };
  }

  if (invite.targetEmail !== user.email.toLowerCase()) {
    return { ok: false, reason: `This invite was sent to ${invite.targetEmail}. Please sign in with that account.` };
  }

  // Add user to project members
  await updateDoc(projectRef(invite.projectId), {
    [`members.${user.uid}`]: "editor",
  });

  // Auto-approve the user - a valid invite is sufficient vetting
  await updateDoc(userDocRef(user.uid), { status: "approved" });

  // Add project to user's project list
  await addProjectToUser(user.uid, invite.projectId);

  // Mark invite as used
  await setDoc(ref, { ...invite, used: true, usedBy: user.uid, usedAt: Date.now() });

  return { ok: true, projectId: invite.projectId, projectName: invite.projectName };
}

// ── Check for invite token in URL ─────────────────────────────
export function getInviteTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("invite") || null;
}

// ── Clear invite token from URL ───────────────────────────────
export function clearInviteFromURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());
}