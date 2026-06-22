/* globals browser, chrome */
const api = (typeof browser !== 'undefined') ? browser
          : (typeof chrome  !== 'undefined') ? chrome : null;
const i18n = key => api?.i18n?.getMessage(key) || '';

const doc      = document.getElementById('doc');
const ppToggle = document.getElementById('ppToggle');
const ppLabel  = ppToggle.querySelector('.tlbl');
const STORE_KEY = 'gf-theme';

function applyTheme(dark) {
  doc.setAttribute('data-theme', dark ? 'dark' : 'light');
  ppToggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  ppLabel.textContent = i18n(dark ? 'themeDark' : 'themeLight');
  localStorage.setItem(STORE_KEY, dark ? 'dark' : 'light');
}

ppToggle.addEventListener('click', () => {
  applyTheme(doc.getAttribute('data-theme') !== 'dark');
});

// Set page language to match the active browser locale
const uiLang = (api?.i18n?.getUILanguage?.() || 'zh-CN').replace(/_/g, '-');
document.documentElement.setAttribute('lang', uiLang);

// Populate i18n text: aria-label and step instructions
ppToggle.setAttribute('aria-label', i18n('toggleAriaLabel'));
document.getElementById('step1').innerHTML = i18n('step1Text');
document.getElementById('step2').innerHTML = i18n('step2Text');

applyTheme(localStorage.getItem(STORE_KEY) !== 'light');
