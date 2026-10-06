import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../surfaces/ant-transport.js', import.meta.url), 'utf8');

// A stand-in for the browser's RTCPeerConnection: the test drives its states by hand.
class FakePC extends EventTarget {
  constructor(config) { super(); this.config = config; this.iceConnectionState = 'new'; this.connectionState = 'new'; this.closed = false; }
  async setRemoteDescription(desc) { this.remote = desc; }
  createDataChannel(label) { const ch = new EventTarget(); ch.label = label; this.ch = ch; return ch; }
  close() { this.closed = true; }
  static generateCertificate() { return 'cert'; }
  ice(s) { this.iceConnectionState = s; this.dispatchEvent(new Event('iceconnectionstatechange')); }
  conn(s) { this.connectionState = s; this.dispatchEvent(new Event('connectionstatechange')); }
}
const answer = (ip, port) => ({ type: 'answer', sdp: `v=0\r\nc=IN IP4 ${ip}\r\nm=application ${port} UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1467250027 1 UDP 1467250027 ${ip} ${port} typ host\r\n` });

function load() {
  let t = 0;
  const window = { RTCPeerConnection: FakePC };
  const ctx = vm.createContext({ window, performance: { now: () => t }, setTimeout: (fn) => { fn(); return 1; }, Object, String, Math, Event });
  vm.runInContext(SRC, ctx);
  return { window, tick: (ms) => { t += ms; } };
}

test('the dial funnel counts opened, dead and recovered endpoints, and keeps addresses private', async () => {
  const { window, tick } = load();
  const PC = window.RTCPeerConnection;
  assert.notEqual(PC, FakePC, 'the constructor is wrapped');
  assert.equal(PC.generateCertificate(), 'cert', 'statics still reach the native constructor');

  const a = new PC({ iceServers: [] });
  assert.ok(a instanceof FakePC, 'the SDK still gets a real peer connection');
  await a.setRemoteDescription(answer('1.2.3.4', 10001));
  const ch = a.createDataChannel('');
  tick(100); a.ice('connected');
  tick(50); a.conn('connected');
  tick(50); ch.dispatchEvent(new Event('open'));
  tick(100); const m = new Event('message'); m.data = new Uint8Array(300).buffer; ch.dispatchEvent(m);

  const b = new PC({});
  await b.setRemoteDescription(answer('5.6.7.8', 10001));
  b.createDataChannel('');
  tick(4000); b.close();

  const c = new PC({});
  await c.setRemoteDescription(answer('9.9.9.9', 10001));
  c.createDataChannel('');
  tick(100); c.ice('connected'); tick(2000); c.conn('failed');

  const again = new PC({});
  await again.setRemoteDescription(answer('5.6.7.8', 10001));
  const ch2 = again.createDataChannel('');
  tick(200); again.conn('connected'); ch2.dispatchEvent(new Event('open'));

  const pending = new PC({});
  await pending.setRemoteDescription(answer('7.7.7.7', 10001));

  const s = window.__antTransport.snapshot();
  assert.equal(s.dials, 5);
  assert.equal(s.opened, 2);
  assert.equal(s.closed, 0, 'an opened connection is not destroyed until it closes');
  assert.equal(s.dead, 2);
  assert.equal(s.waiting, 1);
  assert.equal(s.openRate, 0.5);
  assert.deepEqual({ ...s.deadAt }, { dial: 1, ice: 1, dtls: 0 });
  assert.equal(s.endpoints, 4);
  assert.equal(s.endpointsReachable, 2);
  assert.equal(s.endpointsUnreachable, 1);
  assert.equal(s.endpointsRecovered, 1);
  assert.equal(s.connectP50, 200);
  assert.equal(s.answerP50, 300);
  assert.equal(s.deadMs, 4000 + 2100);
  assert.equal(s.bytes, 300);
  assert.ok(b.closed, 'close still reaches the native connection');
  a.close();
  assert.equal(window.__antTransport.snapshot().closed, 1);
  assert.doesNotMatch(JSON.stringify(s), /\d+\.\d+\.\d+\.\d+/, 'no endpoint address leaves the recorder');
});

test('a browser without WebRTC is left alone', () => {
  const window = {};
  vm.runInContext(SRC, vm.createContext({ window, performance: { now: () => 0 }, setTimeout, Object, String, Math }));
  assert.equal(window.__antTransport, undefined);
  assert.equal(window.RTCPeerConnection, undefined);
});
