// Publication consent is a document signature, never a bPay authorization.
export const SCHEMA = 'skaists.genealogy-consent/1';
export const STORAGE_KEY = SCHEMA;
export const TERMS = 'I consent to public preservation of this exact privacy-safe genealogy edition on Autonomi. Public copies may be permanent and cannot be recalled. Living-family and private material remain excluded. This signature authorizes no payment, token approval, transaction, or upload operation.';
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = (s, size) => {
  if (typeof s !== 'string' || !new RegExp('^[0-9a-f]{' + size * 2 + '}$').test(s)) throw new Error('Invalid signature or public key encoding');
  return Uint8Array.from(s.match(/../g), b => parseInt(b, 16));
};
export function artifactIdentity(economics) {
  const a = economics?.artifact, u = a?.uploadObject;
  if (!/^[0-9a-f]{64}$/.test(a?.manifestSha256 || '') || !/^[0-9a-f]{64}$/.test(u?.sha256 || '') ||
      !Number.isSafeInteger(u?.bytes) || u.bytes <= 0 || !Number.isSafeInteger(a?.files) || a.files <= 0)
    throw new Error('The edition has no complete manifest and upload-object binding');
  return { manifestSha256: a.manifestSha256, tarSha256: u.sha256, tarBytes: u.bytes, files: a.files };
}
export function consentDocument(economics, publicKey, signedAt, nonce) {
  unhex(publicKey, 32);
  if (!signedAt || new Date(signedAt).toISOString() !== signedAt || !/^[0-9a-f-]{36}$/.test(nonce)) throw new Error('Invalid consent time or nonce');
  return { schema: SCHEMA, origin: 'https://skaists.dev', purpose: 'public-preservation-consent-only',
    artifact: artifactIdentity(economics), destination: 'Autonomi public storage', terms: TERMS,
    keyContext: 'bnr.b', publicKey, signedAt, nonce };
}
export const signingBytes = doc => new TextEncoder().encode(SCHEMA + '\n' + JSON.stringify(doc));
export async function verifyConsent(receipt, economics) {
  try {
    if (receipt?.algorithm !== 'Ed25519') return false;
    const d = receipt.document;
    const expected = consentDocument(economics, d.publicKey, d.signedAt, d.nonce);
    if (JSON.stringify(expected) !== JSON.stringify(d)) return false;
    const key = await crypto.subtle.importKey('raw', unhex(d.publicKey, 32), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, unhex(receipt.signature, 64), signingBytes(d));
  } catch { return false; }
}
export async function signConsent(economics, record) {
  const document = consentDocument(economics, hex(record.publicKey), new Date().toISOString(), crypto.randomUUID());
  const receipt = { algorithm: 'Ed25519', document, signature: hex(await record.sign(signingBytes(document))) };
  if (!await verifyConsent(receipt, economics)) throw new Error('Signature verification failed; no consent saved');
  return receipt;
}
async function loadEconomics() {
  const response = await fetch(new URL('../../assets/profile-archive/lineage/zblood-storage-economics.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error('Edition status could not be read');
  const economics = await response.json();
  artifactIdentity(economics);
  return economics;
}
function download(receipt) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'genealogy-consent-' + receipt.document.artifact.manifestSha256.slice(0, 12) + '.json';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// getRecord is provided only inside the existing wallet closure. No new key
// store, extension fallback, transaction API or general signing global.
export async function mountConsent(host, { getRecord } = {}) {
  host.replaceChildren();
  host.style.cssText = 'padding:20px;margin:20px 0;border:1px solid currentColor;border-radius:8px;overflow-wrap:anywhere;font-size:14px;line-height:1.6;scroll-margin-top:24px';
  const add = (tag, text) => { const el = document.createElement(tag); el.textContent = text; host.append(el); return el; };
  add('h3', 'review preservation consent');
  const status = add('p', 'Reading the exact edition…'); status.setAttribute('role', 'status');
  let economics;
  try { economics = await loadEconomics(); } catch (e) { status.textContent = e.message + '. Nothing can be signed.'; return; }
  const identity = artifactIdentity(economics);
  add('p', economics.artifact.name + ' · prepared ' + economics.artifact.preparedAt + ' · ' + identity.files.toLocaleString() + ' files');
  const details = add('dl', '');
  for (const [label, value] of Object.entries(identity)) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = label; dd.textContent = String(value); dd.style.margin = '0 0 12px'; details.append(dt, dd);
  }
  add('p', TERMS);
  add('p', 'This covers the packaged snapshot identified above. Later website edits are not covered. A signature proves possession of the displayed key; it does not establish ownership of family records or consent from other people.');
  add('p', 'The receipt stays in this browser until you download or share it. Ed25519 is the existing classical bzDiD record signature; this is not a post-quantum signature.');
  let saved = null;
  const save = add('button', 'download signed consent'); save.type = 'button'; save.hidden = true;
  const show = receipt => {
    saved = receipt; save.hidden = false;
    status.textContent = 'Consent signature verified for this edition · key ' + receipt.document.publicKey + ' · ' + receipt.document.signedAt + '. Payment and upload remain separate.';
  };
  save.addEventListener('click', () => saved && download(saved));
  try {
    const previous = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (await verifyConsent(previous, economics)) show(previous);
    else status.textContent = previous ? 'Stored consent does not verify for this edition. Review and sign again.' : 'No signed consent for this edition yet.';
  } catch { status.textContent = 'No verified consent available in this browser.'; }
  if (!getRecord) {
    const link = add('a', 'review and sign with your keychain'); link.href = 'wallet.html#genealogy-consent';
    link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:8px 16px';
  } else {
    let reviewedKey = null;
    const reviewKey = add('button', 'review signing key'); reviewKey.type = 'button';
    const keyLabel = add('p', 'Connect your keychain, then review the key before signing.');
    const connect = add('a', 'connect your keychain'); connect.href = '#kc-sec';
    connect.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:8px 16px';
    const label = add('label', ''); label.style.cssText = 'display:flex;gap:12px;align-items:center;min-height:44px;margin:16px 0';
    const check = document.createElement('input'); check.type = 'checkbox'; check.disabled = true; check.style.cssText = 'width:24px;height:24px;flex-shrink:0';
    label.append(check, document.createTextNode('I have reviewed this exact edition and consent to its public preservation on the terms above.'));
    const sign = add('button', 'sign preservation consent'); sign.type = 'button'; sign.disabled = true;
    check.addEventListener('change', () => { sign.disabled = !check.checked; });
    let busy = false;
    reviewKey.addEventListener('click', () => {
      if (busy) return;
      let record;
      reviewedKey = null; check.checked = false; check.disabled = true; sign.disabled = true;
      try {
        record = getRecord();
        if (!record) throw new Error('Connect your existing keychain below, then review the key again');
        reviewedKey = hex(record.publicKey); check.disabled = false;
        keyLabel.textContent = 'Signing key · Ed25519 · ' + reviewedKey;
      } catch (e) { keyLabel.textContent = e.message; }
      finally { record?.seed?.fill(0); }
    });
    sign.addEventListener('click', async () => {
      if (!check.checked || busy) return;
      busy = true; sign.disabled = true;
      let record;
      try {
        const current = await loadEconomics();
        if (JSON.stringify(artifactIdentity(current)) !== JSON.stringify(identity)) throw new Error('The edition changed. Reload and review the new edition before signing');
        record = getRecord();
        if (!record) throw new Error('Connect your existing keychain below, then return here and press sign');
        if (hex(record.publicKey) !== reviewedKey) {
          check.checked = false; check.disabled = true;
          throw new Error('The keychain changed. Review the signing key again');
        }
        const receipt = await signConsent(economics, record);
        show(receipt);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(receipt)); }
        catch { status.textContent += ' Browser storage is unavailable; download your receipt now.'; }
        check.checked = false;
      } catch (e) { status.textContent = e.message + '. No new consent saved.'; }
      finally { record?.seed?.fill(0); busy = false; sign.disabled = !check.checked; }
    });
    const back = add('a', 'return to genealogy'); back.href = 'blood.html#consent';
    back.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:8px 16px';
  }
  for (const button of host.querySelectorAll('button')) button.style.cssText = 'min-height:44px;padding:8px 16px;font:inherit;margin:8px 8px 8px 0';
}
