const http = require('http');
const { spawn } = require('child_process');
const crypto = require('node:crypto');
const { resolveDocument } = require('./lib/files');
const { CdpController, getJson } = require('./lib/cdp');
const { writeState, removeState, stopService } = require('./lib/service');
const VERSION = require('./package.json').version;
const path = require('path');
const fs = require('fs');

const DEFAULT_SERVER_PORT = 12399;
const serverPort = Number(process.env.OFFICE_VIEWER_PORT || DEFAULT_SERVER_PORT);

// Locate vscode-office webview directory
function findVscodeOfficeWebviewDir() {
  // 1. Check bundled / local webview
  const localWebview = path.join(__dirname, 'webview');
  if (fs.existsSync(path.join(localWebview, 'index.html'))) {
    return localWebview;
  }

  // 2. Check installed extension paths
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const searchBases = [
    path.join(userProfile, '.antigravity-ide', 'extensions'),
    path.join(userProfile, '.vscode', 'extensions'),
    path.join(userProfile, '.cursor', 'extensions'),
    path.join(userProfile, '.gemini', 'antigravity-ide', 'extensions')
  ];

  for (const baseDir of searchBases) {
    if (!fs.existsSync(baseDir)) continue;
    try {
      const entries = fs.readdirSync(baseDir);
      for (const e of entries) {
        if (e.startsWith('cweijan.vscode-office')) {
          const candidate = path.join(baseDir, e, 'out', 'webview');
          if (fs.existsSync(path.join(candidate, 'index.html'))) {
            return candidate;
          }
        }
      }
    } catch (err) {}
  }
  return null;
}

const WEBVIEW_DIR = findVscodeOfficeWebviewDir();
if (!WEBVIEW_DIR) {
  console.error('[Antigravity Office Viewer] Warning: webview directory not found. Previews may fail to load.');
} else {
  console.log('[Antigravity Office Viewer] Using webview engine from:', WEBVIEW_DIR);
}

const MIME_TYPES = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon'
};

function sendError(res, status, message) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(message);
}

function copyText(text) {
  return new Promise((resolve, reject) => {
    const proc = spawn('clip.exe', [], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { proc.kill(); reject(new Error('Clipboard write timed out')); }, 5000);
    const done = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
    proc.on('error', done);
    proc.stdin.on('error', done);
    proc.on('close', code => done(code === 0 ? null : new Error('Clipboard write failed')));
    // clip.exe accepts UTF-16LE with a BOM, preserving Chinese text.
    proc.stdin.end(Buffer.from('\ufeff' + text, 'utf16le'));
  });
}

function createPreviewServer({ port = serverPort, token = crypto.randomBytes(32).toString('hex'), status = () => ({}), shutdown = () => {}, clipboard = copyText } = {}) {
  const documents = new Map();
  const documentIds = new Map();
  function registerDocument(file) {
    let id = documentIds.get(file);
    if (!id) {
      id = crypto.randomBytes(24).toString('hex');
      if (documents.size >= 1024) {
        const oldest = documents.keys().next().value;
        documentIds.delete(documents.get(oldest));
        documents.delete(oldest);
      }
      documents.set(id, file);
      documentIds.set(file, id);
    }
    return id;
  }
  const previewServer = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
    const reqUrl = new URL(req.url, 'http://127.0.0.1');
    const pathname = reqUrl.pathname;
    const localPort = previewServer.address()?.port || port;
    const allowedOrigins = new Set([`http://127.0.0.1:${localPort}`, `http://localhost:${localPort}`]);
    if (!allowedOrigins.has(`http://${req.headers.host}`)) { sendError(res, 403, 'Invalid host'); return; }
    if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) { sendError(res, 403, 'Origin not allowed'); return; }
    const authorized = req.headers.authorization === `Bearer ${token}` || reqUrl.searchParams.get('token') === token;
    if (pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ service: 'antigravity-office-viewer', version: VERSION, ...status() }));
      return;
    }
    if (pathname === '/api/shutdown') {
      if (!authorized) { sendError(res, 403, 'Authentication required'); return; }
      if (req.method !== 'POST') { sendError(res, 405, 'Use POST'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}', () => shutdown());
      return;
    }
    if (['/', '/index.html', '/api/clipboard'].includes(pathname) && !authorized) {
      sendError(res, 403, 'Authentication required'); return;
    }
    // 1. Root / index.html
    if (pathname === '/' || pathname === '/index.html') {
      const rawFile = reqUrl.searchParams.get('file') || '';
      if (req.method !== 'GET') { sendError(res, 405, 'Use GET'); return; }
      const targetFile = resolveDocument(rawFile);
      const documentId = registerDocument(targetFile);
      const ext = path.extname(targetFile).toLowerCase();

      let route = 'word';
      if (['.xlsx', '.xls', '.csv', '.tsv', '.ods', '.xlsm'].includes(ext)) {
        route = 'excel';
      } else if (['.pptx', '.ppt', '.pptm'].includes(ext)) {
        route = 'ppt';
      } else if (['.docx', '.dotx'].includes(ext)) {
        route = 'word';
      }

      if (!WEBVIEW_DIR) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('vscode-office webview directory not found');
        return;
      }

      const indexPath = path.join(WEBVIEW_DIR, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf8');

      const config = {
        route: route,
        isPro: true,
        language: 'zh-CN',
        config: {}
      };
      html = html.replace('{{configs}}', JSON.stringify(config).replace(/"/g, '&quot;'));

      const isPpt = route === 'ppt';
      const bodyBg = isPpt ? '#ffffff' : 'var(--vscode-editor-background, #1e1e1e)';

      // Inject clean read-only styles & bridge
      const injection = `
      <style>
        html, body, #root {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: ${bodyBg} !important;
        }
        body {
          background-color: ${bodyBg} !important;
        }

        /* 1. Global Cleanup */
        .excel-readonly-banner,
        .word-readonly-banner,
        .parquet-viewer__readonly-banner,
        [class*="readonly-banner"],
        .dark-mode-toggle,
        .color-mode-toggle,
        [class*="dark-mode-toggle"],
        [class*="color-mode-toggle"],
        .codicon-color-mode,
        .office-sponsor,
        .office-sponsor-bar,
        .office-sponsor--sidebar,
        .excel-bottombar-sponsor,
        .excel-bottombar-right,
        .word-sponsor-footer {
          display: none !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
        }

        /* 2. Word: Pure Preview */
        [data-testid="editor-toolbar"],
        [data-testid="formatting-bar"],
        [data-testid="title-bar"],
        .docx-responsive-toolbar,
        .ep-toolbar,
        .ep-menubar,
        .ep-titlebar,
        .layout-table-resize-handle,
        .layout-table-edge-handle-bottom,
        .layout-table-edge-handle-right,
        .layout-table-row-resize-handle {
          display: none !important;
        }
        .word-viewer {
          height: 100vh !important;
        }
        .word-editor {
          height: 100% !important;
        }
        [contenteditable] {
          cursor: default !important;
          user-select: text !important;
          -webkit-user-modify: read-only !important;
        }

        /* 3. Excel: Pure Preview */
        .x-spreadsheet-toolbar,
        .x-spreadsheet-editor,
        .x-spreadsheet-sheet-image-toolbar {
          display: none !important;
        }
        .x-spreadsheet-contextmenu .x-spreadsheet-item:not(.item-copy),
        .x-spreadsheet-contextmenu .divider {
          display: none !important;
        }
        .excel-viewer {
          height: 100vh !important;
        }

        /* 4. PowerPoint: Continuous Vertical Layout & Pure White Background */
        .ppt-main {
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          width: 1920px !important;
          height: 1080px !important;
          opacity: 0 !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
        .ppt-main-canvas {
          width: 1920px !important;
          height: 1080px !important;
        }
        .ppt-thumbnails-header,
        .ppt-statusbar {
          display: none !important;
        }
        ${isPpt ? `
        .office-viewer-themed,
        .ppt-viewer,
        .ppt-body,
        .ant-layout,
        .ant-layout-sider,
        .ant-layout-sider-children,
        .ppt-thumbnails,
        .ppt-thumbnails.ant-layout-sider,
        .ppt-thumbnails-inner,
        .ppt-thumbnails-list {
          background: #ffffff !important;
          background-color: #ffffff !important;
          --viewer-bg: #ffffff !important;
          --viewer-sider-bg: #ffffff !important;
          border: none !important;
        }
        .ppt-thumbnails,
        .ppt-thumbnails.ant-layout-sider {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          flex: 1 1 100% !important;
        }
        .ant-layout-sider-children,
        .ppt-thumbnails-inner {
          width: 100% !important;
          height: 100% !important;
        }
        .ppt-thumbnails-list {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 32px !important;
          padding: 36px 20px !important;
          overflow-y: auto !important;
          height: 100% !important;
          background: #ffffff !important;
        }
        .ppt-thumb {
          width: 85% !important;
          max-width: 1024px !important;
          height: auto !important;
          aspect-ratio: 16/9 !important;
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08) !important;
          background: #ffffff !important;
          cursor: default !important;
          position: relative !important;
          overflow: hidden !important;
        }
        .ppt-thumb.is-active {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.25) !important;
        }
        .ppt-thumb img {
          width: 100% !important;
          height: auto !important;
          aspect-ratio: 16/9 !important;
          object-fit: contain !important;
          display: block !important;
          border-radius: 7px !important;
          background: #ffffff !important;
        }
        .ppt-thumb-placeholder {
          aspect-ratio: 16/9 !important;
          width: 100% !important;
          background: #f1f5f9 !important;
          border-radius: 8px !important;
        }
        .ppt-thumb-num {
          position: absolute !important;
          top: 12px !important;
          left: 12px !important;
          bottom: auto !important;
          background: rgba(0, 0, 0, 0.6) !important;
          color: #ffffff !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          padding: 4px 10px !important;
          border-radius: 4px !important;
          backdrop-filter: blur(4px) !important;
        }
        ` : `
        .ppt-thumbnails,
        .ppt-thumbnails.ant-layout-sider {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 100% !important;
          flex: 1 1 100% !important;
          background: var(--vscode-editor-background, #1e1e1e) !important;
          border: none !important;
        }
        .ppt-thumbnails-list {
          background: var(--vscode-editor-background, #1e1e1e) !important;
        }
        `}
      </style>
      <script>
      (function() {
        const urlParams = new URLSearchParams(window.location.search);
        const targetFile = ${JSON.stringify(targetFile).replace(/</g, '\\u003c')};
        const documentId = ${JSON.stringify(documentId)};
        const sessionToken = ${JSON.stringify(token)};
        const originalFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
          const url = new URL(typeof input === 'string' ? input : input.url, location.href);
          if (url.origin === location.origin && url.pathname === '/api/clipboard') {
            const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
            headers.set('Authorization', 'Bearer ' + sessionToken);
            init = { ...init, headers };
          }
          return originalFetch(input, init);
        };

        ${isPpt ? `
        try {
          localStorage.setItem('office-dark-mode', '0');
          document.body.classList.remove('office-dark');
          document.body.style.backgroundColor = '#ffffff';
        } catch(e) {}
        ` : `
        try {
          localStorage.setItem('office-dark-mode', '1');
          document.body.classList.add('office-dark');
        } catch(e) {}
        `}

        window.acquireVsCodeApi = function() {
          return {
            postMessage: function(msg) {
              if (msg && msg.type === 'init') {
                if (targetFile) {
                  const fName = targetFile.split(/[\\\\/]/).pop();
                  const fExt = '.' + fName.split('.').pop().toLowerCase();
                  setTimeout(function() {
                    window.postMessage({
                      type: 'open',
                      content: {
                        ext: fExt,
                        path: '/api/raw?id=' + documentId,
                        fileName: fName,
                        documentCacheId: ${JSON.stringify(targetFile + ':' + fs.statSync(targetFile).mtimeMs).replace(/</g, '\\u003c')},
                        readOnly: true
                      }
                    }, '*');
                  }, 30);
                }
              }
            },
            getState: function() { return { darkMode: ${!isPpt} }; },
            setState: function() {}
          };
        };

        document.addEventListener('focusin', function(e) {
          if (e.target && e.target.getAttribute('contenteditable') === 'true') {
            e.target.setAttribute('contenteditable', 'false');
          }
        }, true);
      })();
      </script>
      `;

      html = html.replace('</head>', injection + '</head>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    if (pathname === '/api/raw') {
      if (req.method !== 'GET') { sendError(res, 405, 'Use GET'); return; }
      const targetFile = documents.get(reqUrl.searchParams.get('id'));
      if (!targetFile) { sendError(res, 403, 'Unknown document'); return; }
      const stat = fs.statSync(targetFile);
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store' });
      const stream = fs.createReadStream(targetFile);
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
      return;
    }
    if (pathname === '/api/clipboard') {
      if (req.method !== 'POST') { sendError(res, 405, 'Use POST'); return; }
      let size = 0;
      const chunks = [];
      let tooLarge = false;
      req.on('error', () => { if (!res.writableEnded) sendError(res, 400, 'Invalid request body'); });
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          if (!tooLarge) sendError(res, 413, 'Clipboard text is too large');
          tooLarge = true;
          chunks.length = 0;
        } else if (!tooLarge) chunks.push(chunk);
      });
      req.on('end', async () => {
        if (tooLarge) return;
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof data.text !== 'string') { sendError(res, 400, 'Text is required'); return; }
          await clipboard(data.text);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end('{"ok":true}');
        } catch (error) { sendError(res, error instanceof SyntaxError ? 400 : 500, 'Clipboard write failed'); }
      });
      return;
    }
    // 3. Static assets
    if (WEBVIEW_DIR) {
      if (req.method !== 'GET') { sendError(res, 405, 'Use GET'); return; }
      const cleanPath = decodeURIComponent(pathname);
      const assetPath = path.resolve(WEBVIEW_DIR, '.' + cleanPath);
      const relative = path.relative(WEBVIEW_DIR, assetPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) { sendError(res, 403, 'Invalid asset path'); return; }
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const realRelative = path.relative(fs.realpathSync(WEBVIEW_DIR), fs.realpathSync(assetPath));
        if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) { sendError(res, 403, 'Invalid asset path'); return; }
        const ext = path.extname(assetPath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';

        if (cleanPath.toLowerCase().includes('powerpoint') && cleanPath.endsWith('.js')) {
          let js = fs.readFileSync(assetPath, 'utf8');
          js = js.replace('ad=192,od=108', 'ad=1440,od=810');
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache'
          });
          res.end(js);
          return;
        }

        res.writeHead(200, {
          'Content-Type': mime,
          'Cache-Control': 'no-cache'
        });
        const stream = fs.createReadStream(assetPath);
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }
    }

    sendError(res, 404, 'Not found');
    } catch (error) {
      const status = error.status || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : error instanceof URIError ? 400 : error.code === 'EACCES' ? 403 : 500);
      sendError(res, status, status === 404 ? 'Document or resource not found' : status === 500 ? 'Unable to load document or resource' : error.message);
    }
  });
  return { server: previewServer, token };
}

// In-window interceptor script injected via CDP
function normalizeOfficePath(raw) {
  if (!raw) return '';
  for (let i = 0; i < 2 && !/^(?:file:|[a-z]:[\/]|\\)/i.test(raw); i++) {
    try { const next = decodeURIComponent(raw); if (next === raw) break; raw = next; } catch { break; }
  }
  if (/^file:/i.test(raw)) {
    try {
      const url = new URL(raw);
      raw = decodeURIComponent(url.pathname);
      if (url.hostname && url.hostname !== 'localhost') raw = '\\\\' + url.hostname + raw;
      else raw = raw.replace(/^\/([a-z]:)/i, '$1');
    } catch { return ''; }
  }
  return raw.replace(/\//g, '\\');
}

function buildInjectionScript(serverPort, token) {
return `
(() => {
  if (window.__ag_office_dispose) window.__ag_office_dispose();
  const abort = new AbortController();
  const pendingTimers = new Set();
  const later = (fn, delay) => { const id = setTimeout(() => { pendingTimers.delete(id); fn(); }, delay); pendingTimers.add(id); };
  if (window.__ag_office_timer) {
    clearInterval(window.__ag_office_timer);
    window.__ag_office_timer = null;
  }

  const oldV5 = document.getElementById('ag-office-container-v5');
  if (oldV5) oldV5.remove();

  console.log('[Antigravity Office Viewer] Interceptor active.');

  if (window.__ag_office_session !== '${token}') {
    for (const frame of (window.__ag_office_iframe_pool || new Map()).values()) frame.remove();
    window.__ag_office_iframe_pool = new Map();
    window.__ag_office_session = '${token}';
  }
  const iframePool = window.__ag_office_iframe_pool || new Map();
  window.__ag_office_iframe_pool = iframePool;

  const normalizeOfficePath = ${normalizeOfficePath.toString()};

  function getActiveOfficePath(rightPane) {
    const tabBtns = Array.from(rightPane.querySelectorAll('button[data-tab-id]'));
    const activeBtn = tabBtns.find(b => b.classList.contains('bg-secondary') || b.className.includes('bg-secondary'));

    let tabId = activeBtn ? activeBtn.getAttribute('data-tab-id') : null;
    if (!tabId) {
      const header = rightPane.querySelector('[data-active-tab-id]');
      if (header) tabId = header.getAttribute('data-active-tab-id');
    }

    if (tabId && tabId.startsWith('file__')) {
      const normalized = normalizeOfficePath(tabId.slice(6));
      if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(normalized)) {
        return normalized;
      }
    }

    if (activeBtn) {
      const title = (activeBtn.getAttribute('title') || activeBtn.textContent || '').trim();
      if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(title)) {
        for (const knownPath of iframePool.keys()) {
          if (knownPath.toLowerCase().endsWith('\\\\' + title.toLowerCase())) {
            return knownPath;
          }
        }
      }
    }

    const queryTab = new URLSearchParams(window.location.search || '').get('tab');
    if (queryTab && queryTab.startsWith('file__')) {
      const normalized = normalizeOfficePath(queryTab.slice(6));
      if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(normalized)) return normalized;
    }

    return null;
  }

  function getEditorCell(rightPane) {
    const subbar = rightPane.querySelector('[class*="group/file-row"]');
    if (!subbar) return null;
    const body = subbar.nextElementSibling;
    if (!body) return null;
    const splitContainer = body.querySelector('[style*="container-type: size"]');
    if (splitContainer && splitContainer.firstElementChild) {
      return splitContainer.firstElementChild;
    }
    return body;
  }

  function tick() {
    const rightPane = document.querySelector('.relative.flex-1.flex.min-w-0.h-full');
    let overlay = document.getElementById('ag-office-container-v6');

    if (!rightPane) {
      if (overlay) overlay.style.display = 'none';
      return;
    }

    const normKey = getActiveOfficePath(rightPane);

    if (normKey) {
      const targetCell = getEditorCell(rightPane);
      if (!targetCell) return;

      if (getComputedStyle(targetCell).position === 'static') {
        targetCell.style.position = 'relative';
      }

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ag-office-container-v6';
        targetCell.appendChild(overlay);
      } else if (overlay.parentElement !== targetCell) {
        targetCell.appendChild(overlay);
      }

      overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:20;overflow:hidden;';
      overlay.style.display = 'block';

      const isPpt = normKey.endsWith('.pptx') || normKey.endsWith('.ppt') || normKey.endsWith('.pptm');
      overlay.style.background = isPpt ? '#ffffff' : 'var(--background, #1e1e1e)';

      // Clean up any stale keys from iframePool that start with 'file:'
      for (const k of Array.from(iframePool.keys())) {
        if (k.startsWith('file:') || k.startsWith('file\\\\')) {
          const oldIfr = iframePool.get(k);
          if (oldIfr) oldIfr.remove();
          iframePool.delete(k);
        }
      }

      let iframe = iframePool.get(normKey);
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;display:block;' +
          (isPpt ? 'background:#ffffff;' : 'background:var(--background, #1e1e1e);');
        iframe.src = 'http://127.0.0.1:${serverPort}?token=${token}&file=' + encodeURIComponent(normKey);
        iframe.title = 'Office document preview';
        overlay.appendChild(iframe);
        iframePool.set(normKey, iframe);
      } else {
        if (iframe.parentElement !== overlay) {
          overlay.appendChild(iframe);
        }
        if (iframe.style.display !== 'block') {
          iframe.style.display = 'block';
        }
      }

      for (const [key, ifr] of iframePool.entries()) {
        if (key !== normKey && ifr.style.display !== 'none') {
          ifr.style.display = 'none';
        }
      }

      const tabBtns = Array.from(rightPane.querySelectorAll('button[data-tab-id]'));
      if (tabBtns.length > 0) {
        const openKeys = new Set();
        for (const btn of tabBtns) {
          const tabId = btn.getAttribute('data-tab-id') || '';
          if (tabId.startsWith('file__')) {
            const p = normalizeOfficePath(tabId.slice(6));
            if (p) openKeys.add(p);
          }
          const title = (btn.getAttribute('title') || btn.textContent || '').trim().toLowerCase();
          if (title) openKeys.add(title);
        }
        for (const [key, ifr] of iframePool.entries()) {
          const baseName = key.split('\\\\').pop().toLowerCase();
          if (key !== normKey && !openKeys.has(key) && !openKeys.has(baseName)) {
            ifr.remove();
            iframePool.delete(key);
          }
        }
      }

      tabBtns.forEach(btn => {
        if (btn.querySelector('.italic') || btn.querySelector('[class*="italic"]')) {
          btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        }
      });

      // Filter out invalid actions from subbar more-actions menu
      document.querySelectorAll('[role="menuitem"]').forEach(item => {
        const text = item.innerText.trim();
        if (['Copy Content', 'Search', '复制内容', '搜索'].includes(text)) {
          item.style.setProperty('display', 'none', 'important');
        }
      });
    } else {
      if (overlay && overlay.style.display !== 'none') {
        overlay.style.display = 'none';
      }
      for (const ifr of iframePool.values()) {
        if (ifr.style.display !== 'none') {
          ifr.style.display = 'none';
        }
      }
      document.querySelectorAll('[role="menuitem"]').forEach(item => {
        if (item.style.display === 'none') {
          item.style.removeProperty('display');
        }
      });
    }
  }

  const originalHistory = {};
  const wrappedHistory = {};
  let menuObserver;
  try {
    ['pushState', 'replaceState'].forEach(method => {
      const orig = history[method];
      if (orig) {
        originalHistory[method] = orig;
        history[method] = wrappedHistory[method] = function() {
          const res = orig.apply(this, arguments);
          later(tick, 0);
          return res;
        };
      }
    });
    window.addEventListener('popstate', () => later(tick, 0), { signal: abort.signal });
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('button[data-tab-id]')) {
        later(tick, 0);
        later(tick, 40);
      }
    }, { capture: true, signal: abort.signal });

    window.addEventListener('message', (e) => {
      const trusted = e.origin === 'http://127.0.0.1:${serverPort}' && [...iframePool.values()].some(frame => frame.style.display !== 'none' && frame.contentWindow === e.source);
      if (trusted && e.data && e.data.type === 'ag_office_copy' && typeof e.data.text === 'string') {
        try {
          navigator.clipboard.writeText(e.data.text).catch(() => {});
        } catch(err) {}
      }
    }, { signal: abort.signal });

    menuObserver = new MutationObserver((mutations) => {
      const rightPane = document.querySelector('.relative.flex-1.flex.min-w-0.h-full');
      if (!rightPane || !getActiveOfficePath(rightPane)) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const items = node.matches && node.matches('[role="menuitem"]')
              ? [node]
              : Array.from(node.querySelectorAll ? node.querySelectorAll('[role="menuitem"]') : []);
            items.forEach(item => {
              const text = item.innerText.trim();
              if (['Copy Content', 'Search', '复制内容', '搜索'].includes(text)) {
                item.style.setProperty('display', 'none', 'important');
              }
            });
          }
        }
      }
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });
  } catch(e) {}

  window.__ag_office_dispose = () => {
    abort.abort();
    if (menuObserver) menuObserver.disconnect();
    clearInterval(window.__ag_office_timer);
    for (const timer of pendingTimers) clearTimeout(timer);
    for (const method of Object.keys(originalHistory)) {
      if (history[method] === wrappedHistory[method]) history[method] = originalHistory[method];
    }
  };
  window.__ag_office_timer = setInterval(tick, 500);
  tick();
})();
`;
}

async function main() {
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) throw new Error('OFFICE_VIEWER_PORT must be an integer between 1 and 65535');
  if (process.argv.includes('--stop')) { await stopService(serverPort); return; }
  if (process.argv.includes('--status')) {
    const status = await getJson(serverPort, '/health');
    if (status?.service !== 'antigravity-office-viewer') throw new Error('Viewer service is not running');
    console.log(JSON.stringify(status, null, 2)); return;
  }
  if (typeof WebSocket !== 'function') throw new Error('Node.js 22 or later with built-in WebSocket support is required');
  if (!WEBVIEW_DIR) throw new Error('Bundled webview resources are missing; reinstall the viewer');
  let controller;
  let pollTimer;
  let stopping = false;
  const close = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(pollTimer);
    controller?.stop();
    removeState(serverPort, token);
    server.close();
    server.closeAllConnections();
  };
  const { server, token } = createPreviewServer({ shutdown: close, status: () => ({ cdpPort: controller?.port || null, attachedPages: controller?.attachedPages || 0 }) });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(serverPort, '127.0.0.1', resolve); });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      const existing = await getJson(serverPort, '/health');
      if (existing?.service === 'antigravity-office-viewer') { console.log('[Antigravity Office Viewer] Service already running.'); return; }
    }
    throw error;
  }
  try {
    writeState(serverPort, token);
    const requestedPort = process.env.OFFICE_VIEWER_CDP_PORT ? Number(process.env.OFFICE_VIEWER_CDP_PORT) : null;
    if (requestedPort !== null && (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535)) throw new Error('Invalid OFFICE_VIEWER_CDP_PORT');
    controller = new CdpController({ script: buildInjectionScript(serverPort, token), requestedPort, onHostGone: process.argv.includes('--daemon') ? close : () => {} });
    pollTimer = setInterval(() => controller.poll(), 3000);
    controller.poll();
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    server.on('error', error => { console.error(error.message); close(); });
    console.log(`[Antigravity Office Viewer] HTTP server listening on http://127.0.0.1:${serverPort}`);
    console.log('[Antigravity Office Viewer] Waiting for Antigravity CDP. Use --status or --stop to manage the service.');
  } catch (error) { close(); throw error; }
}

if (require.main === module) main().catch(error => { console.error('[Antigravity Office Viewer]', error.message); process.exitCode = 1; });
module.exports = { createPreviewServer, buildInjectionScript, normalizeOfficePath };
