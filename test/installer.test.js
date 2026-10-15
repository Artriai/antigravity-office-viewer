const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('Windows installer deploys modules, updates safely and rejects conflicting DLLs', {skip:process.platform !== 'win32', timeout:60000}, () => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'office-install-'));
  const install = () => spawnSync('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','install.ps1'),'-TargetDir',dir], {encoding:'utf8',timeout:20000,windowsHide:true});
  try {
    fs.writeFileSync(path.join(dir,'Antigravity.exe'),'fixture, not executable');
    let result = install();
    assert.equal(result.status,0,result.stdout+result.stderr);
    for (const file of ['index.js','package.json','lib/files.js','lib/cdp.js','lib/service.js','webview/index.html','manage.bat']) {
      assert.equal(fs.readFileSync(path.join(dir,'office-viewer',file),'utf8'),fs.readFileSync(path.join(root,file),'utf8'));
    }
    fs.writeFileSync(path.join(dir,'office-viewer','old-file.txt'),'old version');
    result = install();
    assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(fs.existsSync(path.join(dir,'office-viewer','old-file.txt')),false);
    fs.writeFileSync(path.join(dir,'winmm.dll'),'conflicting fixture');
    result = install();
    assert.notEqual(result.status,0);
    assert.equal(fs.readFileSync(path.join(dir,'winmm.dll'),'utf8'),'conflicting fixture');
    assert.equal(fs.existsSync(path.join(dir,'office-viewer','index.js')),true);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
