/* ans104-arbundles.gen.mjs — re-derives the FIXTURE pinned in e2e/ans104.test.mjs
   from the reference library itself, so the pin is checkable by anyone:

     npm install --prefix contracts/vending/tool --no-save @dha-team/arbundles bs58
     node e2e/fixtures/ans104-arbundles.gen.mjs

   It prints { id, bytes, sha256, owner_hex }; id, bytes and sha256 must equal the
   test's FIXTURE. arbundles' SolanaSigner reads its 64-byte secret as
   seed(32) ‖ public(32) — the opposite order signs with the public key and
   publishes the seed as the owner. The seed is a public test constant derived
   from a phrase; it guards nothing. */
import { createRequire } from 'node:module';
import { createHash, createPrivateKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');
const req = createRequire(ROOT + '/contracts/vending/tool/package.json');
const { createData, SolanaSigner } = req('@dha-team/arbundles');
let bs58 = req('bs58'); bs58 = bs58.default || bs58;

const seed = createHash('sha256').update('skaists ans104 fixture seed · public, test-only').digest();
const pub = Buffer.from(createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' }).export({ format: 'jwk' }).x, 'base64url');
const signer = new SolanaSigner(bs58.encode(Buffer.concat([seed, pub])));
const data = JSON.stringify({ record: 'ans104-fixture', n: 1 });
const tags = [{ name: 'App-Name', value: 'skaists-vending' }, { name: 'Type', value: 'agent-birth-certificate' }, { name: 'Content-Type', value: 'application/json' }, { name: 'Member-Key', value: pub.toString('hex') }];
const item = createData(data, signer, { tags });
await item.sign(signer);
const owner = Buffer.from(item.rawOwner).toString('hex');
if (owner !== pub.toString('hex')) { console.error('owner is not the public key — the signer was built in the wrong order'); process.exit(1); }
console.log(JSON.stringify({ id: item.id, bytes: item.getRaw().length, sha256: createHash('sha256').update(item.getRaw()).digest('hex'), owner_hex: owner }));
