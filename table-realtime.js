import { db, auth } from "./firebase-init.js";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// חלון חיי המאגר (מתי הנתונים נפתחים/מתאפסים)
const RESET_HOUR = 19;

// חלון הגישה בפועל לטבלה (צפייה/הוספה/סיום הטסה)
const ACCESS_OPEN_HOUR = 8 + 25 / 60; // 08:25
const ACCESS_CLOSE_HOUR = 17.5; // 17:30

// שעת ההתחלה המאוחרת ביותר שניתן לבחור בטופס "הוספת רחפן"
const LATEST_START_TIME = "17:00";

// תוקף חתימת טופס ההסכמה - שבוע ימים
const CONSENT_VALID_MS = 7 * 24 * 60 * 60 * 1000;

function todayStr() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD בזמן מקומי
}

function isWithinAccessWindow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= ACCESS_OPEN_HOUR && h < ACCESS_CLOSE_HOUR;
}

let currentFullName = "";

// פותח אוטומטית את טופס "סיום הטסה" אם הגענו לעמוד עם ?openEndFlight=1
// (למשל דרך כפתור "סיום הטסה" בעמוד האזור האישי)
let didAutoOpenEndFlight = false;
function maybeAutoOpenEndFlight() {
  if (didAutoOpenEndFlight) return;
  if (new URLSearchParams(location.search).get("openEndFlight") !== "1") return;
  const btn = document.getElementById("end-flight-btn");
  if (btn && !btn.closest(".hidden") && !btn.classList.contains("hidden")) {
    didAutoOpenEndFlight = true;
    btn.click();
  }
}

(function () {
  const loginRequiredBanner = document.getElementById("login-required-banner");
  const consentForm = document.getElementById("consent-form");
  const tableSection = document.getElementById("table-section");

  if (!loginRequiredBanner || !consentForm) return;

  const nameInput = consentForm.querySelector('input[name="full-name"]');
  const consentPhoneInput = consentForm.querySelector('input[name="phone"]');
  let currentUid = null;

  // --- הגבלת גישה: רק למשתמשים מחוברים, ורק אם חתמו על ההסכמה בשבוע האחרון ---
  onAuthStateChanged(auth, async (user) => {
    loginRequiredBanner.classList.toggle("hidden", !!user);

    if (!user) {
      consentForm.classList.add("hidden");
      if (tableSection) tableSection.classList.add("hidden");
      currentFullName = "";
      currentUid = null;
      return;
    }

    currentUid = user.uid;
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    currentFullName = data.fullName || "";
    if (nameInput) {
      nameInput.value = currentFullName;
      nameInput.readOnly = true;
    }
    if (consentPhoneInput) {
      consentPhoneInput.value = data.phone || "";
      consentPhoneInput.readOnly = true;
    }

    const consentSignedAt = data.consentSignedAt ? data.consentSignedAt.toMillis() : 0;
    const consentValid = Date.now() - consentSignedAt < CONSENT_VALID_MS;

    if (consentValid) {
      consentForm.classList.add("hidden");
      if (tableSection) tableSection.classList.remove("hidden");
      maybeAutoOpenEndFlight();
    } else {
      consentForm.classList.remove("hidden");
      if (tableSection) tableSection.classList.add("hidden");
    }
  });

  // --- שליחת טופס ההסכמה - שומרת תוקף חתימה של שבוע ---
  consentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!consentForm.checkValidity()) {
      consentForm.reportValidity();
      return;
    }
    if (!currentUid) return;

    await updateDoc(doc(db, "users", currentUid), {
      consentSignedAt: serverTimestamp()
    });

    consentForm.classList.add("hidden");
    if (tableSection) tableSection.classList.remove("hidden");
    maybeAutoOpenEndFlight();
  });
})();

(function () {
  const table = document.getElementById("drone-table");
  if (!table) return;

  const collectionId = table.dataset.collection;
  const maxHeight = table.dataset.maxHeight;
  const endTime = table.dataset.endTime;
  const tbody = table.querySelector("tbody");

  const actionButtons = document.getElementById("action-buttons");
  const addBtn = document.getElementById("add-drone-btn");
  const form = document.getElementById("new-drone-form");
  const saveBtn = document.getElementById("save-drone-btn");
  const cancelBtn = document.getElementById("cancel-drone-btn");
  const closedBanner = document.getElementById("table-closed-banner");

  const endFlightBtn = document.getElementById("end-flight-btn");
  const endFlightForm = document.getElementById("end-flight-form");
  const confirmEndFlightBtn = document.getElementById("confirm-end-flight-btn");
  const cancelEndFlightBtn = document.getElementById("cancel-end-flight-btn");
  const endFlightMessage = document.getElementById("end-flight-message");

  const rowsCol = collection(db, collectionId + "_drones");
  const metaRef = doc(db, "meta", collectionId);

  // ownerId מבוסס על המשתמש המחובר (Firebase Auth) - מתעדכן כשמצב ההתחברות משתנה
  let ownerId = null;
  onAuthStateChanged(auth, (user) => {
    ownerId = user ? user.uid : null;
  });

  // --- חלון שעות פתיחה/סגירה ---
  function updateOpenState() {
    const open = isWithinAccessWindow();
    if (actionButtons) actionButtons.classList.toggle("hidden", !open);
    if (closedBanner) closedBanner.classList.toggle("hidden", open);
    if (!open && form) form.classList.add("hidden");
    if (!open && endFlightForm) endFlightForm.classList.add("hidden");
  }

  // --- איפוס יומי אוטומטי ---
  // מתבצע בכניסה הראשונה בכל יום חדש (בכל שעה שהיא), כדי שנתונים "מאתמול"
  // לא יישארו מוצגים אם אף אחד לא נכנס בין 19:00 לשעה שבה מישהו נכנס למחרת.
  async function checkDailyReset() {
    const metaSnap = await getDoc(metaRef);
    const lastReset = metaSnap.exists() ? metaSnap.data().lastResetDate : null;
    const today = todayStr();

    if (lastReset === today) return;

    const snap = await getDocs(rowsCol);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await setDoc(metaRef, { lastResetDate: today });
  }

  // --- רינדור שורות בזמן אמת ---
  function renderRow(docSnap) {
    const data = docSnap.data();
    const isOwner = data.ownerId === ownerId;
    const statusLabel = data.status === "landed" ? "נחות" : "באוויר";

    const statusCell = isOwner
      ? `<select class="status-select">
          <option value="airborne" ${data.status === "airborne" ? "selected" : ""}>באוויר</option>
          <option value="landed" ${data.status === "landed" ? "selected" : ""}>נחות</option>
        </select>`
      : `<span>${statusLabel}</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.droneType ?? "-"}</td>
      <td>${data.operatorName ?? "-"}</td>
      <td>${data.quantity ?? "-"}</td>
      <td class="locked-cell">${maxHeight}</td>
      <td class="split-cell"><span>${data.phone1 ?? "-"}</span><span>${data.phone2 ?? "-"}</span></td>
      <td>${data.startTime ?? "-"}</td>
      <td class="locked-cell">${endTime}</td>
      <td>${statusCell}</td>
    `;

    if (isOwner) {
      tr.querySelector(".status-select").addEventListener("change", (e) => {
        updateDoc(doc(db, collectionId + "_drones", docSnap.id), { status: e.target.value });
      });
    }

    return tr;
  }

  function subscribeToRows() {
    const q = query(rowsCol, orderBy("createdAt", "asc"));
    onSnapshot(q, (snapshot) => {
      tbody.innerHTML = "";
      snapshot.forEach((docSnap) => {
        tbody.appendChild(renderRow(docSnap));
      });
    });
  }

  // --- טופס הוספת רחפן ---
  if (addBtn && form) {
    addBtn.addEventListener("click", () => {
      if (endFlightForm) endFlightForm.classList.add("hidden");
      form.classList.toggle("hidden");
      const opNameInput = form.querySelector('[name="operatorName"]');
      if (opNameInput) {
        opNameInput.value = currentFullName;
        opNameInput.readOnly = true;
      }
    });
  }

  if (cancelBtn && form) {
    cancelBtn.addEventListener("click", () => {
      form.reset();
      form.classList.add("hidden");
    });
  }

  // --- מודל אימות לפני שמירת הטסה ---
  const confirmModal = document.getElementById("confirm-drone-modal");
  const confirmOperatorName = document.getElementById("confirm-operator-name");
  const confirmPhone1 = document.getElementById("confirm-phone1");
  const confirmPhone2 = document.getElementById("confirm-phone2");
  const confirmStartTime = document.getElementById("confirm-start-time");
  const confirmDroneBtn = document.getElementById("confirm-drone-btn");
  const cancelConfirmDroneBtn = document.getElementById("cancel-confirm-drone-btn");
  let pendingDroneEntry = null;

  if (saveBtn && form) {
    saveBtn.addEventListener("click", () => {
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const fd = new FormData(form);
      const phone1 = fd.get("phone1").trim();
      const phone2 = fd.get("phone2").trim();

      if (phone2 && phone1 === phone2) {
        alert("טלפון 1 וטלפון 2 לא יכולים להיות אותו מספר.");
        return;
      }

      const startTime = fd.get("startTime");
      if (startTime > LATEST_START_TIME) {
        alert(`שעת התחלת פעילות לא יכולה להיות אחרי ${LATEST_START_TIME}.`);
        return;
      }

      pendingDroneEntry = {
        droneType: fd.get("droneType"),
        operatorName: fd.get("operatorName"),
        quantity: fd.get("quantity"),
        phone1: phone1,
        phone2: phone2 || "-",
        startTime: startTime,
        status: "airborne",
        ownerId: ownerId,
        createdAt: serverTimestamp()
      };

      if (confirmModal) {
        confirmOperatorName.textContent = pendingDroneEntry.operatorName;
        confirmPhone1.textContent = pendingDroneEntry.phone1;
        confirmPhone2.textContent = pendingDroneEntry.phone2;
        confirmStartTime.textContent = pendingDroneEntry.startTime;
        confirmModal.classList.remove("hidden");
      }
    });
  }

  if (confirmDroneBtn) {
    confirmDroneBtn.addEventListener("click", async () => {
      if (!pendingDroneEntry) return;
      await addDoc(rowsCol, pendingDroneEntry);
      pendingDroneEntry = null;
      confirmModal.classList.add("hidden");
      form.reset();
      form.classList.add("hidden");
    });
  }

  if (cancelConfirmDroneBtn) {
    cancelConfirmDroneBtn.addEventListener("click", () => {
      pendingDroneEntry = null;
      confirmModal.classList.add("hidden");
    });
  }

  // --- טופס סיום הטסה - איתור ומחיקת השורה מהמאגר ---
  if (endFlightBtn && endFlightForm) {
    endFlightBtn.addEventListener("click", () => {
      if (form) form.classList.add("hidden");
      endFlightForm.classList.toggle("hidden");
      if (endFlightMessage) endFlightMessage.classList.add("hidden");
      const endNameInput = endFlightForm.querySelector('[name="endOperatorName"]');
      if (endNameInput) {
        endNameInput.value = currentFullName;
        endNameInput.readOnly = true;
      }
    });
  }

  if (cancelEndFlightBtn && endFlightForm) {
    cancelEndFlightBtn.addEventListener("click", () => {
      endFlightForm.reset();
      endFlightForm.classList.add("hidden");
      if (endFlightMessage) endFlightMessage.classList.add("hidden");
    });
  }

  if (confirmEndFlightBtn && endFlightForm) {
    confirmEndFlightBtn.addEventListener("click", async () => {
      if (!endFlightForm.checkValidity()) {
        endFlightForm.reportValidity();
        return;
      }
      const fd = new FormData(endFlightForm);
      const name = fd.get("endOperatorName").trim();
      const phone = fd.get("endPhone").trim();

      const snap = await getDocs(rowsCol);
      const match = snap.docs.find((d) => {
        const data = d.data();
        return (
          data.operatorName?.trim() === name &&
          (data.phone1?.trim() === phone || data.phone2?.trim() === phone)
        );
      });

      if (!match) {
        endFlightMessage.textContent = "לא נמצאה הטסה תואמת לפרטים שהוזנו.";
        endFlightMessage.classList.remove("hidden");
        return;
      }

      await deleteDoc(match.ref);
      endFlightForm.reset();
      endFlightForm.classList.add("hidden");
    });
  }

  updateOpenState();
  checkDailyReset();
  subscribeToRows();

  setInterval(() => {
    updateOpenState();
    checkDailyReset();
  }, 30000);
})();
