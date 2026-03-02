import { db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const testBtn = document.getElementById("testBtn");
const output = document.getElementById("output");

testBtn.addEventListener("click", async () => {
    try {
        const docRef = await addDoc(collection(db, "test"), {
            message: "Hello from Van Project!",
            timestamp: new Date()
        });

        output.innerHTML = "Success! Document ID: " + docRef.id;
    } catch (error) {
        output.innerHTML = "Error: " + error.message;
        console.error(error);
    }
});