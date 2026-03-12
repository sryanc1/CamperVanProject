// ── sync.js ──────────────────────────────────────────────────
// Firestore read/write and sync status indicator.

import { buildDocRef, onSnapshot, setDoc } from "../firebase.js";
import { getState, updateState } from "./state.js";
import { checkNotesConflicts } from "./render.js";

export let currentUser      = null;
export let currentProjectId = null;
export const setCurrentUser    = u  => { currentUser      = u;  };
export const setCurrentProject = id => { currentProjectId = id; };

let saveTimer     = null;
let unsubSnapshot = null;
let _onUpdate     = null;   // callback → render()

export function initSync(onUpdateCallback) {
  _onUpdate = onUpdateCallback;
}

export function setSyncStatus(status) {
  const el = document.getElementById("sync-status");
  if (!el) return;
  const map = {
    saving: { text: "Saving…",       colour: "var(--text-3)" },
    saved:  { text: "Saved ✓",       colour: "var(--green)"  },
    error:  { text: "Save failed ✗", colour: "var(--red)"    },
    live:   { text: "Live",          colour: "var(--amber)"  },
  };
  const s = map[status] || map.live;
  el.textContent = s.text;
  el.style.color  = s.colour;
}

export function scheduleWrite() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!currentUser) return;
    setSyncStatus("saving");
    const { categories, budget } = getState();
    setDoc(buildDocRef(currentProjectId), { categories, budget: budget || 0 })
      .then(() => setSyncStatus("saved"))
      .catch(err => { console.error("Write failed:", err); setSyncStatus("error"); });
  }, 800);
}

export function startListening() {
  if (unsubSnapshot) unsubSnapshot();
  unsubSnapshot = onSnapshot(buildDocRef(currentProjectId), snap => {
    const incoming = snap.exists() ? snap.data() : { categories: [], budget: 0 };
    checkNotesConflicts(incoming.categories || []);
    updateState(incoming);
    if (_onUpdate) _onUpdate();
    setSyncStatus("live");
  }, err => { console.error("Snapshot error:", err); setSyncStatus("error"); });
}

export function stopListening() {
  if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
}