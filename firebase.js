import { initializeApp }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyA9zF7mTesrlAuNRfm8HvKvnAW72v2j6UE",
  authDomain:        "van-project-e7472.firebaseapp.com",
  projectId:         "van-project-e7472",
  storageBucket:     "van-project-e7472.firebasestorage.app",
  messagingSenderId: "1062050986674",
  appId:             "1:1062050986674:web:a9e1c1c04a9f48e5c8e7ab",
  measurementId:     "G-Q5YNEZXE05"
};

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

const signIn   = () => signInWithPopup(auth, provider);
const signOut_ = () => signOut(auth);

// ── Firestore path helpers ───────────────────────────────────
// Build data now lives at builds/{projectId}/data/main
const buildDocRef = (projectId) => doc(db, "builds", projectId, "data", "main");
const userDocRef  = (uid)       => doc(db, "users", uid);
const projectsCol = ()          => collection(db, "projects");
const projectRef  = (id)        => doc(db, "projects", id);
const inviteRef   = (token)     => doc(db, "invites", token);

export {
  db, auth,
  signIn, signOut_ as signOut, onAuthStateChanged,
  // Firestore operations
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp,
  // Path helpers
  buildDocRef, userDocRef, projectsCol, projectRef, inviteRef, arrayUnion, arrayRemove, deleteField,
};