const translations = {
  he: {
    "unit-name": "יחידת הבקרה האזורית 509",
    "nav-home": "בית",
    "nav-interface": 'נהלים וממשק מול יב"א 509',
    "nav-gallery": "גלריה",
    "nav-contact": "צור קשר",
    "auth-register": "הרשמה",
    "auth-login": "התחברות",
    "auth-logout": "התנתקות",
    "hero-tagline": "העשייה והמבצעיות<br>בלב ההר",
    "about-title": "אודות היחידה",
    "about-text": `
        יחידת הבקרה האזורית 509, הממוקמת על הר רמון, מהווה את הלב הפועם של חיל האוויר הישראלי בניהול והגנת המרחב האווירי בחלקו הדרומי של המדינה.
        היחידה פועלת באופן רציף ומשמשת כעיניים של המדינה באמצעות בניית תמונת שמיים מלאה, גילוי וסיווג של כלל כלי הטיס באזור.
        בזמן שגרה וחירום, היחידה מנהלת את התנועה האווירית הצפופה, המשלבת טיסות אזרחיות, אימונים ופעילות מבצעית, ומנטרלת איומים על ידי הזנקת מטוסי קרב והכוונתם, לצד סנכרון הדוק עם מערכות ההגנה האווירית.
        מעבר לתפקידה המרכזי ביירוט כלי טיס עוינים, היחידה מלווה ומכוונת תקיפות של חיל האוויר, מספקת מעטפת שליטה לכוחות הקרקע והים, ומנהלת אירועי חיפוש והצלה מורכבים בגזרה — דבר ההופך אותה לציר אסטרטגי ומציל חיים, המאפשר לחיל האוויר לפעול בסנכרון וביעילות מרבית.
      `,
    "link-rpaa": "נהלי רשות התעופה האזרחית לכלי טייס בלתי מאויישים",
    "link-iaf509": 'נהלים וממשק מול יב"א 509',
    "link-table1": "העלאת רחפנים בשבטה",
    "link-table2": "העלאת רחפנים באשקלון",
    "gallery-title": "גלריית תמונות",
    "footer-contact": "לשאלות ובירורים: צרו קשר — 08-6502311 / 08-6502310",
    "footer-copyright": "&copy; 2026 יחידת הבקרה האזורית 509"
  },
  en: {
    "unit-name": "Regional Control Unit 509",
    "nav-home": "Home",
    "nav-interface": "Procedures & Interface with ACU 509",
    "nav-gallery": "Gallery",
    "nav-contact": "Contact",
    "auth-register": "Sign up",
    "auth-login": "Log in",
    "auth-logout": "Log out",
    "hero-tagline": "Action and operations<br>at the heart of the mountain",
    "about-title": "About the Unit",
    "about-text": `
        Regional Control Unit 509, stationed at Mount Ramon, is the beating heart of the Israeli Air Force in managing and defending the airspace in the southern part of the country.
        The unit operates continuously and serves as the nation's eyes by building a complete air picture, detecting and classifying all aircraft in the area.
        In routine and emergency, the unit manages dense air traffic combining civilian flights, training, and operational activity, and neutralizes threats by scrambling and directing fighter jets, alongside tight synchronization with air defense systems.
        Beyond its central role in intercepting hostile aircraft, the unit escorts and directs Air Force strikes, provides a control envelope for ground and naval forces, and manages complex search and rescue events in the sector — making it a strategic, life-saving axis that enables the Air Force to operate in synchronization and maximum efficiency.
      `,
    "link-rpaa": "Civil Aviation Authority Procedures for Unmanned Aircraft",
    "link-iaf509": "Procedures & Interface with ACU 509",
    "link-table1": "Drone Launch in Shivta",
    "link-table2": "Drone Launch in Ashkelon",
    "gallery-title": "Photo Gallery",
    "footer-contact": "For questions and inquiries: Contact us — 08-6502311 / 08-6502310",
    "footer-copyright": "&copy; 2026 Regional Control Unit 509"
  }
};

function applyLanguage(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    const value = translations[lang] && translations[lang][key];
    if (value !== undefined) {
      el.innerHTML = value;
    }
  });

  const currentLabel = document.getElementById("lang-current");
  if (currentLabel) {
    currentLabel.textContent = lang === "he" ? "עברית" : "English";
  }

  localStorage.setItem("site-lang", lang);
}

(function () {
  const toggle = document.getElementById("lang-toggle");
  const dropdown = document.getElementById("lang-dropdown");
  const langSelect = document.getElementById("lang-select");

  if (toggle && dropdown) {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("hidden");
    });

    dropdown.querySelectorAll(".lang-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyLanguage(btn.dataset.lang);
        dropdown.classList.add("hidden");
      });
    });

    document.addEventListener("click", (e) => {
      if (langSelect && !langSelect.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  const saved = localStorage.getItem("site-lang") || "he";
  applyLanguage(saved);
})();
