const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildInjectionScript } = require('../index');

test('re-injection disposes listeners, observers, timers and history wrappers', () => {
  const listeners = new Set(), observers = new Set(), timers = new Set();
  let nextTimer = 0;
  function addEventListener(type, fn, options) {
    const registration = { type, fn };
    listeners.add(registration);
    options?.signal?.addEventListener('abort', () => listeners.delete(registration), { once: true });
  }
  const originalPush = () => {};
  const history = { pushState: originalPush, replaceState() {} };
  const context = vm.createContext({
    window: { location: { search: '' }, addEventListener },
    document: { body: {}, getElementById() { return null; }, querySelector() { return null; }, addEventListener },
    AbortController, URL, URLSearchParams, Map, history, console: { log() {} },
    setTimeout() { const id = ++nextTimer; timers.add(id); return id; },
    setInterval() { const id = ++nextTimer; timers.add(id); return id; },
    clearTimeout(id) { timers.delete(id); }, clearInterval(id) { timers.delete(id); },
    MutationObserver: class { observe() { observers.add(this); } disconnect() { observers.delete(this); } }
  });
  const script = buildInjectionScript(12399, 'a'.repeat(64));
  vm.runInContext(script, context);
  assert.equal(listeners.size, 3);
  assert.equal(observers.size, 1);
  assert.equal(timers.size, 1);
  history.pushState();
  assert.equal(timers.size, 2);
  vm.runInContext(script, context);
  assert.equal(listeners.size, 3);
  assert.equal(observers.size, 1);
  assert.equal(timers.size, 1);
  context.window.__ag_office_dispose();
  assert.equal(listeners.size, 0);
  assert.equal(observers.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(history.pushState, originalPush);
});

test('editor injection passes exact filenames and replaces stale frames after service restart', () => {
  const nodes = new Map();
  const frames = [];
  const copies = [];
  const handlers = [];
  const file = String.raw`C:\docs\中文 100% literal%20.docx`;
  function element(type) {
    const el = {
      style: {}, contentWindow: {},
      setAttribute() {},
      appendChild(child) { child.parentElement = this; if (child.id) nodes.set(child.id, child); },
      remove() { this.removed = true; if (this.id) nodes.delete(this.id); }
    };
    if (type === 'iframe') frames.push(el);
    return el;
  }
  const cell = element('div');
  cell.querySelector = () => null;
  const tab = { classList: { contains: () => true }, querySelector: () => null,
    getAttribute: name => name === 'data-tab-id' ? 'file__' + file : '中文 100% literal%20.docx' };
  const pane = { querySelectorAll: () => [tab], querySelector: () => ({ nextElementSibling: cell }) };
  const context = vm.createContext({
    window: { location: { search: '' }, addEventListener(type, fn) { if(type === 'message') handlers.push(fn); } },
    document: { body: {}, getElementById: id => nodes.get(id), querySelector: () => pane, querySelectorAll: () => [], createElement: element, addEventListener() {} },
    navigator: { clipboard: { writeText(text) { copies.push(text); return Promise.resolve(); } } },
    AbortController, URL, URLSearchParams, Map, history: {}, console: { log() {} },
    getComputedStyle: () => ({position: 'static'}),
    setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} }
  });
  vm.runInContext(buildInjectionScript(12399,'a'.repeat(64)),context);
  assert.equal(frames.length,1);
  const url = new URL(frames[0].src);
  assert.equal(url.searchParams.get('file'),file);
  assert.equal(url.searchParams.get('token'),'a'.repeat(64));
  vm.runInContext(buildInjectionScript(12399,'a'.repeat(64)),context);
  assert.equal(frames.length,1);
  vm.runInContext(buildInjectionScript(12399,'b'.repeat(64)),context);
  assert.equal(frames[0].removed,true);
  assert.equal(frames.length,2);
  const copy=handlers.at(-1);
  copy({origin:'https://example.test',source:frames[1].contentWindow,data:{type:'ag_office_copy',text:'untrusted'}});
  copy({origin:'http://127.0.0.1:12399',source:{},data:{type:'ag_office_copy',text:'untrusted'}});
  copy({origin:'http://127.0.0.1:12399',source:frames[1].contentWindow,data:{type:'ag_office_copy',text:'中文'}});
  assert.deepEqual(copies,['中文']);
  context.window.__ag_office_dispose();
});
