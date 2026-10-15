const http = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

function getJson(port, route, timeout = 1500) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    const req = http.get({ hostname: '127.0.0.1', port, path: route }, (res) => {
      if (res.statusCode !== 200) { res.resume(); done(null); return; }
      let body = '';
      res.on('error', () => done(null));
      res.on('data', chunk => {
        body += chunk;
        if (body.length > 1024 * 1024) { req.destroy(); done(null); }
      });
      res.on('end', () => { try { done(JSON.parse(body)); } catch { done(null); } });
    });
    req.on('error', () => done(null));
    const timer = setTimeout(() => { req.destroy(); done(null); }, timeout);
    req.on('close', () => clearTimeout(timer));
  });
}

async function inspectAntigravity(run = execFileAsync) {
  if (process.platform !== 'win32' && run === execFileAsync) return { running: false, ports: [] };
  // Join listening sockets to the actual executable's PID, rather than probing
  // every local Chrome/Electron debugging endpoint.
  const command = `$ErrorActionPreference='Stop'; $apps=@(Get-Process -Name Antigravity -ErrorAction SilentlyContinue); $ids=@($apps | Select-Object -ExpandProperty Id); $ports=@(); if($ids.Count -gt 0){$ports=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $ids -contains $_.OwningProcess -and $_.LocalAddress -eq '127.0.0.1' } | Select-Object -ExpandProperty LocalPort -Unique)}; @{running=($ids.Count -gt 0);ports=$ports} | ConvertTo-Json -Compress`;
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024
  });
  const result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  return { running: result.running === true, ports: (Array.isArray(result.ports) ? result.ports : [result.ports]).map(Number).filter(p => Number.isInteger(p) && p > 0 && p <= 65535) };
}

function validDebuggerUrl(value, port) {
  try {
    const url = new URL(value);
    return url.protocol === 'ws:' && ['127.0.0.1', 'localhost'].includes(url.hostname) && Number(url.port) === port;
  } catch { return false; }
}

class CdpController {
  constructor({ script, inspect = inspectAntigravity, json = getJson, WebSocketImpl = globalThis.WebSocket, log = console.log, onHostGone = () => {}, requestedPort = null }) {
    Object.assign(this, { script, inspect, json, WebSocketImpl, log, onHostGone, requestedPort });
    this.connections = new Map();
    this.port = null;
    this.stopped = false;
    this.inFlight = false;
    this.lastHostSeen = Date.now();
    this.lastError = '';
  }
  get attachedPages() { return [...this.connections.values()].filter(c => c.attached).length; }
  async poll() {
    if (this.stopped || this.inFlight) return;
    this.inFlight = true;
    try {
      const host = await this.inspect();
      if (this.stopped) return;
      if (host.running) this.lastHostSeen = Date.now();
      else {
        this.disconnect();
        if (Date.now() - this.lastHostSeen > 30000) this.onHostGone();
        return;
      }
      const ownedPorts = this.requestedPort ? host.ports.filter(p => p === this.requestedPort) : host.ports;
      if (this.port && !ownedPorts.includes(this.port)) this.disconnect();
      if (!this.port) {
        for (const port of ownedPorts) {
          const version = await this.json(port, '/json/version');
          if (this.stopped) return;
          if (version && validDebuggerUrl(version.webSocketDebuggerUrl, port)) {
            this.port = port;
            this.log(`[Antigravity Office Viewer] Discovered CDP port: ${port}`);
            break;
          }
        }
      }
      if (!this.port) return;
      const pages = await this.json(this.port, '/json/list');
      if (this.stopped) return;
      if (!Array.isArray(pages)) { this.disconnect(); return; }
      const targets = pages.filter(p => p.type === 'page' && !/^devtools:/i.test(p.url || '') && validDebuggerUrl(p.webSocketDebuggerUrl, this.port));
      const ids = new Set(targets.map(p => p.id));
      for (const [id, connection] of this.connections) if (!ids.has(id)) { connection.ws.close(); this.connections.delete(id); }
      for (const page of targets) if (!this.connections.has(page.id)) this.connect(page);
      this.lastError = '';
    } catch (error) {
      if (this.lastError !== error.message) this.log(`[Antigravity Office Viewer] CDP discovery failed: ${error.message}`);
      this.lastError = error.message;
    } finally { this.inFlight = false; }
  }
  connect(page) {
    const ws = new this.WebSocketImpl(page.webSocketDebuggerUrl);
    const connection = { ws, attached: false };
    this.connections.set(page.id, connection);
    const forget = () => { clearTimeout(timer); if (this.connections.get(page.id) === connection) this.connections.delete(page.id); };
    const timer = setTimeout(() => { ws.close(); forget(); }, 6000);
    ws.onopen = () => {
      // Probe the editor before changing the page. Other windows belonging to
      // Antigravity (settings, sign-in, etc.) must not receive the interceptor.
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `Boolean(document.querySelector('.relative.flex-1.flex.min-w-0.h-full'))`, returnByValue: true } }));
    };
    ws.onmessage = (event) => {
      let response;
      try { response = JSON.parse(event.data); } catch { return; }
      if (response.id === 1) {
        if (response.result?.result?.value !== true) { ws.close(); forget(); return; }
        ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));
        ws.send(JSON.stringify({ id: 3, method: 'Page.addScriptToEvaluateOnNewDocument', params: { source: this.script } }));
        ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: { expression: this.script } }));
      }
      if ([2, 3, 4].includes(response.id) && (response.error || response.result?.exceptionDetails)) {
        this.log(`[Antigravity Office Viewer] Injection failed: ${JSON.stringify(response.error || response.result.exceptionDetails)}`);
        ws.close(); forget(); return;
      }
      if (response.id === 4) {
        connection.attached = true;
        clearTimeout(timer);
        this.log(`[Antigravity Office Viewer] Attached to: ${page.title || page.id}`);
      }
    };
    ws.onclose = forget;
    ws.onerror = () => { ws.close(); forget(); };
  }
  disconnect() {
    for (const { ws } of this.connections.values()) ws.close();
    this.connections.clear();
    this.port = null;
  }
  stop() { this.stopped = true; this.disconnect(); }
}
module.exports = { getJson, inspectAntigravity, validDebuggerUrl, CdpController };
