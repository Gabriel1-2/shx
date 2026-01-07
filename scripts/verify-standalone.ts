
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc } from "firebase/firestore";

// HARDCODED CREDENTIALS PROVIDED BY USER
const firebaseConfig = {
    apiKey: "AIzaSyBeWmWx3mfvY7G4KJvIZW1l2pXAShnjhf0",
    authDomain: "shx-exchange.firebaseapp.com",
    projectId: "shx-exchange",
    storageBucket: "shx-exchange.firebasestorage.app",
    messagingSenderId: "725755817592",
    appId: "1:725755817592:web:4498f8e726bc8fbc9ac78d",
    measurementId: "G-CW93PVMQNM"
};

console.log("🔍 TESTING WITH CONFIG:", JSON.stringify(firebaseConfig, null, 2));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        console.log("📝 Attempting write...");
        const ref = await addDoc(collection(db, "_debug_test"), {
            msg: "Hello from standalone script",
            time: new Date().toISOString()
        });
        console.log("✅ WRITE SUCCESS! ID:", ref.id);

        console.log("🧹 Deleting...");
        await deleteDoc(ref);
    } catch (e: any) {
        console.error("❌ SDK FAILED:", e.message);
        console.log("🔄 Trying REST API fallback...");

        try {
            const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/_connectivity_rest_test?key=${firebaseConfig.apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { msg: { stringValue: "hello from rest" } } })
            });

            if (res.ok) {
                const data = await res.json();
                console.log("✅ REST API SUCCESS! DB Exists.");
                console.log("Document created:", data.name);
                process.exit(0);
            } else {
                const errText = await res.text();
                console.error("❌ REST API FAILED:", res.status, errText);
                process.exit(1);
            }
        } catch (restErr) {
            console.error("❌ REST FAILED:", restErr);
            process.exit(1);
        }
    }
}

test();
