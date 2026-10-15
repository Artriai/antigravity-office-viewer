const test = require('node:test');
const assert = require('node:assert/strict');
const { CdpController, validDebuggerUrl } = require('../lib/cdp');

test('only probes owned ports, rejects remote/debugger URL mismatches, and verifies editor before injection', async () => {
  const calls = [], sockets = [];
  class FakeSocket {
    constructor(url) { this.url = url; this.sent = []; sockets.push(this); }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.onclose?.(); }
  }
  const controller = new CdpController({
    script: 'fixture-injection', WebSocketImpl: FakeSocket, log() {},
    inspect: async () => ({ running: true, ports: [4567] }),
    json: async (port, route) => {
      calls.push([port, route]);
      return route === '/json/version' ? {webSocketDebuggerUrl: 'ws://127.0.0.1:4567/devtools/browser/1'} : [
        {id:'editor',type:'page',url:'file:///app.html',webSocketDebuggerUrl:'ws://127.0.0.1:4567/devtools/page/1'},
        {id:'remote',type:'page',webSocketDebuggerUrl:'ws://example.test:4567/1'},
        {id:'tools',type:'page',url:'devtools://devtools',webSocketDebuggerUrl:'ws://127.0.0.1:4567/2'}
      ];
    }
  });
  try {
    await controller.poll();
    assert.equal(calls.every(([port]) => port === 4567), true);
    assert.equal(sockets.length, 1);
    const ws = sockets[0];
    ws.onopen();
    assert.equal(ws.sent.length, 1);
    assert.equal(ws.sent[0].params.expression.includes('Boolean(document.querySelector'), true);
    ws.onmessage({data:JSON.stringify({id:1,result:{result:{value:true}}})});
    assert.equal(ws.sent.find(m => m.id === 4).params.expression, 'fixture-injection');
    ws.onmessage({data:JSON.stringify({id:4,result:{result:{}}})});
    assert.equal(controller.attachedPages, 1);
  } finally { controller.stop(); }
  assert.equal(validDebuggerUrl('ws://localhost:4567/page',4567),true);
  assert.equal(validDebuggerUrl('ws://localhost:4568/page',4567),false);
});

test('non-editor pages never receive injection and concurrent polls do not overlap', async () => {
  let release, inspections = 0, socket;
  class FakeSocket {
    constructor(){socket=this;this.sent=[];}
    send(value){this.sent.push(JSON.parse(value));}
    close(){this.onclose?.();}
  }
  const controller = new CdpController({ script:'must-not-inject',WebSocketImpl:FakeSocket,log(){},
    inspect: () => { inspections++; return new Promise(resolve => {release=resolve;}); },
    json: async (port, route) => route === '/json/version' ? {webSocketDebuggerUrl:'ws://localhost:4567/browser'} : [{id:'settings',type:'page',webSocketDebuggerUrl:'ws://localhost:4567/page'}]
  });
  try {
    const pending=controller.poll();
    await controller.poll();
    assert.equal(inspections,1);
    release({running:true,ports:[4567]});
    await pending;
    socket.onopen();
    socket.onmessage({data:JSON.stringify({id:1,result:{result:{value:false}}})});
    assert.equal(socket.sent.length,1);
    assert.equal(controller.connections.size,0);
  } finally {controller.stop();}
});
