// Offline packer; produces one public file for the existing browser wallet.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCHEMA, MAGIC, HEADER_BYTES, LIMITS, digest, validateManifest } from './ant-hls.mjs';

export async function packDirectory(directory, sourceAddress) {
  const root = resolve(directory), descriptor = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  if (descriptor.schema !== 'bview-hls-package/1') throw Error('Unsupported encoder package');
  const files = [], media = []; let offset = 0;
  const entries = [{ path: 'master.m3u8' }, ...descriptor.files];
  for (const entry of entries) {
    const file = resolve(root, entry.path), rel = relative(root, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw Error('Path outside package');
    const bytes = await readFile(file), sha256 = await digest(bytes);
    if (entry.sha256 && (sha256 !== entry.sha256 || bytes.length !== entry.bytes)) throw Error('Encoder receipt mismatch: ' + entry.path);
    const f = { path: entry.path, bytes: bytes.length, sha256 };
    if (entry.path.endsWith('.m3u8')) f.text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    else { f.offset = offset; offset += bytes.length; media.push(bytes); }
    files.push(f);
  }
  const manifest = { schema: SCHEMA, bundleId: descriptor.bundleId, sourceAddress, files };
  validateManifest(manifest, offset);
  const index = Buffer.from(JSON.stringify(manifest)), header = Buffer.alloc(HEADER_BYTES);
  if (index.length > LIMITS.manifestBytes) throw Error('Manifest too large');
  header.set(MAGIC); header.writeUInt32LE(index.length, 12);
  const bytes = Buffer.concat([header, index, ...media]);
  if (bytes.length > 32 * 1024 * 1024) throw Error('Pack exceeds the hosted wallet 32 MiB verification limit');
  return { bytes, manifest, receipt: { schema: 'bnr.ant-hls-pack-receipt/1', constant: 'PUBLIC-CONSTANT',
    sha256: await digest(bytes), bytes: bytes.length, manifestBytes: index.length, mediaBytes: offset,
    assets: files.length, sourceAddress, bundleId: descriptor.bundleId,
    status: 'prepared; upload, payment and ANT retrieval not yet verified' } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , directory, sourceAddress, destination] = process.argv;
  if (!destination) throw Error('Usage: node pack.mjs ENCODED_DIRECTORY ORIGINAL_ADDRESS OUTPUT.ant-hls');
  const { bytes, receipt } = await packDirectory(directory, sourceAddress);
  await writeFile(destination, bytes, { flag: 'wx' });
  await writeFile(destination + '.json', JSON.stringify(receipt) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(receipt));
}
