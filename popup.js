// 跨浏览器 API 抹平（Firefox 用 browser.*，其余用 chrome.*）
const extensionAPI = (typeof browser !== 'undefined') ? browser : chrome; // eslint-disable-line no-undef

const doc      = document.getElementById('doc');
const ppToggle = document.getElementById('ppToggle');
const ppLabel  = ppToggle.querySelector('.tlbl');
const STORE_KEY = 'gf-theme';

function applyTheme(dark) {
  doc.setAttribute('data-theme', dark ? 'dark' : 'light');
  ppToggle.setAttribute('aria-pressed', dark);
  ppLabel.textContent = dark ? '深色' : '浅色';
  localStorage.setItem(STORE_KEY, dark ? 'dark' : 'light');
}

ppToggle.addEventListener('click', () => {
  applyTheme(doc.getAttribute('data-theme') !== 'dark');
});

// 读取上次用户选择，默认深色
const saved = localStorage.getItem(STORE_KEY);
applyTheme(saved !== 'light');
