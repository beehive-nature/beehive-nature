// Visual receipt for the consent-first .b/.a house archive.
// Run from the repository root: node e2e/profile-house-archive-shot.mjs
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
const errors = [];
const remoteRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (/^https?:/i.test(request.url())) remoteRequests.push(request.url());
});

await page.goto(new URL('../surfaces/profile.html', import.meta.url).href, { waitUntil: 'load' });
await page.waitForFunction(() => {
  const image = document.querySelector('.crest-art-frame img');
  return image?.complete && image.naturalWidth > 0;
});

async function showRegister(register, size = '1280') {
  await page.evaluate(value => {
    document.body.setAttribute('data-reg', value);
    document.body.setAttribute('data-prof-beat', value === 'cypherpunk' ? 'deeper' : 'house');
    document.dispatchEvent(new CustomEvent('bregister', { detail: { reg: value } }));
    document.body.setAttribute('data-prof-beat', value === 'cypherpunk' ? 'deeper' : 'house');
  }, register);
  await page.locator('#house-archive').waitFor({ state: 'visible' });
  await page.locator('.crest-art-frame img:visible').evaluate(image => {
    if (image.complete && image.naturalWidth > 0) return;
    return new Promise((resolve, reject) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', () => reject(new Error('visible crest failed to load')), { once: true });
    });
  });
  await page.locator('#house-archive').scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), `skaists-house-${register}-${size}.png`), fullPage: true });
}

for (const register of ['bee', 'raver', 'cypherpunk']) await showRegister(register);

await page.evaluate(() => { document.querySelector('#profile-editor').open = true; });
await page.locator('#profile-name-input').fill('LoVis waTer · skaists .b');
await page.locator('#profile-motto-input').fill('love is king · privacy is the seam');
await page.locator('#profile-bio-input').fill('A local profile preview with the full ceremonial achievement.');
await page.locator('#profile-accent-input').fill('#8D65D8');
await page.getByRole('button', { name: 'Apply local preview' }).click();
assert.equal(await page.locator('#profile-display-name').innerText(), 'LoVis waTer · skaists .b');
assert.equal(await page.locator('#profile-display-motto').innerText(), 'love is king · privacy is the seam');
assert.equal(await page.locator('#profile-display-bio').innerText(), 'A local profile preview with the full ceremonial achievement.');
assert.equal(await page.locator('#house-archive').evaluate(element => element.style.getPropertyValue('--profile-accent')), '#8d65d8');
assert.match(await page.locator('#profile-edit-status').innerText(), /not saved or published/);
await page.getByRole('button', { name: 'Reset preview' }).click();
await page.waitForTimeout(0);
assert.equal(await page.locator('#profile-display-name').innerText(), 'Travis Mark Remington');
assert.match(await page.locator('#profile-display-motto').innerText(), /love is king/);
assert.equal(await page.locator('#house-archive').evaluate(element => element.style.getPropertyValue('--profile-accent')), '#e8b54b');

await page.getByRole('button', { name: 'Trusted circle' }).click();
assert.equal(await page.locator('[data-scope="circle"]').isVisible(), true);
assert.equal(await page.locator('[data-scope="private"]').isVisible(), false);
await page.getByRole('button', { name: 'Private archive' }).click();
assert.equal(await page.locator('[data-scope="private"]').isVisible(), true);
assert.match(await page.locator('#profile-manifest').innerText(), /"audience": "private"/);
await page.getByRole('button', { name: '.a agent' }).click();
assert.equal(await page.locator('[data-profile-schema="agent"]').isVisible(), true);
assert.match(await page.locator('[data-profile-schema="agent"]').innerText(), /never claims a blood relationship/);

await page.setViewportSize({ width: 390, height: 844 });
await showRegister('raver', '390');
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);

assert.deepEqual(errors, []);
assert.deepEqual(remoteRequests, []);
console.log('HOUSE PROFILE VISUAL RECEIPT PASS');
console.log(join(tmpdir(), 'skaists-house-{bee,raver,cypherpunk}-1280.png'));
console.log(join(tmpdir(), 'skaists-house-raver-390.png'));
await browser.close();
