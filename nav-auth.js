import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

(function () {
  const guestBox = document.getElementById("nav-auth-guest");
  const userBox = document.getElementById("nav-auth-user");
  const logoutBtn = document.getElementById("nav-logout-btn");

  if (!guestBox || !userBox) return;

  onAuthStateChanged(auth, (user) => {
    guestBox.classList.toggle("hidden", !!user);
    userBox.classList.toggle("hidden", !user);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("האם להתנתק?")) {
        signOut(auth);
      }
    });
  }
})();
