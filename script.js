// טופס הסכמה - כפתור השליחה נפתח רק אחרי סימון תיבת האישור.
// לוגיקת השליחה עצמה (כולל תוקף חתימה של שבוע) נמצאת ב-table-realtime.js
(function () {
  const form = document.getElementById('consent-form');
  if (!form) return;

  const checkbox = document.getElementById('consent-checkbox');
  const submitBtn = document.getElementById('consent-submit');

  checkbox.addEventListener('change', () => {
    submitBtn.disabled = !checkbox.checked;
  });
})();

// לוגיקת הטבלה בזמן אמת (הוספה/סטטוס/חלון שעות/איפוס יומי) נמצאת ב-table-realtime.js

// תפריט המבורגר לניווט במובייל
(function () {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });
})();
