import { db } from "../src/lib/firebase";
import { collection, addDoc, getDocs, query, limit, deleteDoc } from "firebase/firestore";

async function verifyFirestore() {
    console.log("🔍 Starting Firestore Verification...");

    try {
        // 1. Write Test
        console.log("📝 Attempting WRITE operation...");
        const testCol = collection(db, "_connectivity_test");
        const docRef = await addDoc(testCol, {
            timestamp: new Date(),
            test: "verification_script"
        });
        console.log("✅ WRITE Successful! Doc ID:", docRef.id);

        // 2. Read Test
        console.log("📖 Attempting READ operation...");
        const q = query(testCol, limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            console.log("✅ READ Successful! Found", querySnapshot.size, "documents.");
        } else {
            console.log("⚠️ READ Successful but collection empty (unexpected but connected).");
        }

        // 3. Cleanup
        console.log("🧹 Cleaning up test document...");
        await deleteDoc(docRef);
        console.log("✅ Cleanup Successful!");

        console.log("\n🎉 FIRESTORE CONNECTION IS PERFECT.");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ FIRESTORE CONNECTION FAILED:", error);
        process.exit(1);
    }
}

verifyFirestore();
