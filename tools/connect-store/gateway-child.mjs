// Used only by the synthetic process-loss proof; no standalone production CLI.
import { Channel } from './core.mjs';
import { DirectoryStore } from './adapters.mjs';
import { startGateway } from './server.mjs';

let gateway;
const deadline = setTimeout(() => process.exit(2), 60000);
process.once('message', async message => {
  try {
    const { config, root, pin } = message;
    const channel = new Channel({ ...config, key: Uint8Array.from(config.key),
      writer: config.writer && Uint8Array.from(config.writer), store: new DirectoryStore(root) });
    if (pin) await channel.restore(pin);
    gateway = await startGateway(channel);
    process.send({ ready: true, url: gateway.url, wsUrl: gateway.wsUrl });
  } catch { process.send({ ready: false, error: 'canary-start-failed' }); process.exitCode = 1; process.disconnect(); clearTimeout(deadline); }
});
process.on('disconnect', async () => { if (gateway) await gateway.close(); clearTimeout(deadline); });
