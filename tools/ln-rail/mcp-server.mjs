/* mcp-server.mjs — the MCP->NWC bridge proper (stdio JSON-RPC 2.0, MCP 2024-11-05).
   Exposes exactly two tools — pay_invoice and get_balance — because an agent's
   money verbs should be countable on one hand. The allowance ceiling is NOT
   enforced here (this bridge is transport, not treasury): it is enforced
   upstream at the NWC connection budget (hub-side, cited) and downstream in
   the bzDiD orchestration module (daily-sat caps, rotation revocation).
   Run:  NWC_URI=nostr+walletconnect://… node mcp-server.mjs */
import { nwcCall } from './nwc.mjs';
import { readFileSync } from 'node:fs';

const TOOLS = [
  {
    name: 'pay_invoice',
    description: 'Pay a BOLT11 lightning invoice from the budgeted agent connection. Over-budget attempts return QUOTA_EXCEEDED from the wallet.',
    inputSchema: { type: 'object', properties: { invoice: { type: 'string', description: 'BOLT11 invoice (lnbc…)' } }, required: ['invoice'] },
  },
  {
    name: 'get_balance',
    description: 'Read the agent connection\'s balance in millisatoshis.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');
const buf = { data: '' };
process.stdin.on('data', (d) => {
  buf.data += d;
  let nl;
  while ((nl = buf.data.indexOf('\n')) >= 0) {
    const line = buf.data.slice(0, nl).trim();
    buf.data = buf.data.slice(nl + 1);
    if (!line) continue;
    handle(JSON.parse(line)).catch(e => send({ jsonrpc: '2.0', id: null, error: { code: -32603, message: String(e.message || e) } }));
  }
});

async function handle(msg) {
  const { id, method } = msg;
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'bnr-ln-rail', version: readFileSync(new URL('./package.json', import.meta.url), 'utf8') && '1.0.0' } } });
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    const name = msg.params?.name;
    const args = msg.params?.arguments || {};
    try {
      if (name === 'pay_invoice') {
        const r = await nwcCall('pay_invoice', { invoice: args.invoice });
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(r) }] } });
      }
      if (name === 'get_balance') {
        const r = await nwcCall('get_balance');
        return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(r) }] } });
      }
      return send({ jsonrpc: '2.0', id, error: { code: -32602, message: 'unknown tool: ' + name } });
    } catch (e) {
      return send({ jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: String(e.message || e) }] } });
    }
  }
  return send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'unknown method: ' + method } });
}
