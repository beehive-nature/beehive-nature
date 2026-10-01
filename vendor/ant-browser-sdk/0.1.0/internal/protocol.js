import { AutonomiError } from "../errors.js";
export function chunksFromCore(chunks) {
    return chunks.map((chunk) => ({ index: chunk.index, dstHash: chunk.dst_hash, srcHash: chunk.src_hash, srcSize: chunk.src_size }));
}
export function publicFileFromCore(file) {
    return {
        name: file.name, address: file.address, size: file.size, contentType: file.content_type,
        blake3: file.blake3, dataMapSize: file.data_map_size, replicas: file.replicas,
        chunks: chunksFromCore(file.chunks),
    };
}
export function corePublicFile(file) {
    return {
        name: file.name, address: file.address, size: file.size, content_type: file.contentType,
        blake3: file.blake3, data_map_size: file.dataMapSize, replicas: file.replicas,
        chunks: file.chunks.map((chunk) => ({ index: chunk.index, dst_hash: chunk.dstHash, src_hash: chunk.srcHash, src_size: chunk.srcSize })),
    };
}
export function isPrivateFile(file) {
    return typeof file === "object" && file !== null && "dataMap" in file;
}
/** Private reads pass the caller-held DataMap; Rust fetches its nested records and names unnamed files. */
export function corePrivateFile(file) {
    if (!(file.dataMap instanceof Uint8Array) || file.dataMap.byteLength === 0) {
        throw new AutonomiError("INVALID_SOURCE", "A private file requires its DataMap bytes");
    }
    return { data_map: file.dataMap, name: file.name ?? "", content_type: file.contentType ?? "" };
}
/** Rust describes a private file like a public one; the SDK keeps the caller's DataMap instead of an address. */
export function privateFileFromCore(file, dataMap) {
    return {
        name: file.name, size: file.size, contentType: file.content_type, blake3: file.blake3,
        dataMap: dataMap.slice(), dataMapSize: file.data_map_size, chunks: chunksFromCore(file.chunks), replicas: file.replicas,
    };
}
/** Read APIs identify content solely by its DataMap address. */
export function coreFileReference(file) {
    return { address: file.address, name: file.name, content_type: file.contentType };
}
export function helloFromCore(hello, payment) {
    return {
        type: hello.type, protocol: hello.protocol, peerId: hello.peer_id,
        endpoint: { ...hello.endpoint }, maxChunkSize: hello.max_chunk_size,
        capabilities: [...hello.capabilities], payment,
    };
}
export function nodeFromCore(node) {
    return {
        peerId: node.peer_id, nativeAddresses: [...node.native_addresses], reliability: node.reliability,
        ...(node.webrtc_direct ? { webrtcDirect: { ...node.webrtc_direct } } : {}),
    };
}
export function lookupFromCore(result) {
    return { nodes: result.nodes.map(nodeFromCore), queried: [...result.queried], failures: result.failures.map((failure) => ({ ...failure })) };
}
//# sourceMappingURL=protocol.js.map