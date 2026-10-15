// Network confinement of wallet.html?net=devnet: hostile manifests, redirect targets, disallowed
// peers and requests that try to leave the declared test environment are each refused by name,
// and nothing is ever requested from the place a redirect or a hostile field points at.
// Serverless: skaists.dev is served from source by the default-deny fixture; the test network's
// manifest service and chain are route fixtures on loopback. No keychain is opened, nothing is
// signed, and every case ends before any signer is asked.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installWalletFixture} from './lib/wallet-source-fixture.mjs';

const TOKEN = '0x5fbdb2315678afecb367f032d93f642f64180aa3', VAULT = '0x8464135c8f25da09e49bc8782676a84730c318bc';
const MANIFEST = 'http://127.0.0.1:25000', EVIL = 'https://evil.example';
const priv = (n, i) => ({multiaddr: `/ip4/10.0.0.${n}/udp/${30454 + i}/webrtc-direct/certhash/uEiAfixture${i}/p2p/16Uiu2fixture${i}`});
const pub = i => ({multiaddr: `/ip4/203.0.113.${7 + i}/udp/${30454 + i}/webrtc-direct/certhash/uEiAfixture${i}/p2p/16Uiu2fixture${i}`});
const good = () => ({version: 6, network_id: 'fixture-devnet', endpoints: Array.from({length: 7}, (_, i) => priv(5, i)), payment_network: {chain_id: 31337, payment_token_address: TOKEN, payment_vault_address: VAULT}});
const devnet = rpc => ({node_count: 7, evm: {rpc_url: rpc, payment_token_address: TOKEN, payment_vault_address: VAULT}});
const rpcAnswer = chainId => async route => { const {method} = route.request().postDataJSON(); await route.fulfill({json: {jsonrpc: '2.0', id: 1, result: method === 'eth_chainId' ? chainId : null}}); };

const cases = [
  {name: 'the manifest answers with a redirect', browser: r => r.fulfill({status: 302, headers: {location: EVIL + '/manifest'}, body: ''}), expect: /Could not reach the test network on this computer \(or it answered with a redirect, which is refused\)/},
  {name: 'every storage node is at a public address', browser: {...good(), endpoints: Array.from({length: 7}, (_, i) => pub(i))}, expect: /listed no storage nodes at a private address/},
  {name: 'the manifest names another chain', browser: {...good(), payment_network: {...good().payment_network, chain_id: 42161}}, expect: /not the local test chain \(31337\)/},
  {name: 'the manifest names an https chain elsewhere', browser: good(), devnet: devnet(EVIL + ':8545/'), expect: /not an http port on this computer/},
  {name: 'the manifest names an http chain at another host: only its port is kept, on loopback', browser: good(), devnet: devnet('http://evil.example:45000/'), rpc: rpcAnswer('0x7a69'), expect: /Test funding stopped: Connect your bzDiD keychain/, mustRequest: 'http://127.0.0.1:45000/'},
  {name: 'the chain answers with a redirect', browser: good(), devnet: devnet('http://0.0.0.0:45000/'), rpc: r => r.fulfill({status: 302, headers: {location: EVIL + '/rpc'}, body: ''}), expect: /The test chain did not answer on this computer, or answered with a redirect, which is refused/},
  {name: 'the chain is not 31337', browser: good(), devnet: devnet('http://0.0.0.0:45000/'), rpc: rpcAnswer('0xa4b1'), expect: /The test chain is not 31337; refusing it/},
  {name: 'public peers are dropped and only private ones are kept', browser: {...good(), endpoints: [pub(0), ...Array.from({length: 7}, (_, i) => priv(9, i)), pub(8)]}, devnet: devnet('http://0.0.0.0:45000/'), rpc: rpcAnswer('0x7a69'), expect: /Test funding stopped: Connect your bzDiD keychain/, banner: /7 storage nodes at private addresses/},
];

const browser = await chromium.launch();
await installWalletFixture(browser, process.cwd());
try {
  for (const c of cases) {
    const context = await browser.newContext({viewport: {width: 390, height: 900}});
    const requests = [];
    context.on('request', r => requests.push(r.url()));
    await context.route(MANIFEST + '/api/browser-manifest.json', typeof c.browser === 'function' ? c.browser : r => r.fulfill({json: c.browser}));
    await context.route(MANIFEST + '/api/devnet-manifest.json', r => r.fulfill({json: c.devnet || devnet('http://0.0.0.0:45000/')}));
    await context.route('http://127.0.0.1:45000/', c.rpc || (r => r.abort()));
    await context.route(EVIL + '/**', r => r.fulfill({status: 200, body: 'leak'}));
    await context.addInitScript(() => { localStorage.setItem('bregister', 'bee'); localStorage.setItem('bpay-policy-v1', JSON.stringify({audience: 'public'})); });
    await context.grantPermissions(['local-network-access'], {origin: 'https://skaists.dev'});
    const page = await context.newPage();
    await page.goto('https://skaists.dev/surfaces/wallet.html?net=devnet#bpay-sec');
    await page.locator('[data-wallet-store]').click(); await page.locator('.wallet-storage-options a[href="#bpay-sec"]').click();
    if (!await page.locator('#ant-purchase').count()) await page.locator('[data-audience="public"]').click();
    if (!await page.locator('#ant-purchase').evaluate(el => el.open)) await page.locator('#ant-purchase summary').first().click();
    // the wallet's own adapters read their public chains at load (aborted by the fixture); the
    // purchase flow must add no host beyond skaists.dev, the devnet keychain origin and loopback
    const outside = u => /^https?:\/\/(?!skaists\.dev|keys-devnet\.skaists\.dev|127\.0\.0\.1(:\d+)?\/)/.test(u);
    const baseline = new Set(requests.filter(outside).map(u => new URL(u).host)), mark = requests.length;
    await page.getByRole('button', {name: 'Get test ANT and test ETH', exact: true}).click();
    await page.getByText(/Funded on the test network|Test funding stopped/).waitFor({timeout: 20000});
    const said = await page.locator('#ant-funding').innerText();
    assert.match(said, c.expect, `${c.name}: ${said}`);
    assert.equal(requests.filter(u => u.startsWith(EVIL)).length, 0, `${c.name}: nothing was requested from the hostile target`);
    const left = requests.slice(mark).filter(u => outside(u) && !baseline.has(new URL(u).host));
    assert.deepEqual(left, [], `${c.name}: no request of the purchase flow left the declared environment`);
    if (c.mustRequest) assert.ok(requests.includes(c.mustRequest), `${c.name}: the chain is asked at its loopback port`);
    if (c.banner) assert.match(await page.locator('.ant-test-banner').innerText(), c.banner, `${c.name}: the banner counts only private peers`);
    await context.close();
    console.log('ok   ' + c.name);
  }
  console.log('PASS test-network confinement: ' + cases.length + ' hostile cases refused by name; redirects never followed; no request left skaists.dev + loopback');
} finally { await browser.close(); }
