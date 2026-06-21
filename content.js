(() => {
  'use strict';

  // ---------- SVG 图标常量 ----------

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

  const BTN_DEFAULT_HTML = `${ICON_COPY}<span class="gf-label">复制</span>`;

  // ---------- 核心工具函数 ----------

  function tableToPlainText(table) {
    return Array.from(table.querySelectorAll('tr'))
      .map(row =>
        Array.from(row.querySelectorAll('th, td'))
          .map(cell => cell.innerText.trim().replace(/\n+/g, ' '))
          .join('\t')
      )
      .join('\n');
  }

  // 从 style 属性字符串中删除所有 border-* 和 outline 声明
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

  // 克隆表格，移除注入按钮，按模式写入/清除边框样式
  function prepareHTML(table, bordered) {
    const clone = table.cloneNode(true);

    // Bug 1：精准移除克隆内的注入按钮，防止文本污染剪贴板
    clone.querySelector('.gf-copy-btn')?.remove();

    if (bordered) {
      // Bug 2：border="1" 在现代 Word/WPS 中经常失效，
      // 必须用内联 style 明确告知每个单元格边框。
      // 用 setAttribute 写字符串，避免浏览器把 #cccccc 归一化为 rgb(...)
      clone.setAttribute('border', '1');
      clone.setAttribute(
        'style',
        'border-collapse: collapse; border: 1px solid #cccccc;'
      );
      clone.querySelectorAll('th, td').forEach(cell => {
        cell.setAttribute(
          'style',
          'border: 1px solid #cccccc; padding: 8px;'
        );
      });
    } else {
      clone.setAttribute('border', '0');
      clone.removeAttribute('cellspacing');
      // 先剥离所有继承的 border CSS，再明文设为 none 防止残留
      [clone, ...clone.querySelectorAll('*')].forEach(stripBorderStyles);
      clone.querySelectorAll('th, td').forEach(cell => {
        cell.setAttribute('style', 'border: none;');
      });
    }

    return clone.outerHTML;
  }

  // bordered=true → 带框线；bordered=false → 无框线
  async function copyTableToClipboard(table, button, bordered) {
    const htmlContent  = prepareHTML(table, bordered);
    const plainContent = tableToPlainText(table);
    const successLabel = bordered ? '已复制（带框线）' : '已复制（无框线）';

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainContent], { type: 'text/plain' }),
        }),
      ]);
      showFeedback(button, 'success', successLabel);
    } catch {
      try {
        await navigator.clipboard.writeText(plainContent);
        showFeedback(button, 'success', '纯文本');
      } catch (err) {
        showFeedback(button, 'error', '失败');
        console.error('[GridForge] 复制失败:', err);
      }
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

  // ---------- 注入逻辑 ----------

  // 已处理表格集合 — WeakSet 不阻止 GC
  const processedTables = new WeakSet();

  function injectButton(table) {
    if (processedTables.has(table)) return;

    // 表格必须已挂载到文档，否则跳过（等待下次扫描）
    if (!table.isConnected) return;

    processedTables.add(table);

    const parent = table.parentElement;
    if (!parent) return;

    // 让 table 自身成为按钮的定位基准，按钮就在 overflow 裁剪范围之内，
    // 父级容器的 overflow:hidden / overflow-x:auto 不再能裁剪它
    if (getComputedStyle(table).position === 'static') {
      table.style.position = 'relative';
    }

    const button = document.createElement('button');
    button.className = 'gf-copy-btn';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'GridForge 一键复制表格');
    button.innerHTML = BTN_DEFAULT_HTML;

    button.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      copyTableToClipboard(table, button, !e.altKey);
    });

    // 插入到 table 内部最前方；position:absolute 将其移出正常流，不影响表格布局
    table.insertBefore(button, table.firstChild);
  }

  // ---------- 扫描调度 ----------

  function scanAndInject() {
    document.querySelectorAll('table').forEach(injectButton);
  }

  // 防抖：流式输出期间 mutations 高频触发，合并为一次扫描
  let debounceTimer = null;
  function scheduleScan() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanAndInject, 250);
  }

  // MutationObserver：监听整棵 DOM 树的子节点变化
  function startObserver() {
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 兜底轮询：应对 Shadow DOM / 虚拟化列表 / 懒渲染等极端场景
  // 每秒扫描一次，持续 30 秒后停止
  let pollCount = 0;
  const poller = setInterval(() => {
    scanAndInject();
    if (++pollCount >= 30) clearInterval(poller);
  }, 1000);

  // ---------- 启动 ----------
  scanAndInject();   // 立即兜底扫描
  startObserver();   // 监听后续 DOM 变化
})();
