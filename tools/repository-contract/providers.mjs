import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { need, integer, hash, validatePolicy } from './contract.mjs';
import { location } from './storage.mjs';
import { normalizeNode } from '../keychain-release/anchor.mjs';

const exec = promisify(execFile);
export function nativeReader({ binary, scheme, endpoint }) {
  need(typeof binary === 'string' && binary.length > 0 && typeof endpoint === 'string' && endpoint.length > 0, 'PROVIDER_CONFIG');
  need(['ar', 'ant'].includes(scheme), 'RAIL');
  if (scheme === 'ar') endpoint = normalizeNode(endpoint);
  return { id: `${scheme}:${endpoint}`, scheme, async get(address, maxBytes) {
    location({ scheme, address }); integer(maxBytes); need(maxBytes <= 256 * 1024 * 1024, 'RESOURCE_LIMIT');
    const { stdout } = await exec(binary, [scheme, address, endpoint, String(maxBytes)], {
      encoding: 'buffer', maxBuffer: Math.max(4096, maxBytes + 1), timeout: 120_000, windowsHide: true,
    });
    need(stdout.length <= maxBytes, 'RESOURCE_LIMIT'); return stdout;
  } };
}

// bzDiD identity is free/off-chain. This verifies a wallet's current signing
// key against an ALREADY trusted repository policy; it cannot authorize itself.
// Vaulta/EVM account creation, RAM/CPU/NET and payments remain wallet operations.
export async function verifyOwner({ binary, did, genesis, rotations = [], head, sequence, clock, policy }) {
  validatePolicy(policy); hash(head); integer(sequence); integer(clock, 1);
  need(typeof did === 'string' && /^did:b:[a-z2-7]{52}$/.test(did) && rotations.length <= 1024, 'IDENTITY');
  const { stdout } = await exec(binary, [did, genesis, head.slice(7), String(sequence), String(clock), ...rotations],
    { encoding: 'utf8', timeout: 30_000, maxBuffer: 65_536, windowsHide: true });
  const key = stdout.trim(); need(/^[0-9a-f]{3904}$/.test(key), 'IDENTITY_KEY');
  const publicKey = Buffer.from(key, 'hex').toString('base64url');
  const found = policy.keys.find(k => k.alg === 'ml-dsa-65' && k.public_key === publicKey && policy.update_keys.includes(k.id));
  need(found, 'IDENTITY_POLICY');
  return { did, head, sequence, key_id: found.id, authority: 'one pinned update key; repository threshold still applies', chain_accounts_created: 0 };
}
