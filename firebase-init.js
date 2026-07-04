import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsTqXyGXe9VZXuUNKG-fYGAp15xwLnMvQ",
  authDomain: "yaba-web.firebaseapp.com",
  databaseURL: "https://yaba-web-default-rtdb.firebaseio.com",
  projectId: "yaba-web",
  storageBucket: "yaba-web.firebasestorage.app",
  messagingSenderId: "167032653198",
  appId: "1:167032653198:web:9ad59a69232a3af6af90df",
  measurementId: "G-BXSYQ9P6ZH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
