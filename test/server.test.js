const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { createPreviewServer, normalizeOfficePath } = require('../index');
const { normalizeFilePath } = require('../lib/files');

let dir, server, base, fixture, copied;
const token = 'test-session-token';
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-viewer-test-'));
  fixture = path.join(dir, "中文 100% literal%20 'report.docx");
  fs.writeFileSync(fixture, 'synthetic document bytes');
  ({ server } = createPreviewServer({ token, clipboard: async text => { copied = text; } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});
const preview = file => `${base}/?token=${token}&file=${encodeURIComponent(file)}`;

test('document transport preserves literal %, Unicode, spaces and apostrophes', async () => {
  const response = await fetch(preview(fixture));
  assert.equal(response.status, 200);
  const html = await response.text();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  const id = JSON.parse(script.match(/const documentId = (.+);/)[1]);
  const raw = await fetch(`${base}/api/raw?id=${id}`);
  assert.equal(raw.status, 200);
  assert.equal(await raw.text(), fs.readFileSync(fixture, 'utf8'));
  assert.equal(raw.headers.get('access-control-allow-origin'), null);
  assert.equal(raw.headers.get('cache-control'), 'no-store');
});

test('file URLs decode exactly once', async () => {
  assert.equal(normalizeFilePath(pathToFileURL(fixture).href), fixture);
  assert.equal((await fetch(preview(pathToFileURL(fixture).href))).status, 200);
  const literal = String.raw`C:\docs\100% literal%20.docx`;
  assert.equal(normalizeOfficePath(literal), literal);
  assert.equal(normalizeOfficePath('file:///C:/docs/100%25%20literal%2520.docx'), literal);
  assert.equal(normalizeOfficePath(encodeURIComponent(literal)), literal);
  assert.equal(normalizeOfficePath('file://server/share/report.docx'), String.raw`\\server\share\report.docx`);
});

test('rejects unregistered files, missing tokens, foreign origins and hosts', async () => {
  assert.equal((await fetch(`${base}/?file=${encodeURIComponent(fixture)}`)).status, 403);
  assert.equal((await fetch(`${base}/api/raw?file=${encodeURIComponent(fixture)}`)).status, 403);
  assert.equal((await fetch(`${base}/api/raw?id=guessed`)).status, 403);
  assert.equal((await fetch(preview(fixture), { headers: { Origin: 'https://example.test' } })).status, 403);
  const status = await new Promise((resolve, reject) => {
    const req = require('node:http').get(preview(fixture), { headers: { Host: 'example.test' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(status, 403);
});

test('missing files never resolve to a namesake; malformed URLs do not kill server', async () => {
  assert.equal((await fetch(preview(path.join(dir, 'missing', path.basename(fixture))))).status, 404);
  assert.equal((await fetch(preview('file:///C:/broken%.docx'))).status, 400);
  assert.equal((await fetch(preview(path.join(dir, 'notes.txt')))).status, 415);
  assert.equal((await fetch(`${base}/health`)).status, 200);
});

test('clipboard validates authentication, JSON and body size', async () => {
  const send = (body, authenticated = true) => fetch(`${base}/api/clipboard`, { method: 'POST', headers: authenticated ? { Authorization: `Bearer ${token}` } : {}, body });
  assert.equal((await send('{"text":"中文"}', false)).status, 403);
  assert.equal((await send('bad json')).status, 400);
  assert.equal((await send('{"text":123}')).status, 400);
  assert.equal((await send(JSON.stringify({text: '中文复制'}))).status, 200);
  assert.equal(copied, '中文复制');
  assert.equal((await send('x'.repeat(1024 * 1024 + 1))).status, 413);
});

test('static assets stay inside webview and health excludes session token', async () => {
  assert.equal((await fetch(`${base}/assets/index-by55SFPL.js`)).status, 200);
  assert.notEqual((await fetch(`${base}/%2e%2e%5cpackage.json`)).status, 200);
  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.service, 'antigravity-office-viewer');
  assert.equal(JSON.stringify(health).includes(token), false);
  assert.equal((await fetch(`${base}/api/shutdown`, { method: 'POST' })).status, 403);
});

test('registered documents that disappear return an error without crashing', async () => {
  const file = path.join(dir, 'deleted.docx');
  fs.writeFileSync(file, 'fixture');
  const html = await (await fetch(preview(file))).text();
  const id = JSON.parse(html.match(/const documentId = (.+);/)[1]);
  fs.unlinkSync(file);
  assert.equal((await fetch(`${base}/api/raw?id=${id}`)).status, 404);
  assert.equal((await fetch(`${base}/health`)).status, 200);
});
