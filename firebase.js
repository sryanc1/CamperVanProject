import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
  collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from "firebase/firestore";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

console.log('API KEY:', import.meta.env.VITE_FIREBASE_API_KEY);

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
