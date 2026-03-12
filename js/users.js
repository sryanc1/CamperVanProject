// ── users.js ─────────────────────────────────────────────────
// User document management — create, read, status checks.

import {
  db, getDoc, setDoc, updateDoc, deleteDoc, collection,
  arrayUnion, arrayRemove,
  userDocRef, projectsCol, projectRef, query, where, getDocs,
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
    collection(db, "users"),
    where("status", "==", "pending")
  );
  const snap  = await getDocs(col);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// Add a project ID to a user's project list
export async function addProjectToUser(uid, projectId) {
  console.log("[addProjectToUser] writing", projectId, "to user", uid);
  await updateDoc(userDocRef(uid), {
    projects: arrayUnion(projectId),
  });
  console.log("[addProjectToUser] done");
}

// Admin: approve a user
export async function approveUser(uid) {
  await updateDoc(userDocRef(uid), { status: "approved" });
}

// Admin: reject (delete) a user
export async function rejectUser(uid) {
  await deleteDoc(userDocRef(uid));
}

// Fetch projects the current user is a member of
// Reads project IDs stored on user doc, then fetches each individually
export async function getUserProjects(uid) {
  try {
    const userSnap = await getDoc(userDocRef(uid));
    const projectIds = userSnap.data()?.projects || [];
    console.log("[getUserProjects] uid:", uid, "projectIds:", projectIds);
    if (projectIds.length === 0) return [];

    const results = await Promise.all(
      projectIds.map(id => getDoc(projectRef(id)))
    );

    // Prune stale project IDs (deleted directly in Firestore console)
    const stale = results.filter(s => !s.exists()).map(s => s.id);
    if (stale.length > 0) {
      console.warn("[getUserProjects] pruning stale project IDs:", stale);
      await updateDoc(userDocRef(uid), { projects: arrayRemove(...stale) });
    }

    return results
      .filter(snap => snap.exists())
      .map(snap => ({ id: snap.id, ...snap.data() }));
  } catch (err) {
    console.error("getUserProjects failed:", err);
    return [];
  }
}