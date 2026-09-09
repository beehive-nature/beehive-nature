#!/usr/bin/env node
// Local preparation only. No downloader, network client, signing or publication.
import {createHash} from 'node:crypto';
import {open, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const BASES = new Set(['unconfirmed', 'original', 'permission', 'licensed', 'public-domain']);
const MAX_INLINE = 256 * 1024; // surfaces/arweave.js: MAX_INLINE / chunkRoot.
const usage = `Prepare an audio file for review; this never uploads or signs.
node scripts/prepare-audio-release.mjs --file "track.wav" --title "Title" --artist "Artist" --out "release.json"
Optional: --rights original|permission|licensed|public-domain|unconfirmed
          --rights-note "Credit and permission/license reference"
Requires ffprobe on PATH. Rights default to unconfirmed. Output must not exist.`;

function parseArgs(args) {
  const allowed = new Set(['file', 'title', 'artist', 'out', 'rights', 'rights-note']);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !allowed.has(key) || Object.hasOwn(values, key)) throw new Error('Unknown or repeated option.\n' + usage);
    if (args[i + 1] === undefined) throw new Error('Missing option value.\n' + usage);
    values[key] = args[i + 1];
  }
  for (const key of ['file', 'title', 'artist', 'out']) if (!values[key]?.trim()) throw new Error('Missing --' + key + '.\n' + usage);
  return values;
}

export async function hashAudioFile(file) {
  const handle = await open(file, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size === 0) throw new Error('Choose a nonempty regular audio file.');
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(128 * 1024);
    let bytes = 0;
    for (;;) {
      const part = await handle.read(buffer, 0, buffer.length, bytes);
      if (part.bytesRead === 0) break;
      hash.update(buffer.subarray(0, part.bytesRead));
      bytes += part.bytesRead;
    }
    const after = await handle.stat();
    if (bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
      throw new Error('The file changed while it was being measured. Prepare a stable export.');
    }
    return {bytes, sha256: hash.digest('hex'), stamp: {size: after.size, mtimeMs: after.mtimeMs, ctimeMs: after.ctimeMs, ino: after.ino, dev: after.dev}};
  } finally { await handle.close(); }
}

function probeAudio(file) {
  let raw;
  try {
    raw = execFileSync('ffprobe', [
      '-v', 'error', '-protocol_whitelist', 'file,pipe',
      '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name,sample_rate,channels:stream_disposition=attached_pic',
      '-of', 'json', file
    ], {encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('ffprobe is required on PATH; no media validation was performed.');
    throw new Error('ffprobe could not validate this local audio file. No release was prepared.');
  }
  const result = JSON.parse(raw);
  const streams = result.streams || [];
  const audio = streams.filter(stream => stream.codec_type === 'audio');
  if (!audio.length || streams.some(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1)) {
    throw new Error('Choose an audio recording, not a video or playlist.');
  }
  const formats = String(result.format?.format_name || '').split(',');
  const types = {mp3:'audio/mpeg', wav:'audio/wav', flac:'audio/flac', ogg:'audio/ogg', aac:'audio/aac', m4a:'audio/mp4'};
  const container = formats.find(name => types[name]);
  const duration = Number(result.format?.duration);
  if (!container || !Number.isFinite(duration) || duration <= 0) throw new Error('Unsupported audio container or unknown duration.');
  return {contentType: types[container], durationSeconds: duration, streams: audio.map(stream => ({
    codec: stream.codec_name, sampleRate: Number(stream.sample_rate), channels: stream.channels
  })), validation: 'ffprobe metadata; not a complete decode or a browser playback receipt'};
}

export async function prepareAudioRelease(options) {
  for (const key of ['file', 'title', 'artist']) if (typeof options[key] !== 'string' || !options[key].trim()) throw new Error('Missing ' + key + '.');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(options.file)) throw new Error('Use a local audio file. This tool does not download URLs.');
  const file = resolve(options.file);
  const rights = options.rights || 'unconfirmed';
  if (!BASES.has(rights)) throw new Error('Unknown rights basis.');
  if (rights !== 'unconfirmed' && !options['rights-note']?.trim()) throw new Error('Provide a rights/credit statement for the chosen basis.');
  const measured = await hashAudioFile(file);
  const audio = probeAudio(file);
  // Refuse a replacement/change during the metadata probe as well.
  const handle = await open(file, 'r');
  try {
    const after = await handle.stat();
    for (const [key, expected] of Object.entries(measured.stamp)) if (after[key] !== expected) throw new Error('The source changed during preparation. Retry with a stable export.');
  } finally { await handle.close(); }
  return {
    schema: 'bnr-audio-release/1',
    status: 'prepared-local-only',
    preparedAt: new Date().toISOString(),
    title: options.title, artist: options.artist,
    sourceFile: basename(file),
    content: {bytes: measured.bytes, sha256: measured.sha256, ...audio},
    rights: {basis: rights, statement: options['rights-note'] || '', verification: 'user statement; not independently verified'},
    storage: {
      arweave: {status:'not-uploaded', transactionId:null, retrievedSha256:null},
      autonomi: {status:'not-uploaded', address:null, retrievedSha256:null}
    },
    plan: {
      arweaveBrowserAdapter: measured.bytes <= MAX_INLINE ? 'within current inline size limit; quote/signing still required' : 'over current 256 KiB inline limit; chunked or reviewed large-payload uploader required',
      autonomi: 'review pinned uploader and resumable-finalize status before a full recording; external-signer prepare/quote, founder signature, finalize, then retrieve and compare the complete file',
      fees: 'not quoted',
      publication: 'not performed',
      player: 'only advertise a stored source after retrieval matches bytes and sha256; show actual gateway/resolver dependency in technical details'
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--help')) { console.log(usage); }
    else {
      const options = parseArgs(process.argv.slice(2));
      const manifest = await prepareAudioRelease(options);
      // Hash is public metadata; keep the repository hook marker on its line.
      const text = JSON.stringify(manifest, null, 2).replace(/("sha256": "[a-f0-9]+"),/, '$1, "digestNote": "PUBLIC-CONSTANT: source content digest",') + '\n';
      await writeFile(resolve(options.out), text, {flag:'wx'});
      console.log('Prepared local review manifest: ' + basename(options.out));
      console.log(manifest.content.bytes + ' bytes; ' + manifest.content.durationSeconds + ' seconds. No network, upload, payment or signing.');
    }
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'Output already exists; choose a new output name.' : error.message);
    process.exitCode = 1;
  }
}
