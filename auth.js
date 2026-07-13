import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const USERNAME_DOMAIN = "@iaf509-users.local";

function usernameToEmail(username) {
  return username.trim().toLowerCase() + USERNAME_DOMAIN;
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}

function hideError(el) {
  el.classList.add("hidden");
}

const ALLOWED_REDIRECTS = [
  "index.html",
  "table-1.html",
  "table-2.html",
  "rpaa-procedures.html",
  "iaf509-interface.html",
  "profile.html"
];

function getRedirectTarget() {
  const requested = new URLSearchParams(location.search).get("redirect");
  return ALLOWED_REDIRECTS.includes(requested) ? requested : "index.html";
}

(function () {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const loggedInPanel = document.getElementById("logged-in-panel");
  const loggedInMessage = document.getElementById("logged-in-message");
  const logoutBtn = document.getElementById("logout-btn");
  const loginError = document.getElementById("login-error");
  const registerError = document.getElementById("register-error");

  if (!loginForm) return;

  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });

  const requestedTab = new URLSearchParams(location.search).get("tab");
  if (requestedTab === "register") {
    tabRegister.click();
  }

  // --- הרשמה ---
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(registerError);

    if (!registerForm.checkValidity()) {
      registerForm.reportValidity();
      return;
    }

    const fd = new FormData(registerForm);
    const fullName = fd.get("fullName").trim();
    const phone = fd.get("phone").trim();
    const username = fd.get("username").trim();
    const password = fd.get("password");
    const passwordConfirm = fd.get("passwordConfirm");

    if (password !== passwordConfirm) {
      showError(registerError, "הסיסמאות אינן תואמות.");
      return;
    }

    const usernameKey = username.toLowerCase();
    const usernameRef = doc(db, "usernames", usernameKey);
    const phoneRef = doc(db, "phones", phone);

    // מייצרים אימייל פנימי קבוע ואקראי, שלא תלוי בשם המשתמש -
    // כך שינוי שם משתמש בעתיד לא ידרוש לגעת בחשבון ה-Firebase Auth בכלל
    const internalEmail = crypto.randomUUID() + USERNAME_DOMAIN;

    try {
      const existingUsername = await getDoc(usernameRef);
      if (existingUsername.exists()) {
        showError(registerError, "שם המשתמש כבר תפוס. יש לבחור שם משתמש אחר.");
        return;
      }

      const existingPhone = await getDoc(phoneRef);
      if (existingPhone.exists()) {
        showError(registerError, "מספר הטלפון כבר רשום במערכת.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(auth, internalEmail, password);

      await setDoc(doc(db, "users", cred.user.uid), {
        fullName,
        phone,
        username: usernameKey,
        createdAt: new Date().toISOString()
      });

      await setDoc(usernameRef, { uid: cred.user.uid, internalEmail });
      await setDoc(phoneRef, { uid: cred.user.uid });

      registerForm.reset();
      location.href = getRedirectTarget();
    } catch (err) {
      showError(registerError, "שגיאה בהרשמה: " + (err.message || err));
    }
  });

  // --- התחברות ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError(loginError);

    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }

    const fd = new FormData(loginForm);
    const username = fd.get("username").trim();
    const password = fd.get("password");

    try {
      const usernameSnap = await getDoc(doc(db, "usernames", username.toLowerCase()));
      // תאימות אחורה: חשבונות ישנים שנוצרו לפני המעבר לאימייל פנימי אקראי
      const loginEmail = usernameSnap.exists() && usernameSnap.data().internalEmail
        ? usernameSnap.data().internalEmail
        : usernameToEmail(username);

      await signInWithEmailAndPassword(auth, loginEmail, password);
      loginForm.reset();
      location.href = getRedirectTarget();
    } catch (err) {
      showError(loginError, "שם משתמש או סיסמה שגויים.");
    }
  });

  // --- התנתקות ---
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
  });

  // --- מצב מחובר/מנותק ---
  // previousUser: undefined = עדיין לא נבדק לראשונה, true/false = מצב אחרי בדיקה קודמת
  let previousUser;
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      const name = snap.exists() ? snap.data().fullName : user.email;

      loggedInMessage.textContent = `מחובר/ת בתור: ${name}`;
      loggedInPanel.classList.remove("hidden");
      loginForm.classList.add("hidden");
      registerForm.classList.add("hidden");
      document.querySelector(".auth-tabs").classList.add("hidden");
    } else {
      loggedInPanel.classList.add("hidden");
      document.querySelector(".auth-tabs").classList.remove("hidden");
      // מאפסים לטאב "התחברות" רק כשמדובר בהתנתקות אמיתית (לא בטעינת הדף הראשונית),
      // כדי לא לדרוס בחירה ידנית של המשתמש בטאב "הרשמה"
      if (previousUser === true) {
        tabLogin.click();
      }
    }
    previousUser = !!user;
  });
})();
