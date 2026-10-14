const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_SERVER_PORT = 12399;
const serverPort = parseInt(process.env.OFFICE_VIEWER_PORT || DEFAULT_SERVER_PORT, 10);

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

function normalizeFilePath(rawPath) {
  if (!rawPath) return '';
  let p = decodeURIComponent(rawPath).replace(/^file:[\\/]+/i, '');
  if (/^[a-zA-Z]\//.test(p)) {
    p = p.charAt(0) + ':' + p.slice(1);
  }
  return p.replace(/\//g, '\\');
}

function resolveExistingFile(targetFile) {
  if (targetFile && fs.existsSync(targetFile)) return targetFile;
  const base = path.basename(targetFile);
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    path.join(userProfile, '.gemini', 'antigravity', 'scratch', base),
    path.join(userProfile, 'Desktop', base),
    path.join(userProfile, 'Downloads', base),
    path.join(userProfile, 'Documents', base)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return targetFile;
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

// Start Preview HTTP Server
let previewServer = null;
function startPreviewServer() {
  if (previewServer) return;

  previewServer = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${serverPort}`);
    const pathname = reqUrl.pathname;

    // 1. Root / index.html
    if (pathname === '/' || pathname === '/index.html') {
      const rawFile = reqUrl.searchParams.get('file') || '';
      let targetFile = normalizeFilePath(rawFile);
      targetFile = resolveExistingFile(targetFile);
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
        const targetFile = urlParams.get('file');

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
                        path: '/api/raw?file=' + encodeURIComponent(targetFile),
                        fileName: fName,
                        documentCacheId: fName,
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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 2. Binary stream
    if (pathname === '/api/raw') {
      const rawFile = reqUrl.searchParams.get('file');
      let targetFile = normalizeFilePath(rawFile);
      targetFile = resolveExistingFile(targetFile);

      if (targetFile && fs.existsSync(targetFile)) {
        try {
          const stat = fs.statSync(targetFile);
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': stat.size,
            'Access-Control-Allow-Origin': '*'
          });
          fs.createReadStream(targetFile).pipe(res);
          return;
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
          return;
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File not found: ' + targetFile);
        return;
      }
    }

    // 3. Static assets
    if (WEBVIEW_DIR) {
      const cleanPath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
      const assetPath = path.join(WEBVIEW_DIR, cleanPath);
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';

        if (cleanPath.toLowerCase().includes('powerpoint') && cleanPath.endsWith('.js')) {
          let js = fs.readFileSync(assetPath, 'utf8');
          js = js.replace('ad=192,od=108', 'ad=1440,od=810');
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(js);
          return;
        }

        res.writeHead(200, {
          'Content-Type': mime,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end('Not found: ' + pathname);
  });

  previewServer.on('error', (err) => {
    console.error('[Antigravity Office Viewer] Server error:', err.message);
  });
  previewServer.listen(serverPort, '127.0.0.1', () => {
    console.log(`[Antigravity Office Viewer] HTTP server listening on http://127.0.0.1:${serverPort}`);
  });
}

startPreviewServer();

// In-window interceptor script injected via CDP
const INJECTION_SCRIPT = `
(() => {
  if (window.__ag_office_timer) {
    clearInterval(window.__ag_office_timer);
    window.__ag_office_timer = null;
  }

  const oldV5 = document.getElementById('ag-office-container-v5');
  if (oldV5) oldV5.remove();

  console.log('[Antigravity Office Viewer] Interceptor active.');

  const iframePool = window.__ag_office_iframe_pool || new Map();
  window.__ag_office_iframe_pool = iframePool;

  function getActiveOfficePath(rightPane) {
    const header = rightPane.querySelector('.shrink-0');
    if (header) {
      let activeTabId = header.getAttribute('data-active-tab-id');
      const activeBtn = header.querySelector('button.bg-secondary[data-tab-id]');
      if (activeBtn && activeBtn.getAttribute('data-tab-id')) {
        activeTabId = activeBtn.getAttribute('data-tab-id');
      }

      if (activeTabId && activeTabId.startsWith('file__')) {
        let raw = activeTabId.slice(6);
        try { raw = decodeURIComponent(raw); } catch(e) {}
        raw = raw.replace(/^file:[\\/]+/i, '');
        if (/^[a-zA-Z]\\//.test(raw)) {
          raw = raw.charAt(0) + ':' + raw.slice(1);
        }
        raw = raw.replace(/\\//g, '\\\\');
        if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(raw)) {
          return raw;
        }
      }

      if (activeBtn) {
        const title = (activeBtn.getAttribute('title') || activeBtn.textContent || '').trim();
        if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(title)) {
          if (/^[a-zA-Z]:\\\\/i.test(title)) return title;
          for (const knownPath of iframePool.keys()) {
            if (knownPath.toLowerCase().endsWith('\\\\' + title.toLowerCase())) {
              return knownPath;
            }
          }
        }
      }
    }

    let s = window.location.search || '';
    try { s = decodeURIComponent(decodeURIComponent(s)); } catch(e) {}
    let m = s.match(/tab=file__(?:file:[\\/]+)?([a-zA-Z]:[^&]+)/i);
    if (m) {
      let p = m[1].replace(/\\//g, '\\\\');
      if (/\\.(docx|dotx|xlsx|xlsm|xls|csv|tsv|ods|pptx|ppt|pptm)$/i.test(p)) {
        return p;
      }
    }

    return null;
  }

  function tick() {
    const rightPane = document.querySelector('.relative.flex-1.flex.min-w-0.h-full');
    let overlay = document.getElementById('ag-office-container-v6');

    if (!rightPane) {
      if (overlay) overlay.style.display = 'none';
      return;
    }

    // Content area strictly below the header (.shrink-0) and subheader/Artifact row
    const editorArea = rightPane.querySelector('.flex-1.min-h-0');
    const contentArea = editorArea ||
                        rightPane.querySelector('.flex-grow.overflow-hidden') ||
                        rightPane.querySelector('.flex-grow') ||
                        rightPane;

    const filePath = getActiveOfficePath(rightPane);

    if (filePath) {
      if (contentArea !== rightPane) {
        contentArea.style.position = 'relative';
      }

      if (!overlay || overlay.parentElement !== contentArea) {
        if (overlay) overlay.remove();
        overlay = document.createElement('div');
        overlay.id = 'ag-office-container-v6';
        overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:45;overflow:hidden;';
        contentArea.appendChild(overlay);
      }

      overlay.style.display = 'block';

      const normKey = filePath.toLowerCase().replace(/\\//g, '\\\\');
      const isPpt = normKey.endsWith('.pptx') || normKey.endsWith('.ppt') || normKey.endsWith('.pptm');

      overlay.style.background = isPpt ? '#ffffff' : 'var(--background, #1e1e1e)';

      if (!iframePool.has(normKey)) {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;display:block;' +
          (isPpt ? 'background:#ffffff;' : 'background:var(--background, #1e1e1e);');
        iframe.src = 'http://127.0.0.1:${serverPort}?file=' + encodeURIComponent(normKey);
        overlay.appendChild(iframe);
        iframePool.set(normKey, iframe);
      } else {
        const currentIframe = iframePool.get(normKey);
        if (currentIframe.parentElement !== overlay) {
          overlay.appendChild(currentIframe);
        }
        if (currentIframe.style.display !== 'block') {
          currentIframe.style.display = 'block';
        }
      }

      for (const [key, ifr] of iframePool.entries()) {
        if (key !== normKey && ifr.style.display !== 'none') {
          ifr.style.display = 'none';
        }
      }
    } else {
      if (overlay && overlay.style.display !== 'none') {
        overlay.style.display = 'none';
      }
      for (const ifr of iframePool.values()) {
        if (ifr.style.display !== 'none') {
          ifr.style.display = 'none';
        }
      }
    }

    const header = rightPane.querySelector('.shrink-0');
    if (header) {
      const openButtons = Array.from(header.querySelectorAll('button[data-tab-id], button[title]'));
      if (openButtons.length > 0) {
        const openKeys = new Set();
        for (const btn of openButtons) {
          const tabId = btn.getAttribute('data-tab-id') || '';
          const title = (btn.getAttribute('title') || btn.textContent || '').trim().toLowerCase();
          if (tabId.startsWith('file__')) {
            let p = tabId.slice(6);
            try { p = decodeURIComponent(p); } catch(e) {}
            p = p.replace(/^file:[\\/]+/i, '').replace(/\\//g, '\\\\').toLowerCase();
            if (/^[a-zA-Z]\\:/.test(p)) openKeys.add(p);
          }
          if (title) openKeys.add(title);
        }
        for (const [key, ifr] of iframePool.entries()) {
          const baseName = key.split('\\\\').pop().toLowerCase();
          if (!openKeys.has(key) && !openKeys.has(baseName)) {
            ifr.remove();
            iframePool.delete(key);
          }
        }
      }

      // Auto-pin preview tabs so clicking files keeps them open as persistent coexisting tabs
      const tabButtons = header.querySelectorAll('button[data-tab-id]');
      tabButtons.forEach(btn => {
        if (btn.querySelector('.italic') || btn.querySelector('[class*="italic"]')) {
          btn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        }
      });
    }
  }

  try {
    ['pushState', 'replaceState'].forEach(method => {
      const orig = history[method];
      if (orig) {
        history[method] = function() {
          const res = orig.apply(this, arguments);
          setTimeout(tick, 0);
          return res;
        };
      }
    });
    window.addEventListener('popstate', () => setTimeout(tick, 0));
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.shrink-0')) {
        setTimeout(tick, 0);
        setTimeout(tick, 40);
      }
    }, true);
  } catch(e) {}

  window.__ag_office_timer = setInterval(tick, 100);
  tick();
})();
`;

let currentCdpPort = null;
const activeConnections = new Map();

async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(data.includes('webSocketDebuggerUrl') ? port : null);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(300, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function discoverCdpPort() {
  try {
    const netstat = execSync('netstat -ano -p tcp', { encoding: 'utf-8', timeout: 3000 });
    const lines = netstat.split('\n');
    const candidatePorts = [];
    for (const line of lines) {
      if (line.includes('LISTENING') && line.includes('127.0.0.1:')) {
        const match = line.match(/127\.0\.0\.1:(\d+)/);
        if (match) {
          candidatePorts.push(parseInt(match[1]));
        }
      }
    }

    for (const p of [...new Set(candidatePorts)]) {
      const found = await checkPort(p);
      if (found) {
        return found;
      }
    }
  } catch (e) {}
  return null;
}

async function getPageTargets(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          resolve(list.filter(t => t.type === 'page'));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve([]);
    });
  });
}

function connectToPage(page) {
  try {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    activeConnections.set(page.id, ws);

    ws.onopen = () => {
      console.log(`[Antigravity Office Viewer] Attached to: ${page.title}`);
      
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({
        id: 2,
        method: 'Page.addScriptToEvaluateOnNewDocument',
        params: { source: INJECTION_SCRIPT }
      }));
      ws.send(JSON.stringify({
        id: 3,
        method: 'Runtime.evaluate',
        params: { expression: INJECTION_SCRIPT }
      }));
    };

    ws.onclose = () => {
      activeConnections.delete(page.id);
    };

    ws.onerror = () => {
      activeConnections.delete(page.id);
    };
  } catch (e) {
    activeConnections.delete(page.id);
  }
}

async function poll() {
  if (!currentCdpPort) {
    currentCdpPort = await discoverCdpPort();
    if (currentCdpPort) {
      console.log(`[Antigravity Office Viewer] Discovered CDP port: ${currentCdpPort}`);
    }
  }

  if (!currentCdpPort) return;

  const pages = await getPageTargets(currentCdpPort);
  if (pages.length === 0) {
    currentCdpPort = null;
    return;
  }

  for (const page of pages) {
    if (!activeConnections.has(page.id)) {
      connectToPage(page);
    }
  }
}

setInterval(poll, 1500);
poll();
console.log('[Antigravity Office Viewer] Daemon is running. Keep this terminal open or run in background.');
