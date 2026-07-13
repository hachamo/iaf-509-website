import { db, auth } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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

function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(el) {
  el.classList.add("hidden");
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

  const openUsernameBtn = document.getElementById("open-username-change-btn");
  const usernameModal = document.getElementById("username-change-modal");
  const newUsernameInput = document.getElementById("new-username-input");
  const usernameChangeError = document.getElementById("username-change-error");
  const confirmUsernameBtn = document.getElementById("confirm-username-change-btn");
  const cancelUsernameBtn = document.getElementById("cancel-username-change-btn");

  const openPhoneBtn = document.getElementById("open-phone-change-btn");
  const phoneModal = document.getElementById("phone-change-modal");
  const newPhoneInput = document.getElementById("new-phone-input");
  const phoneChangeError = document.getElementById("phone-change-error");
  const confirmPhoneBtn = document.getElementById("confirm-phone-change-btn");
  const cancelPhoneBtn = document.getElementById("cancel-phone-change-btn");

  if (!loginRequiredBanner || !profileCard) return;

  let currentUid = null;
  let currentUsername = "";
  let currentPhone = "";

  async function refreshProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};

    currentUsername = data.username || "";
    currentPhone = data.phone || "";

    usernameEl.textContent = currentUsername || "-";
    phoneEl.textContent = currentPhone || "-";

    const consentSignedAt = data.consentSignedAt ? data.consentSignedAt.toMillis() : 0;
    const remaining = consentSignedAt + CONSENT_VALID_MS - Date.now();
    consentEl.textContent = formatRemaining(remaining);

    const activeCollection = await findActiveFlight(uid);
    if (activeCollection) {
      flightStatusEl.textContent = `הטסה פעילה ב${LOCATIONS[activeCollection]}`;
      endFlightLink.href = `${activeCollection === "table1" ? "table-1.html" : "table-2.html"}?openEndFlight=1`;
      flightAction.classList.remove("hidden");
    } else {
      flightStatusEl.textContent = "אין הטסה פעילה";
      flightAction.classList.add("hidden");
    }
  }

  onAuthStateChanged(auth, async (user) => {
    loginRequiredBanner.classList.toggle("hidden", !!user);

    if (!user) {
      profileCard.classList.add("hidden");
      currentUid = null;
      return;
    }

    currentUid = user.uid;
    profileCard.classList.remove("hidden");
    await refreshProfile(user.uid);
  });

  // --- שינוי שם משתמש ---
  if (openUsernameBtn) {
    openUsernameBtn.addEventListener("click", () => {
      newUsernameInput.value = "";
      hideError(usernameChangeError);
      usernameModal.classList.remove("hidden");
    });
  }

  if (cancelUsernameBtn) {
    cancelUsernameBtn.addEventListener("click", () => {
      usernameModal.classList.add("hidden");
    });
  }

  if (confirmUsernameBtn) {
    confirmUsernameBtn.addEventListener("click", async () => {
      hideError(usernameChangeError);
      const newUsername = newUsernameInput.value.trim();

      if (newUsername.length < 3) {
        showError(usernameChangeError, "שם המשתמש חייב להכיל לפחות 3 תווים.");
        return;
      }

      const newUsernameKey = newUsername.toLowerCase();
      if (newUsernameKey === currentUsername) {
        showError(usernameChangeError, "זהו כבר שם המשתמש הנוכחי שלך.");
        return;
      }

      try {
        const existing = await getDoc(doc(db, "usernames", newUsernameKey));
        if (existing.exists()) {
          showError(usernameChangeError, "שם המשתמש כבר תפוס. יש לבחור שם משתמש אחר.");
          return;
        }

        // שינוי שם המשתמש הוא שינוי מסמכים ב-Firestore בלבד - חשבון ה-Firebase Auth
        // (וה"אימייל" הפנימי שמשמש להתחברות) נשארים ללא שינוי
        const oldUsernameSnap = await getDoc(doc(db, "usernames", currentUsername));
        const oldUsernameData = oldUsernameSnap.exists() ? oldUsernameSnap.data() : {};

        await setDoc(doc(db, "usernames", newUsernameKey), {
          uid: currentUid,
          internalEmail: oldUsernameData.internalEmail || null
        });

        if (oldUsernameSnap.exists()) {
          await deleteDoc(doc(db, "usernames", currentUsername));
        }

        await updateDoc(doc(db, "users", currentUid), { username: newUsernameKey });

        usernameModal.classList.add("hidden");
        await refreshProfile(currentUid);
      } catch (err) {
        showError(usernameChangeError, "שגיאה בשינוי שם המשתמש: " + (err.message || err));
      }
    });
  }

  // --- שינוי מספר טלפון ---
  if (openPhoneBtn) {
    openPhoneBtn.addEventListener("click", () => {
      newPhoneInput.value = "";
      hideError(phoneChangeError);
      phoneModal.classList.remove("hidden");
    });
  }

  if (cancelPhoneBtn) {
    cancelPhoneBtn.addEventListener("click", () => {
      phoneModal.classList.add("hidden");
    });
  }

  if (confirmPhoneBtn) {
    confirmPhoneBtn.addEventListener("click", async () => {
      hideError(phoneChangeError);
      const newPhone = newPhoneInput.value.trim();

      if (!/^05[0-9]{8}$/.test(newPhone)) {
        showError(phoneChangeError, "מספר טלפון חייב להתחיל ב-05 ולהכיל 10 ספרות.");
        return;
      }
      if (newPhone === currentPhone) {
        showError(phoneChangeError, "זהו כבר מספר הטלפון הנוכחי שלך.");
        return;
      }

      try {
        const existing = await getDoc(doc(db, "phones", newPhone));
        if (existing.exists()) {
          showError(phoneChangeError, "מספר הטלפון כבר רשום במערכת.");
          return;
        }

        await setDoc(doc(db, "phones", newPhone), { uid: currentUid });

        if (currentPhone) {
          const oldPhoneSnap = await getDoc(doc(db, "phones", currentPhone));
          if (oldPhoneSnap.exists()) {
            await deleteDoc(doc(db, "phones", currentPhone));
          }
        }

        await updateDoc(doc(db, "users", currentUid), { phone: newPhone });

        phoneModal.classList.add("hidden");
        await refreshProfile(currentUid);
      } catch (err) {
        showError(phoneChangeError, "שגיאה בשינוי מספר הטלפון: " + (err.message || err));
      }
    });
  }
})();
