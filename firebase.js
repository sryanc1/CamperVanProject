
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
apiKey: "AIzaSyA9zF7mTesrlAuNRfm8HvKvnAW72v2j6UE",
authDomain: "van-project-e7472.firebaseapp.com",
projectId: "van-project-e7472",
storageBucket: "van-project-e7472.firebasestorage.app",
messagingSenderId: "1062050986674",
appId: "1:1062050986674:web:a9e1c1c04a9f48e5c8e7ab",
measurementId: "G-Q5YNEZXE05"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
const db = getFirestore(app);

// Export db for use in other files
export { db };
