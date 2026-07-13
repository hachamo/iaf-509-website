import { auth } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

(function () {
  const guestBox = document.getElementById("nav-auth-guest");
  const userBox = document.getElementById("nav-auth-user");
  const logoutBtn = document.getElementById("nav-logout-btn");
  const profileNavItem = document.getElementById("nav-profile-item");

  if (!guestBox || !userBox) return;

  onAuthStateChanged(auth, (user) => {
    guestBox.classList.toggle("hidden", !!user);
    userBox.classList.toggle("hidden", !user);
    if (profileNavItem) profileNavItem.classList.toggle("hidden", !user);
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("האם להתנתק?")) {
        signOut(auth);
      }
    });
  }

  // מוסיפים לכל קישורי ההתחברות/הרשמה בעמוד את הדף הנוכחי,
  // כדי שאחרי התחברות/הרשמה המשתמש יחזור לכאן ולא תמיד לעמוד הבית
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll('a[href^="login.html"]').forEach((a) => {
    const url = new URL(a.getAttribute("href"), location.href);
    url.searchParams.set("redirect", currentPage);
    a.setAttribute("href", url.pathname + url.search);
  });
})();
