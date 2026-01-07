
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// TODO: Replace the following with your app's Firebase project configuration
// You can find this in your Firebase Console -> Project Settings -> General -> "Your apps"
const firebaseConfig = {
    apiKey: "AIzaSyBeWmWx3mfvY7G4KJvIZW1l2pXAShnjhf0",
    authDomain: "shx-exchange.firebaseapp.com",
    projectId: "shx-exchange",
    storageBucket: "shx-exchange.firebasestorage.app",
    messagingSenderId: "725755817592",
    appId: "1:725755817592:web:4498f8e726bc8fbc9ac78d",
    measurementId: "G-CW93PVMQNM"
};

// Initialize Firebase (Singleton pattern to avoid multiple instances in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Analytics only works in browser
let analytics;
if (typeof window !== "undefined") {
    analytics = getAnalytics(app);
}

export const db = getFirestore(app);
