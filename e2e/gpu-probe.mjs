import { chromium } from 'playwright';
import { createServer } from 'node:http';

const srv = createServer((q, s) => s.end('<!doctype html><title>t</title>ok'));
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port;

for (const opts of [
  { label: 'chrome headed +gpu', channel: 'chrome', headless: false, ignoreDefaultArgs: ['--disable-gpu'], args: ['--enable-features=WebGPU,Vulkan', '--enable-unsafe-webgpu'] },
  { label: 'chrome headless +gpu', channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-gpu'], args: ['--enable-features=WebGPU,Vulkan', '--enable-unsafe-webgpu'] },
]) {
  try {
    const b = await chromium.launch(opts);
    const p = await (await b.newContext()).newPage();
    await p.goto(`http://127.0.0.1:${port}/`);
    const info = await p.evaluate(async () => {
      const ua = (navigator.userAgent.match(/Chrome\/[0-9.]+/) || ['?'])[0];
      let adapter = 'none';
      if (navigator.gpu) {
        try {
          const ad = await navigator.gpu.requestAdapter();
          adapter = ad ? `OK ${ad.info?.vendor || '?'}/${ad.info?.architecture || '?'}` : 'requestAdapter null';
        } catch (e) { adapter = 'ERR ' + e.message; }
      }
      return { ua, secure: window.isSecureContext, gpu: typeof navigator.gpu, adapter };
    });
    console.log(opts.label, '→', JSON.stringify(info));
    await b.close();
  } catch (e) {
    console.log(opts.label, '→ launch failed:', String(e).slice(0, 90));
  }
}
srv.close();
