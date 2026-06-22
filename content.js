(() => {
  'use strict';

  /* globals browser, chrome */
  // 跨浏览器 API 命名空间：Firefox → browser，Chromium → chrome，其余为 null
  const extensionAPI = (typeof browser !== 'undefined') ? browser
                     : (typeof chrome  !== 'undefined') ? chrome
                     : null;

  // Chrome/Firefox i18n — returns empty string as safe fallback when unavailable
  const i18n = key => extensionAPI?.i18n?.getMessage(key) || '';

  // ── SVG 图标 ──────────────────────────────────────────────────────────────

  const ICON_COPY = `<svg class="gf-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;

  const ICON_CHECK = `<svg class="gf-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;

  const ICON_ERROR = `<svg class="gf-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

  const BTN_DEFAULT_HTML = `${ICON_COPY}<span class="gf-label">${i18n('copyButton')}</span>`;

  // ── 工具函数 ──────────────────────────────────────────────────────────────

  function tableToPlainText(table) {
    return Array.from(table.querySelectorAll('tr'))
      .map(row =>
        Array.from(row.querySelectorAll('th, td'))
          .map(cell => cell.innerText.trim().replace(/\n+/g, ' '))
          .join('\t')
      )
      .join('\n');
  }

  // 从 style 属性字符串中移除所有 border-* 与 outline 声明
  function stripBorderStyles(el) {
    if (!el.hasAttribute('style')) return;
    const kept = el.getAttribute('style')
      .split(';')
      .filter(decl => {
        const prop = decl.split(':')[0].trim().toLowerCase();
        return prop && !prop.startsWith('border') && prop !== 'outline';
      })
      .join(';')
      .trim()
      .replace(/;+$/, '');
    kept ? el.setAttribute('style', kept) : el.removeAttribute('style');
  }

  // 克隆表格，移除注入按钮，再按模式写入或清除边框样式
  function prepareHTML(table, bordered) {
    const clone = table.cloneNode(true);
    clone.querySelector('.gf-copy-btn')?.remove();

    if (bordered) {
      // 通过 setAttribute 写原始字符串，防止浏览器将 #cccccc 归一化为 rgb()，
      // 确保 Word / WPS 能正确解析内联边框
      clone.setAttribute('border', '1');
      clone.setAttribute('style', 'border-collapse: collapse; border: 1px solid #cccccc;');
      clone.querySelectorAll('th, td').forEach(cell =>
        cell.setAttribute('style', 'border: 1px solid #cccccc; padding: 8px;')
      );
    } else {
      clone.setAttribute('border', '0');
      clone.removeAttribute('cellspacing');
      // 先剥离继承的边框声明，再显式置为 none 以防残留
      [clone, ...clone.querySelectorAll('*')].forEach(stripBorderStyles);
      clone.querySelectorAll('th, td').forEach(cell =>
        cell.setAttribute('style', 'border: none;')
      );
    }

    return clone.outerHTML;
  }

  // execCommand 兜底：通过拦截 copy 事件写入富文本
  // 覆盖不支持 ClipboardItem 的旧版浏览器环境
  function legacyCopy(htmlContent, plainContent) {
    return new Promise((resolve, reject) => {
      const handler = e => {
        try {
          e.clipboardData.setData('text/html', htmlContent);
          e.clipboardData.setData('text/plain', plainContent);
          e.preventDefault();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      document.addEventListener('copy', handler, { once: true });
      if (!document.execCommand('copy')) {
        document.removeEventListener('copy', handler);
        reject(new Error('execCommand copy unavailable'));
      }
    });
  }

  async function copyTableToClipboard(table, button, bordered) {
    const htmlContent  = prepareHTML(table, bordered);
    const plainContent = tableToPlainText(table);
    const successLabel = bordered ? i18n('copySuccessBordered') : i18n('copySuccessBorderless');

    // 第一层：现代标准 Clipboard API（Chrome / Edge / Firefox 87+ / 国产 Chromium）
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html':  new Blob([htmlContent],  { type: 'text/html' }),
            'text/plain': new Blob([plainContent], { type: 'text/plain' }),
          }),
        ]);
        showFeedback(button, 'success', successLabel);
        return;
      } catch { /* 降级 */ }
    }

    // 第二层：writeText（纯文本，所有现代浏览器均支持）
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(plainContent);
        showFeedback(button, 'success', i18n('copySuccessPlain'));
        return;
      } catch { /* 降级 */ }
    }

    // 第三层：execCommand（旧版 Firefox / Safari / 老式国产浏览器兜底）
    try {
      await legacyCopy(htmlContent, plainContent);
      showFeedback(button, 'success', successLabel);
    } catch {
      showFeedback(button, 'error', i18n('copyFailed'));
    }
  }

  function showFeedback(button, type, label) {
    clearTimeout(button._gfTimer);
    const icon = type === 'error' ? ICON_ERROR : ICON_CHECK;
    button.innerHTML = `${icon}<span class="gf-label">${label}</span>`;
    button.dataset.state = type;
    button._gfTimer = setTimeout(() => {
      button.innerHTML = BTN_DEFAULT_HTML;
      delete button.dataset.state;
    }, 2000);
  }

  // ── 注入逻辑 ──────────────────────────────────────────────────────────────

  const processedTables = new WeakSet();

  function injectButton(table) {
    if (processedTables.has(table) || !table.isConnected || !table.parentElement) return;
    processedTables.add(table);

    // 以 table 自身作为定位基准，使按钮处于 overflow 裁剪区域之内
    if (getComputedStyle(table).position === 'static') {
      table.style.position = 'relative';
    }

    const button = document.createElement('button');
    button.className = 'gf-copy-btn';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', i18n('copyAriaLabel'));
    button.innerHTML = BTN_DEFAULT_HTML;

    button.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      copyTableToClipboard(table, button, !e.altKey);
    });

    table.insertBefore(button, table.firstChild);
  }

  // ── 扫描调度 ──────────────────────────────────────────────────────────────

  function scanAndInject() {
    document.querySelectorAll('table').forEach(injectButton);
  }

  let debounceTimer = null;
  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndInject, 250);
  }

  function startObserver() {
    new MutationObserver(scheduleScan).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 兜底轮询：覆盖 Shadow DOM / 虚拟列表 / 懒渲染等极端场景，30 秒后自动停止
  let pollCount = 0;
  const poller = setInterval(() => {
    scanAndInject();
    if (++pollCount >= 30) clearInterval(poller);
  }, 1000);

  scanAndInject();
  startObserver();
})();
