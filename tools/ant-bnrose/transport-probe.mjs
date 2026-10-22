// Install only inside the dedicated experiment page, before importing the SDK.
// No addresses, certificates or SDP are retained in receipts.
export function installTransportProbe() {
  const Native = globalThis.RTCPeerConnection;
  const peers = [];
  let received = 0, sent = 0, closedByHarness = 0;
  const Wrapped = function(...args) {
    const pc = new Native(...args);
    const record = {pc, opened: 0, closed: false, received: 0, sent: 0};
    peers.push(record);
    const channel = pc.createDataChannel.bind(pc);
    pc.createDataChannel = (...args) => {
      const dc = channel(...args);
      dc.addEventListener('open', () => record.opened++);
      dc.addEventListener('message', e => {
        const n = e.data?.byteLength ?? e.data?.size ?? (typeof e.data === 'string' ? e.data.length : 0);
        record.received += n; received += n;
      });
      const send = dc.send.bind(dc);
      dc.send = data => {
        const n = data?.byteLength ?? data?.size ?? (typeof data === 'string' ? data.length : 0);
        const result = send(data);
        record.sent += n; sent += n;
        return result;
      };
      return dc;
    };
    pc.addEventListener('connectionstatechange', () => { if(pc.connectionState === 'closed') record.closed = true; });
    return pc;
  };
  Wrapped.prototype = Native.prototype;
  Object.setPrototypeOf(Wrapped, Native);
  globalThis.RTCPeerConnection = Wrapped;
  return {
    snapshot() { return {created: peers.length, opened: peers.filter(p=>p.opened).length,
      connected:peers.filter(p=>p.pc.connectionState==='connected').length,
      closed: peers.filter(p=>p.closed || p.pc.connectionState === 'closed').length,
      received_datachannel_bytes:received, sent_datachannel_bytes:sent, closedByHarness}; },
    closeOwned() {
      let n = 0;
      for(const p of peers) if(p.pc.connectionState !== 'closed') {
        p.pc.close(); p.closed = true; n++;
      }
      closedByHarness += n;
      return n;
    },
    async selectedPaths() {
      const result = [];
      for (const {pc} of peers) {
        try {
          const stats = await pc.getStats();
          for (const t of stats.values()) if (t.type === 'transport') {
            const pair = stats.get(t.selectedCandidatePairId);
            if (!pair) continue;
            const local = stats.get(pair.localCandidateId), remote = stats.get(pair.remoteCandidateId);
            result.push({state: pair.state, localType: local?.candidateType,
              remoteType: remote?.candidateType, protocol: remote?.protocol,
              bytesSent: pair.bytesSent, bytesReceived: pair.bytesReceived,
              dtlsState: t.dtlsState, dtlsCipher: t.dtlsCipher, tlsVersion: t.tlsVersion});
          }
        } catch { /* Closed connections may have no remaining stats. */ }
      }
      return result;
    },
  };
}
