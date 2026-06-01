import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const app = initializeApp({
    apiKey: "AIzaSyBeWmWx3mfvY7G4KJvIZW1l2pXAShnjhf0",
    projectId: "shx-exchange",
});
const db = getFirestore(app);

async function run() {
    const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(5));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`Input: ${d.inputAmount} ${d.inputToken} -> Output: ${d.outputAmount} ${d.outputToken} | VolUSD: ${d.volumeUSD}`);
    });
    process.exit(0);
}
run();
