// Local publishing preparation only. No upload, credentials, or network requests.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

function run(bin, args, cwd) {
  const r = spawnSync(bin, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`${bin}: ${r.error?.message || r.stderr}`);
  return r.stdout;
}
export async function packageHls(input, output, { ffmpeg = process.env.FFMPEG || 'ffmpeg', ffprobe = process.env.FFPROBE || 'ffprobe' } = {}) {
  input = resolve(input); output = resolve(output);
  if (!(await stat(input)).isFile()) throw new Error('Input must be a local media file');
  const probe = JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', input]));
  const video = probe.streams.find(s => s.codec_type === 'video');
  if (!video || !(Number(probe.format.duration) > 0)) throw new Error('A finite video is required');
  // Refuse to overwrite any output. A failed run remains inspectable, never published as complete.
  await mkdir(output);
  const ladder = [{ height: 240, kbps: 350 }, { height: 360, kbps: 700 }, { height: 720, kbps: 2200 }, { height: 1080, kbps: 4500 }]
    .filter((r, i) => i === 0 || r.height <= video.height);
  const variants = [], files = [];
  for (const r of ladder) {
    const label = `v${r.height}`, dir = join(output, label); await mkdir(dir);
    const height = Math.floor(Math.min(video.height, r.height) / 2) * 2;
    run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', input,
      '-map', '0:v:0', '-map', '0:a:0?', '-vf', `scale=-2:${height},fps=30`,
      '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-b:v', `${r.kbps}k`, '-maxrate', `${Math.ceil(r.kbps * 1.15)}k`, '-bufsize', `${r.kbps * 2}k`,
      '-g', '120', '-keyint_min', '120', '-sc_threshold', '0', '-force_key_frames', 'expr:gte(t,n_forced*4)',
      '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-ar', '48000',
      '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
      '-hls_flags', 'independent_segments', '-hls_fmp4_init_filename', 'init.mp4',
      '-hls_segment_filename', 'segment-%05d.m4s', 'index.m3u8'], dir);
    const playlist = await readFile(join(dir, 'index.m3u8'), 'utf8');
    const segments = [...playlist.matchAll(/#EXTINF:([\d.]+),[^\n]*\n([^\r\n]+)/g)];
    let bytes = 0, duration = 0, peakBps = 0;
    for (const [, seconds, name] of segments) {
      const n = (await stat(join(dir, name))).size;
      bytes += n; duration += Number(seconds); peakBps = Math.max(peakBps, n * 8 / Number(seconds));
    }
    if (!segments.length || !playlist.includes('#EXT-X-ENDLIST')) throw new Error('Incomplete HLS output');
    const metadata = JSON.parse(run(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', 'index.m3u8'], dir));
    const encoded = metadata.streams.find(s => s.codec_type === 'video');
    variants.push({ path: `${label}/index.m3u8`, width: encoded.width, height: encoded.height,
      bandwidth: Math.ceil(peakBps * 1.1), averageBandwidth: Math.ceil(bytes * 8 / duration), bytes, duration, segments: segments.length });
    for (const name of (await readdir(dir)).sort()) {
      const data = await readFile(join(dir, name));
      files.push({ path: `${label}/${name}`, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
  const master = '#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-INDEPENDENT-SEGMENTS\n' + variants.map(v =>
    `#EXT-X-STREAM-INF:BANDWIDTH=${v.bandwidth},AVERAGE-BANDWIDTH=${v.averageBandwidth},RESOLUTION=${v.width}x${v.height},FRAME-RATE=30\n${v.path}\n`).join('');
  await writeFile(join(output, 'master.m3u8'), master, { flag: 'wx' });
  const report = { schema: 'bview-hls-package/1', constant: 'PUBLIC-CONSTANT',
    boundary: 'local H264/AAC VOD encode; no upload or visual-quality equivalence claim',
    encoder: run(ffmpeg, ['-version']).split('\n')[0], sourceBytes: (await stat(input)).size,
    sourceDuration: Number(probe.format.duration), sourceWidth: video.width, sourceHeight: video.height,
    segmentSeconds: 4, bundleId: createHash('sha256').update(master + JSON.stringify(files)).digest('hex'), variants, files };
  await writeFile(join(output, 'package.json'), JSON.stringify(report) + '\n', { flag: 'wx' });
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node tools/video-trial/package-hls.mjs LOCAL_VIDEO NEW_OUTPUT_DIRECTORY');
  console.log(JSON.stringify(await packageHls(input, output), null, 2));
}
