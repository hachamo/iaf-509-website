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

if (israelHour !== 17) {
  console.log(`Not 17:00 Israel time (currently ${israelHour}:00) - skipping.`);
  process.exit(0);
}

// --- חיבור ל-Firestore באמצעות מפתח שירות (נשמר כ-secret ב-GitHub) ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// --- שליחת SMS דרך Cellcom Business ---
// TODO: יש להשלים כאן את פרטי הבקשה המדויקים לפי תיעוד ה-API של סלקום עסקים
// (כתובת ה-endpoint, שמות הפרמטרים המדויקים) לאחר שליפתם מהפורטל העסקי.
async function sendSms(phone, message) {
  const user = process.env.CELLCOM_USER;
  const pass = process.env.CELLCOM_PASS;
  const sender = process.env.CELLCOM_SENDER;

  // דוגמת מבנה בלבד - להחליף בקריאה האמיתית לפי תיעוד Cellcom SmsGate
  const url = new URL("https://sms.cellcom.co.il/SendSms.asmx/Send");
  url.searchParams.set("user", user);
  url.searchParams.set("pass", pass);
  url.searchParams.set("Dest", phone);
  url.searchParams.set("Message", message);
  url.searchParams.set("SenderName", sender);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`שגיאה בשליחת SMS ל-${phone}: ${res.status}`);
  } else {
    console.log(`נשלח SMS ל-${phone}`);
  }
}

// --- שליפת כל מי שעדיין "באוויר" משתי הטבלאות ---
async function getAirborneOperators(collectionId) {
  const snap = await db
    .collection(collectionId + "_drones")
    .where("status", "==", "airborne")
    .get();

  return snap.docs.map((d) => d.data());
}

async function main() {
  const collections = ["table1", "table2"];

  for (const collectionId of collections) {
    const operators = await getAirborneOperators(collectionId);
    console.log(`${collectionId}: ${operators.length} מפעילים באוויר`);

    for (const op of operators) {
      const message = `תזכורת: השעה 17:00, הרחפן שלך (${op.droneType}) עדיין רשום כ"באוויר" במערכת יב"א 509. יש להנחית או לעדכן סטטוס.`;
      if (op.phone1) await sendSms(op.phone1, message);
      if (op.phone2 && op.phone2 !== "-") await sendSms(op.phone2, message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
