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

    try {
      const existing = await getDoc(usernameRef);
      if (existing.exists()) {
        showError(registerError, "שם המשתמש כבר תפוס. יש לבחור שם משתמש אחר.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        usernameToEmail(username),
        password
      );

      await setDoc(doc(db, "users", cred.user.uid), {
        fullName,
        phone,
        username: usernameKey,
        createdAt: new Date().toISOString()
      });

      await setDoc(usernameRef, { uid: cred.user.uid });

      registerForm.reset();
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
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      loginForm.reset();
    } catch (err) {
      showError(loginError, "שם משתמש או סיסמה שגויים.");
    }
  });

  // --- התנתקות ---
  logoutBtn.addEventListener("click", () => {
    signOut(auth);
  });

  // --- מצב מחובר/מנותק ---
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
      tabLogin.click();
    }
  });
})();
