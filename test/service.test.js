const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { getJson } = require('../lib/cdp');

test('CLI starts one service, reports status, and stops it with its saved credential', {timeout:20000}, async () => {
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0,'127.0.0.1',resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(),'office-service-'));
  const children = [];
  const env = {...process.env,OFFICE_VIEWER_PORT:String(port),LOCALAPPDATA:stateDir};
  function child(args=[]) {
    const process = spawn(global.process.execPath,[path.resolve(__dirname,'../index.js'),...args],{env,stdio:['ignore','pipe','pipe']});
    let output='';
    process.stdout.on('data',data=>output+=data);
    process.stderr.on('data',data=>output+=data);
    children.push(process);
    const done=once(process,'exit').then(([code])=>({code,output}));
    return {process,done};
  }
  const first=child();
  try {
    let ready=false;
    for(let i=0;i<80;i++) {
      if((await getJson(port,'/health',200))?.service==='antigravity-office-viewer'){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(ready,true,'Service did not start');
    const duplicate=await child().done;
    assert.equal(duplicate.code,0,duplicate.output);
    assert.match(duplicate.output,/already running/);
    const status=await child(['--status']).done;
    assert.equal(status.code,0,status.output);
    assert.match(status.output,/attachedPages/);
    const stopped=await child(['--stop']).done;
    assert.equal(stopped.code,0,stopped.output);
    assert.equal((await first.done).code,0);
    assert.equal(fs.existsSync(path.join(stateDir,'antigravity-office-viewer',`service-${port}.json`)),false);
  } finally {
    for(const process of children) if(process.exitCode===null) process.kill();
    fs.rmSync(stateDir,{recursive:true,force:true});
  }
});
