/* W-1 — the in-browser model block in surfaces/review.html. No browser and no
   model: the block runs in a vm against a small DOM double, and the vendored
   web-llm import is replaced by a recorded fake engine. These prove the
   block's own promises — nothing fetched until the wake, one load, a wire
   counter that starts at ready, honest failure — not WebGPU inference. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const page = read('surfaces/review.html');

const START = '/* W-1 — the in-browser model docks in the bLOVErAi window';
const IMPORT = "import('./blight/web-llm.mjs')";

function w1Block(html) {
  const start = html.indexOf(START);
  const end = html.indexOf('</script>', start);
  assert.ok(start > 0 && end > start, 'W-1 block markers must bracket a script body; a moved marker fails here');
  assert.ok(html.slice(0, start).endsWith('<script>\n'), 'W-1 is a bare inline script');
  const src = html.slice(start, end);
  assert.equal(src.split(IMPORT).length - 1, 1, 'W-1 loads the vendored engine through exactly one import');
  return src;
}

function harness({ gpu = true, importFails = null, promptShown = false } = {}) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, innerHTML: '', textContent: '', value: '', disabled: false, style: {}, scrollTop: 0, scrollHeight: 0, onclick: null });
    return nodes.get(id);
  };
  for (const id of ['w1wake','w1st','w1ask','w1go','w1out','w1wire','promptOut']) node(id);
  node('w1go').disabled = true;
  node('promptOut').textContent = 'REVIEW PROMPT BODY';
  node('promptOut').style.display = promptShown ? 'block' : '';
  const document = { getElementById(id) {
    // w1prog only exists once the wake has written it into #w1st.
    if (id === 'w1prog' && !node('w1st').innerHTML.includes('id="w1prog"')) return null;
    return node(id);
  } };
  const log = { imports: [], creates: [], requests: [] };
  let observer = null;
  const engine = { chat: { completions: { async create(req) {
    log.requests.push(req);
    return (async function* () {
      yield { choices: [{ delta: { content: 'on ' } }] };
      yield { choices: [{ delta: {} }] };
      yield { choices: [{ delta: { content: 'device' } }] };
    })();
  } } } };
  const load = async path => {
    log.imports.push(path);
    if (importFails) throw new Error(importFails);
    return { CreateMLCEngine: async (model, opts) => {
      log.creates.push(model);
      opts.initProgressCallback({ text: 'Fetching   param\ncache', progress: 0.5 });
      return engine;
    } };
  };
  let now = 1000;
  const ctx = {
    document,
    navigator: gpu ? { gpu: {} } : {},
    performance: { now: () => now++ },
    PerformanceObserver: function (cb) { observer = cb; this.observe = () => {}; },
    __load: load,
  };
  vm.createContext(ctx);
  vm.runInContext(w1Block(page).replace(IMPORT, "__load('./blight/web-llm.mjs')"), ctx);
  const resource = (...names) => observer({ getEntries: () => names.map(name => ({ name })) });
  return { node, log, resource };
}

test('the W-1 block is bracketed and its vendored engine is on disk', () => {
  const src = w1Block(page);
  assert.match(src, /var MODEL='SmolLM2-360M-Instruct-q4f16_1-MLC';/);
  assert.ok(existsSync(fileURLToPath(new URL('../surfaces/blight/web-llm.mjs', import.meta.url))));
  for (const id of ['w1wake','w1st','w1ask','w1go','w1out','w1wire','promptOut']) assert.ok(page.includes('id="'+id+'"'), '#'+id);
  assert.match(page, /<button id="w1go" disabled>/, 'answering stays disabled until the model is ready');
});

test('asleep: nothing is imported or counted before the wake', () => {
  const { node, log, resource } = harness();
  resource('https://huggingface.co/before-ready');
  assert.deepEqual(log.imports, []);
  assert.equal(node('w1wire').innerHTML, '', 'wire panel untouched before ready');
  assert.equal(node('w1go').disabled, true);
});

test('wake loads the pinned model once, then enables answering', async () => {
  const { node, log } = harness();
  await node('w1wake').onclick();
  assert.deepEqual(log.imports, ['./blight/web-llm.mjs']);
  assert.deepEqual(log.creates, ['SmolLM2-360M-Instruct-q4f16_1-MLC']);
  assert.match(node('w1st').innerHTML, /model ready/);
  assert.equal(node('w1go').disabled, false);
  assert.equal(node('w1ask').value, 'Answer in at most six sentences, plainly.', 'no built prompt shown → none carried');
  assert.match(node('w1wire').innerHTML, /class="ok">0 requests since ready<\/b> — nothing leaves this tab/);
  await node('w1wake').onclick();
  assert.equal(log.imports.length, 1, 'a second wake never reloads the model');
});

test('progress text is flattened and shown as a percentage', async () => {
  const { node } = harness();
  await node('w1wake').onclick();
  // The double keeps the #w1prog node after "ready" rewrites #w1st, so the last progress write is readable.
  assert.equal(node('w1prog').textContent, 'Fetching param cache · 50%');
});

test('the built prompt above is carried into the ask box when it is showing', async () => {
  const { node } = harness({ promptShown: true });
  await node('w1wake').onclick();
  assert.equal(node('w1ask').value, 'REVIEW PROMPT BODY\n\nAnswer in at most six sentences, plainly.');
});

test('the wire counts every resource after ready and marks it bad', async () => {
  const { node, resource } = harness();
  resource('https://huggingface.co/before-ready');
  await node('w1wake').onclick();
  resource('https://example.org/one', 'http://example.org/two');
  const wire = node('w1wire').innerHTML;
  assert.match(wire, /class="bad">2 requests since ready<\/b>/);
  assert.match(wire, /example\.org\/one<br>example\.org\/two/, 'scheme stripped, the log shown');
  assert.doesNotMatch(wire, /huggingface/, 'the load itself is not counted');
});

test('answering streams on the device and appends the zero-request footer', async () => {
  const { node, log } = harness();
  await node('w1wake').onclick();
  node('w1ask').value = '  what is W-1?  ';
  await node('w1go').onclick();
  assert.equal(log.requests.length, 1);
  assert.equal(JSON.stringify(log.requests[0].messages), JSON.stringify([{ role: 'user', content: 'what is W-1?' }]), 'the vm realm owns the array');
  assert.equal(log.requests[0].stream, true);
  assert.equal(node('w1out').style.display, 'block');
  assert.equal(node('w1out').textContent, 'on device\n— SmolLM2-360M · on your device · zero requests to answer');
  assert.equal(node('w1go').disabled, false);
  node('w1ask').value = '   ';
  await node('w1go').onclick();
  assert.equal(log.requests.length, 1, 'an empty question sends nothing');
});

test('a failed wake is reported, re-armed, and names missing WebGPU', async () => {
  const { node, log } = harness({ gpu: false, importFails: 'no adapter' });
  await node('w1wake').onclick();
  assert.equal(log.imports.length, 1);
  assert.equal(node('w1wake').disabled, false, 'the wake can be retried');
  assert.equal(node('w1go').disabled, true, 'nothing to answer with');
  assert.match(node('w1st').innerHTML, /class="bad">the model did not wake:<\/span> no adapter — this browser has no WebGPU/);
  const withGpu = harness({ importFails: 'quota' });
  await withGpu.node('w1wake').onclick();
  assert.doesNotMatch(withGpu.node('w1st').innerHTML, /no WebGPU/);
});
