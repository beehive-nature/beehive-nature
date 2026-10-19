// Existing x0xd /direct/send and history payload shapes; no daemon or identity creation.
import { canonicalDocument, parseDocument, need, bytesDigest, record, hash, text } from './contract.mjs';
import { validateNotice } from './hive.mjs';

export function directRequest(agentId, notice) {
  text(agentId); validateNotice(notice);
  const bytes = canonicalDocument(notice);
  return { agent_id: agentId, payload: bytes.toString('base64'), logical_id: bytesDigest(bytes), require_durable_app_ack: true };
}
export function receiveNotice(store, sender, request) {
  text(sender); record(request, ['logical_id', 'payload']); hash(request.logical_id);
  need(typeof request.payload === 'string' && request.payload.length <= 12_000, 'RESOURCE_LIMIT');
  const bytes = Buffer.from(request.payload, 'base64');
  need(bytes.toString('base64') === request.payload && bytesDigest(bytes) === request.logical_id, 'TRANSPORT_BINDING');
  const notice = validateNotice(parseDocument(bytes));
  const received = store.receive(sender, request.logical_id, bytes);
  return { ...received, notice, authority: 'discovery only; delivery and acknowledgement never advance checkpoints' };
}
