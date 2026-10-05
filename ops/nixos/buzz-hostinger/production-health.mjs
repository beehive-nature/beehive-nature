// Read-only post-cutover checks; never creates users or messages.
import assert from 'node:assert/strict';

for (const host of ['skaists.buzz', 'relay.skaists.dev']) {
  const response = await fetch(`https://${host}/info`, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const info = await response.json();
  assert.ok(info.supported_nips.includes(42));
  for (const [path, status] of [['/join/', 200], ['/compute/v1/models', 401]]) {
    const result = await fetch(`https://${host}${path}`, { signal: AbortSignal.timeout(15000) });
    assert.equal(result.status, status, `${host}${path}`);
    await result.body?.cancel();
  }
  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`wss://${host}`);
    const timer = setTimeout(() => { socket.close(); reject(new Error(`${host}: no auth challenge`)); }, 15000);
    socket.onerror = () => { clearTimeout(timer); reject(new Error(`${host}: WebSocket error`)); };
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message[0] === 'AUTH') {
        clearTimeout(timer);
        socket.close();
        resolve();
      }
    };
  });
  console.log(`${host}: info/join/auth-required compute/WebSocket challenge PASS`);
}
