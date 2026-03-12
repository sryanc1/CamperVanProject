// ── users.js ─────────────────────────────────────────────────
// User document management — create, read, status checks.

import {
  db, getDoc, setDoc, updateDoc,
  userDocRef, projectsCol, query, where, getDocs,
} from "../firebase.js";

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
export async function getUserProjects(uid) {
  const col  = projectsCol();
  const snap = await getDocs(col);
  // Filter client-side — Firestore can't query map keys directly
  return snap.docs
    .filter(d => d.data().members?.[uid])
    .map(d => ({ id: d.id, ...d.data() }));
}