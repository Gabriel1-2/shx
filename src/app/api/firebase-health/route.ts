import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function GET() {
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        firestore: "unknown",
    };

    // Test 1: Write a test document
    try {
        const testRef = doc(db, "system", "healthcheck");
        await setDoc(testRef, {
            lastCheck: new Date().toISOString(),
            status: "ok",
        }, { merge: true });
        results.write = "✅ Success";
    } catch (e: any) {
        results.write = `❌ Failed: ${e.message}`;
    }

    // Test 2: Read it back
    try {
        const testRef = doc(db, "system", "healthcheck");
        const snap = await getDoc(testRef);
        results.read = snap.exists() ? `✅ Success: ${JSON.stringify(snap.data())}` : "❌ Document not found after write";
    } catch (e: any) {
        results.read = `❌ Failed: ${e.message}`;
    }

    // Test 3: Check if users collection exists
    try {
        const usersSnap = await getDocs(collection(db, "users"));
        results.usersCount = usersSnap.size;
    } catch (e: any) {
        results.usersCollection = `❌ Failed: ${e.message}`;
    }

    // Test 4: Check if transactions collection exists
    try {
        const txSnap = await getDocs(collection(db, "transactions"));
        results.transactionsCount = txSnap.size;
    } catch (e: any) {
        results.transactionsCollection = `❌ Failed: ${e.message}`;
    }

    results.firestore = (results.write?.startsWith("✅") && results.read?.startsWith("✅")) ? "✅ Connected" : "❌ Issues detected";

    return NextResponse.json(results);
}
