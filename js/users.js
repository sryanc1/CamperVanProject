// ── users.js ─────────────────────────────────────────────────
// User document management — create, read, status checks.

import {
  db, getDoc, setDoc, updateDoc,
  userDocRef, projectsCol, query, where, getDocs,
} from "../firebase.js";
import { arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Create a user doc on first login (status: pending)
export async function ensureUserDoc(user) {
  const ref  = userDocRef(user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email:     user.email,
      name:      user.displayName || "",
      photoURL:  user.photoURL    || "",
      status:    "pending",
      isAdmin:   false,
      createdAt: new Date().toISOString(),
    });
    return { status: "pending", isAdmin: false };
  }
  return snap.data();
}

// Read current user doc
export async function getUserDoc(uid) {
  const snap = await getDoc(userDocRef(uid));
  return snap.exists() ? snap.data() : null;
}

// Admin: fetch all pending users
export async function getPendingUsers() {
  const col   = query(
    await import("../firebase.js").then(m => m.collection(db, "users")),
    where("status", "==", "pending")
  );
  const snap  = await getDocs(col);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// Add a project ID to a user's project list
export async function addProjectToUser(uid, projectId) {
  await updateDoc(userDocRef(uid), {
    projects: arrayUnion(projectId),
  });
}

// Admin: approve a user
export async function approveUser(uid) {
  await updateDoc(userDocRef(uid), { status: "approved" });
}

// Admin: reject (delete) a user
export async function rejectUser(uid) {
  const { deleteDoc } = await import("../firebase.js");
  await deleteDoc(userDocRef(uid));
}

// Fetch projects the current user is a member of
// Reads project IDs stored on user doc, then fetches each individually
export async function getUserProjects(uid) {
  try {
    const userSnap = await getDoc(userDocRef(uid));
    const projectIds = userSnap.data()?.projects || [];
    if (projectIds.length === 0) return [];

    const { projectRef } = await import("../firebase.js");
    const results = await Promise.all(
      projectIds.map(id => getDoc(projectRef(id)))
    );
    return results
      .filter(snap => snap.exists())
      .map(snap => ({ id: snap.id, ...snap.data() }));
  } catch (err) {
    console.error("getUserProjects failed:", err);
    return [];
  }
}