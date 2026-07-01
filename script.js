// טופס הסכמה - נדרש מחדש בכל כניסה לעמוד, לפני חשיפת הטבלה
(function () {
  const form = document.getElementById('consent-form');
  if (!form) return;

  const checkbox = document.getElementById('consent-checkbox');
  const submitBtn = document.getElementById('consent-submit');
  const tableSection = document.getElementById('table-section');

  checkbox.addEventListener('change', () => {
    submitBtn.disabled = !checkbox.checked;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    form.classList.add('hidden');
    tableSection.classList.remove('hidden');
  });
})();
