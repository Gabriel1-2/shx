/**
 * Deploy firestore rules + indexes using FIREBASE_SERVICE_ACCOUNT_KEY from .env.local
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const envPath = path.join(__dirname, "..", ".env.local");
const t = fs.readFileSync(envPath, "utf8");

let raw = null;
// Prefer single-quoted JSON block
const m = t.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([\s\S]*)'\s*$/);
if (m) {
    raw = m[1];
} else {
    const i = t.indexOf("FIREBASE_SERVICE_ACCOUNT_KEY=");
    if (i < 0) {
        console.error("FIREBASE_SERVICE_ACCOUNT_KEY not found");
        process.exit(1);
    }
    raw = t.slice(i + "FIREBASE_SERVICE_ACCOUNT_KEY=".length).trim();
    if (raw.startsWith("'") || raw.startsWith('"')) {
        const q = raw[0];
        raw = raw.slice(1);
        if (raw.endsWith(q)) raw = raw.slice(0, -1);
    }
}

let obj;
try {
    obj = JSON.parse(raw);
} catch (e) {
    console.error("Failed to parse service account JSON:", e.message);
    process.exit(1);
}

if (!obj.project_id) {
    console.error("Service account missing project_id");
    process.exit(1);
}

const saPath = path.join(process.env.TEMP || "/tmp", "shx-firebase-sa.json");
fs.writeFileSync(saPath, JSON.stringify(obj, null, 2));
console.log("Project:", obj.project_id);
console.log("SA email:", obj.client_email);
console.log("Credentials:", saPath);

process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;

const args = [
    "--yes",
    "firebase-tools@13",
    "deploy",
    "--only",
    "firestore:rules,firestore:indexes",
    "--project",
    obj.project_id,
    "--non-interactive",
];

const r = spawnSync("npx", args, {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
    shell: true,
});

process.exit(r.status ?? 1);
