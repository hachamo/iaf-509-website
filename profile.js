import { db, auth } from "./firebase-init.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const CONSENT_VALID_MS = 7 * 24 * 60 * 60 * 1000;

const LOCATIONS = {
  table1: "שבטה",
  table2: "אשקלון"
};

function formatRemaining(ms) {
  if (ms <= 0) return "פג תוקף - יש לחתום מחדש בכניסה הבאה לטבלה";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days} ימים ו-${hours} שעות`;
  return `${hours} שעות`;
}

async function findActiveFlight(uid) {
  for (const collectionId of Object.keys(LOCATIONS)) {
    const q = query(collection(db, collectionId + "_drones"), where("ownerId", "==", uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return collectionId;
    }
  }
  return null;
}

(function () {
  const loginRequiredBanner = document.getElementById("profile-login-required");
  const profileCard = document.getElementById("profile-card");
  const usernameEl = document.getElementById("profile-username");
  const phoneEl = document.getElementById("profile-phone");
  const consentEl = document.getElementById("profile-consent");
  const flightStatusEl = document.getElementById("profile-flight-status");
  const flightAction = document.getElementById("profile-flight-action");
  const endFlightLink = document.getElementById("profile-end-flight-link");

  if (!loginRequiredBanner || !profileCard) return;

  onAuthStateChanged(auth, async (user) => {
    loginRequiredBanner.classList.toggle("hidden", !!user);

    if (!user) {
      profileCard.classList.add("hidden");
      return;
    }

    profileCard.classList.remove("hidden");

    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};

    usernameEl.textContent = data.username || "-";
    phoneEl.textContent = data.phone || "-";

    const consentSignedAt = data.consentSignedAt ? data.consentSignedAt.toMillis() : 0;
    const remaining = consentSignedAt + CONSENT_VALID_MS - Date.now();
    consentEl.textContent = formatRemaining(remaining);

    const activeCollection = await findActiveFlight(user.uid);
    if (activeCollection) {
      flightStatusEl.textContent = `הטסה פעילה ב${LOCATIONS[activeCollection]}`;
      endFlightLink.href = `${activeCollection === "table1" ? "table-1.html" : "table-2.html"}?openEndFlight=1`;
      flightAction.classList.remove("hidden");
    } else {
      flightStatusEl.textContent = "אין הטסה פעילה";
      flightAction.classList.add("hidden");
    }
  });
})();
