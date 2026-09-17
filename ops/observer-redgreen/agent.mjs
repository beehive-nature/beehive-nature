// Scripted ACP agent (ndjson stdio) for the observer RED/GREEN harness.
// On every session/prompt it emits: a small agent_message_chunk, ONE oversized
// tool_call content (~78KB — the observed failing payload class), a final small
// chunk, then end_turn. Logs its own activity to stderr.
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const BIG = ('X'.repeat(76) + '\n').repeat(1024); // 78,848 bytes — the oversized class
const CHUNKS = 80;              // mid-size chunks per turn
const MID = 'm'.repeat(1200);   // each 1,200 bytes → 96KB total across chunks
// Shape C: raw length ~40KB (UNDER the cap) but JSON-serialized ~80KB (OVER it)
// — every char is a double quote, which serde/JSON escapes to \" (2 chars each).
const ESCAPY = '"'.repeat(40000);
// Escalator: per-turn raw leaf sizes (all quotes → serialized ≈ 2× raw):
// t1 ≈ 70KB ser, t2 ≈ 100KB ser, t3 ≈ 130KB ser, t4 ≈ 160KB ser — bisect the
// deployed sender's actual plaintext ceiling.
const LADDER = [35000, 50000, 65000, 80000];
let promptCount = 0;

const LABEL = process.env.AGENT_LABEL || 'run';
const ALOG = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), `agent-${LABEL}.log`);
const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => {
  const line = `[agent ${ts()}] ` + a.join(' ');
  process.stderr.write(line + '\n');
  try { fs.appendFileSync(ALOG, line + '\n'); } catch {}
};

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  const result = r => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: r }) + '\n');
  const notify = (m, p) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: m, params: p }) + '\n');

  switch (method) {
    case 'initialize':
      result({
        protocolVersion: 1,
        agentCapabilities: { loadSession: true, promptCapabilities: {} },
        agentInfo: { name: 'red-agent', version: '0.1.0' }, authMethods: [],
      });
      log('initialized');
      break;
    case 'session/new':
      result({ sessionId: 'red-s1' });
      log('session/new');
      break;
    case 'session/load':
      result({ sessionId: 'red-s1', lastUsedTs: null });
      break;
    case 'session/set_config_option':
      result({});
      break;
    case 'session/prompt': {
      promptCount++;
      const sid = params?.sessionId || 'red-s1';
      const sustained = process.env.AGENT_SUSTAINED === '1';
      log(`prompt #${promptCount} received — emitting oversized tool_call (${BIG.length} bytes) + ${CHUNKS} mid-size chunks${sustained ? ' + SUSTAINED 50KB/200ms stream' : ''}`);
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'RED working: emitting oversized tool content now (' + BIG.length + ' bytes payload).' } } });
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'tool_call', toolCallId: 'tc-big-' + promptCount, title: 'oversized tool result', kind: 'execute', content: { type: 'text', text: BIG } } });
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'tool_call', toolCallId: 'tc-esc-' + promptCount, title: 'escape-heavy payload', kind: 'execute', content: { type: 'text', text: ESCAPY } } });
      const LAD = LADDER[(promptCount - 1) % LADDER.length];
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'tool_call', toolCallId: 'tc-lad-' + promptCount, title: 'ladder raw=' + LAD, kind: 'execute', content: { type: 'text', text: '"'.repeat(LAD) } } });
      // Shape F: thinking stream (kimi-k3 thinking=max correlates with the night's
      // failures) — many mid-size thought chunks + one giant thought.
      for (let i = 0; i < 20; i++) {
        notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'thinking-' + i + ': ' + 't'.repeat(5000) } } });
      }
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'giant-thought: ' + 'T'.repeat(70000) } } });
      // Shape G: sustained stream — 50KB every 200ms for ~50s (input ≫ 1 frame/s drain)
      if (sustained) {
        const smallIv = setInterval(() => {
          notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'small-beacon-' + Date.now() % 100000 } } });
        }, 1000);
        const iv = setInterval(() => {
          notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'sustained: ' + 's'.repeat(50000) } } });
        }, 200);
        setTimeout(() => {
          clearInterval(iv); clearInterval(smallIv);
          notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: ' RED-REPLY-OK turn complete (#' + promptCount + ').' } } });
          result({ stopReason: 'end_turn' }); log(`prompt #${promptCount} end_turn (sustained)`);
        }, 50000);
        break;
      }
      // Shape B: many mid-size chunks — each under any elide floor, together far
      // over the plaintext cap; exercises the batch-envelope path.
      for (let i = 0; i < CHUNKS; i++) {
        notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `chunk-${promptCount}-${i} ` + MID.repeat(1) } } });
      }
      notify('session/update', { sessionId: sid, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: ' RED-REPLY-OK turn complete (#' + promptCount + ').' } } });
      setTimeout(() => { result({ stopReason: 'end_turn' }); log(`prompt #${promptCount} end_turn`); }, 400);
      break;
    }
    default:
      if (id !== undefined) result({});
  }
});
log('agent up, BIG=' + BIG.length + ' bytes');
