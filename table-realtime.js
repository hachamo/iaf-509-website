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

const OPEN_HOUR = 8;
const CLOSE_HOUR = 19;

function todayStr() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD בזמן מקומי
}

function isWithinOpenHours() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
}

let currentFullName = "";

(function () {
  const loginRequiredBanner = document.getElementById("login-required-banner");
  const consentForm = document.getElementById("consent-form");

  // --- הגבלת גישה: רק למשתמשים מחוברים ---
  if (loginRequiredBanner && consentForm) {
    const nameInput = consentForm.querySelector('input[name="full-name"]');
    onAuthStateChanged(auth, async (user) => {
      loginRequiredBanner.classList.toggle("hidden", !!user);
      if (user) {
        consentForm.classList.remove("hidden");
        const snap = await getDoc(doc(db, "users", user.uid));
        currentFullName = snap.exists() ? snap.data().fullName : "";
        if (nameInput) {
          nameInput.value = currentFullName;
          nameInput.readOnly = true;
        }
      } else {
        consentForm.classList.add("hidden");
        currentFullName = "";
      }
    });
  }
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
    const open = isWithinOpenHours();
    if (actionButtons) actionButtons.classList.toggle("hidden", !open);
    if (closedBanner) closedBanner.classList.toggle("hidden", open);
    if (!open && form) form.classList.add("hidden");
    if (!open && endFlightForm) endFlightForm.classList.add("hidden");
  }

  // --- איפוס יומי אוטומטי בשעה 19:00 ---
  async function checkDailyReset() {
    const now = new Date();
    if (now.getHours() < CLOSE_HOUR) return;

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

  if (saveBtn && form) {
    saveBtn.addEventListener("click", async () => {
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

      await addDoc(rowsCol, {
        droneType: fd.get("droneType"),
        operatorName: fd.get("operatorName"),
        quantity: fd.get("quantity"),
        phone1: phone1,
        phone2: phone2 || "-",
        startTime: fd.get("startTime"),
        status: "airborne",
        ownerId: ownerId,
        createdAt: serverTimestamp()
      });
      form.reset();
      form.classList.add("hidden");
    });
  }

  // --- טופס סיום הטסה - איתור ומחיקת השורה מהמאגר ---
  if (endFlightBtn && endFlightForm) {
    endFlightBtn.addEventListener("click", () => {
      if (form) form.classList.add("hidden");
      endFlightForm.classList.toggle("hidden");
      if (endFlightMessage) endFlightMessage.classList.add("hidden");
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
