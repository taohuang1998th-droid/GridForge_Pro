const doc      = document.getElementById('doc');
const ppToggle = document.getElementById('ppToggle');
const ppLabel  = ppToggle.querySelector('.tlbl');
const STORE_KEY = 'gf-theme';

function applyTheme(dark) {
  doc.setAttribute('data-theme', dark ? 'dark' : 'light');
  ppToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  ppLabel.textContent = dark ? '深色' : '浅色';
  localStorage.setItem(STORE_KEY, dark ? 'dark' : 'light');
}

ppToggle.addEventListener('click', () => {
  applyTheme(doc.getAttribute('data-theme') !== 'dark');
});

applyTheme(localStorage.getItem(STORE_KEY) !== 'light');
