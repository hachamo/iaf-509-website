import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// --- זמן ישראל בלבד - מונע בעיות שעון קיץ/חורף ב-cron של GitHub (שרץ ב-UTC) ---
const israelHour = Number(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hour12: false
  }).format(new Date())
);

if (israelHour !== 19) {
  console.log(`Not 19:00 Israel time (currently ${israelHour}:00) - skipping.`);
  process.exit(0);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}

async function resetTable(collectionId) {
  const rowsCol = db.collection(collectionId + "_drones");
  const snap = await rowsCol.get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
  await db.collection("meta").doc(collectionId).set({ lastResetDate: todayStr() });
  console.log(`${collectionId}: deleted ${snap.size} rows and marked as reset for today.`);
}

async function main() {
  await resetTable("table1");
  await resetTable("table2");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
