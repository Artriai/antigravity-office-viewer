const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
function statePath(port) {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'state'), 'antigravity-office-viewer', `service-${port}.json`);
}
function writeState(port, token) {
  const file = statePath(port);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + `.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify({ token, pid: process.pid }), { mode: 0o600 });
    fs.renameSync(temp, file);
  } finally { try { fs.unlinkSync(temp); } catch {} }
}
function removeState(port, token) {
  try { const file = statePath(port); if (JSON.parse(fs.readFileSync(file, 'utf8')).token === token) fs.unlinkSync(file); } catch {}
}
function stopService(port) {
  let token;
  try { token = JSON.parse(fs.readFileSync(statePath(port), 'utf8')).token; }
  catch { throw new Error('No viewer service state found. For a legacy service, stop its Node.js process manually.'); }
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/api/shutdown', method: 'POST', headers: { Authorization: `Bearer ${token}` } }, res => {
      res.resume();
      res.on('end', () => res.statusCode === 200 ? resolve() : reject(new Error(`Stop failed: HTTP ${res.statusCode}`)));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('Stop request timed out')));
    req.end();
  });
}
module.exports = { writeState, removeState, stopService };
