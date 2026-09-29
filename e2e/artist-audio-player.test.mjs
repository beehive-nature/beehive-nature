// Exercise controller events and asynchronous outcomes; no network or audio device.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const controller = readFileSync(new URL('../docs/mvp-walk/assets/artist-audio/showcase.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(id = '') {
    this.id = id; this.listeners = {}; this.attrs = {}; this.children = [];
    this.hidden = false; this.disabled = false; this.textContent = ''; this.open = false;
    this.dataset = {}; this.isConnected = true; this.parentElement = null;
    this.classList = {toggle() {}, add() {}};
    this.style = {setProperty() {}};
  }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  emit(name, detail = {}) { for (const fn of this.listeners[name] || []) fn(detail); }
  click() { if (!this.disabled) this.emit('click'); }
  setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'hidden') this.hidden = true; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; if (name === 'hidden') this.hidden = false; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  closest() { return this.box || null; }
  remove() {}
  focus() {}
}

function setup(overrides = {}) {
  const ids = ['fixture-audio','play-pause','watch','volume','volume-value','listen-status',
    'source-status','youtube-host','youtube-player','bloom-stage','motion-status','bloom-pause',
    'save-later','remove-later','export-later','collection-status','collection-list','sources-panel'];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const el = id => elements[id];
  const audio = el('fixture-audio');
  Object.assign(audio, {paused:true,currentTime:0,ended:false,volume:0.8,autoplay:false});
  let pendingPlay;
  audio.play = () => {
    audio.paused = false; audio.emit('play');
    return overrides.deferredPlay
      ? new Promise((resolve, reject) => { pendingPlay = {resolve,reject}; })
      : Promise.resolve();
  };
  audio.pause = () => { audio.paused = true; audio.emit('pause'); };
  el('volume').value = '0.8'; el('volume').box = new Element('volume-box');
  el('sources-panel').dataset.viewDisclosure = 'sources';
  const buttons = ['local', 'youtube'].map(source => {
    const button = new Element();
    button.setAttribute('data-source', source);
    button.setAttribute('data-available', 'true');
    return button;
  });
  const body = new Element(); body.dataset.reg = 'bee';
  const misc = {'.native':new Element(), '.credit-line b':new Element(), '.credit-line small':new Element(),
    'meta[name="theme-color"]':new Element()};
  const document = new Element();
  Object.assign(document, {
    body, hidden:false, activeElement:null,
    getElementById:id => el(id),
    querySelector:selector => misc[selector] || null,
    querySelectorAll:selector => selector === 'button[data-source]' ? buttons
      : selector === '[data-view-disclosure]' ? [el('sources-panel')] : [],
    createElement:() => new Element()
  });
  const window = new Element();
  const store = {schema:'bnr-listen-later/1',items:[]};
  const saved = [];
  window.BNRListenLater = {
    STORE:'bnr-listen-later',
    readStore:() => structuredClone(store),
    saveItem:async (_storage, entry) => {
      saved.push(structuredClone(entry)); store.items.push(structuredClone(entry));
      return {store:structuredClone(store),already:false};
    },
    removeItem:async (_storage,id) => {
      store.items = store.items.filter(item => item.id !== id);
      return structuredClone(store);
    },
    exportPublic:value => value,
    ...overrides.later
  };
  const reduced = new Element(); reduced.matches = false;
  class LocalURL extends URL { static createObjectURL() { return 'blob:test'; } static revokeObjectURL() {} }
  vm.runInNewContext(controller, {
    window, document, localStorage:{}, matchMedia:() => reduced,
    fetch:() => Promise.reject(new Error('No network in unit tests')),
    URL:LocalURL, Blob, setTimeout:() => 0, console
  });
  return {el,audio,window,document,store,saved,misc,buttons,
    finishPlay:() => pendingPlay.resolve(),
    rejectPlay:error => pendingPlay.reject(error),
    switchSource:source => buttons.find(button => button.getAttribute('data-source') === source).click(),
    switchSkin:reg => { body.dataset.reg = reg; document.emit('bregister', {detail:{reg}}); }};
}

test('arrival is quiet and New bee source details are closed', async () => {
  const app = setup();
  assert.equal(app.audio.paused, true);
  assert.equal(app.el('youtube-player').getAttribute('src'), null);
  assert.equal(app.el('sources-panel').open, false);
  await tick();
});

test('a late local play completion cannot replace the selected YouTube state', async () => {
  const app = setup({deferredPlay:true});
  app.el('play-pause').click();
  app.switchSource('youtube');
  const status = app.el('listen-status').textContent;
  app.finishPlay();
  await tick();
  assert.equal(app.audio.paused, true);
  assert.equal(app.audio.hidden, true);
  assert.equal(app.el('volume').box.hidden, true);
  assert.equal(app.el('play-pause').hidden, true);
  assert.equal(app.el('listen-status').textContent, status);
  assert.match(status, /CJ Bolland/);
});

test('skin changes preserve the paused playhead and active provider frame', async () => {
  const app = setup();
  app.audio.currentTime = 0.75;
  app.switchSkin('raver'); app.switchSkin('cypherpunk'); app.switchSkin('bee');
  assert.equal(app.audio.currentTime, 0.75);
  assert.equal(app.audio.paused, true);
  app.switchSource('youtube');
  const frame = app.el('youtube-player');
  const url = frame.getAttribute('src');
  app.switchSkin('cypherpunk'); app.switchSkin('bee');
  assert.equal(frame.getAttribute('src'), url);
  assert.equal(app.el('sources-panel').open, true, 'active player stays visible');
  assert.equal(app.audio.paused, true);
  await tick();
});

test('native pause remains intentional when pending Play rejects with AbortError', async () => {
  const app = setup({deferredPlay:true});
  app.el('play-pause').click();
  app.audio.currentTime = 0.35;
  app.audio.pause();
  const pausedStatus = app.el('listen-status').textContent;
  app.rejectPlay(Object.assign(new Error('The play request was interrupted by pause'), {name:'AbortError'}));
  await tick();
  assert.equal(app.el('listen-status').textContent, pausedStatus);
  assert.match(pausedStatus, /Paused at 0.3s/);
  assert.equal(app.el('play-pause').textContent, 'Play');
});

test('native volume changes update the visible custom control', async () => {
  const app = setup();
  app.audio.volume = 0.35;
  app.audio.emit('volumechange');
  assert.equal(app.el('volume').value, '0.35');
  assert.equal(app.el('volume-value').value, '35%');
  await tick();
});

test('leaving the page stops both providers without restarting a saved choice', async () => {
  const app = setup();
  app.switchSource('youtube');
  app.window.emit('pagehide');
  assert.equal(app.el('youtube-player').getAttribute('src'), null);
  assert.equal(app.el('youtube-host').hidden, true);
  assert.equal(app.audio.paused, true);
  app.switchSkin('raver');
  assert.equal(app.el('youtube-player').getAttribute('src'), null);
  await tick();
});

test('saving each recording keeps its own identity, credit and links', async () => {
  const app = setup();
  app.el('save-later').click();
  await tick();
  app.switchSource('youtube');
  app.el('save-later').click();
  await tick();
  assert.equal(app.saved.length, 2);
  assert.equal(app.saved[0].fixture, true);
  assert.equal(app.saved[0].links.length, 0);
  assert.equal(app.saved[1].fixture, false);
  assert.equal(app.saved[1].artist, 'CJ Bolland');
  assert.equal(app.saved[1].id, 'youtube-pb6OqIyyLAk');
  assert.equal(app.saved[1].links[0].url, 'https://www.youtube.com/watch?v=pb6OqIyyLAk');
  assert.equal(app.el('collection-list').children.length, 2);
});

test('other-tab changes refresh collection buttons and list', async () => {
  const app = setup();
  app.el('save-later').click(); await tick();
  assert.equal(app.el('save-later').disabled, true);
  app.store.items = [];
  app.window.emit('storage', {key:'bnr-listen-later'});
  assert.equal(app.el('save-later').disabled, false);
  assert.equal(app.el('remove-later').disabled, true);
  assert.equal(app.el('export-later').disabled, true);
});

test('uncertain removal rereads the outcome without claiming data was preserved', async () => {
  const app = setup();
  app.el('save-later').click(); await tick();
  app.window.BNRListenLater.removeItem = async () => {
    app.store.items = [];
    throw Object.assign(new Error('verification failed'), {code:'uncertain-write'});
  };
  app.el('remove-later').click(); await tick();
  assert.match(app.el('collection-status').textContent, /could not be confirmed/);
  assert.doesNotMatch(app.el('collection-status').textContent, /not erased|unchanged|not replaced/i);
  assert.equal(app.el('remove-later').disabled, true);
  assert.equal(app.el('export-later').disabled, true);
});
