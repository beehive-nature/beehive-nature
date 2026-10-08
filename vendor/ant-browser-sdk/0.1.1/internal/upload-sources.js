import { AutonomiError } from "../errors.js";
import { throwIfAborted } from "./abort.js";
import { chunksFromCore, } from "./protocol.js";
import { deleteStagedRecordRange } from "./record-store.js";
import { getBindings } from "./runtime.js";
import { loadStagedRecord, openStagingSession, requestPersistentStaging, stagingBudget, } from "./staging.js";
import { unwrapWindowCheckpoint } from "./window-checkpoint.js";
/**
 * Restore a persisted checkpoint. A plain Rust checkpoint covers the whole file in
 * one window; a windowed one names the window whose scope it covers.
 */
export function restoreCheckpoint(state, value) {
    const windowed = unwrapWindowCheckpoint(value);
    const { cursor } = state;
    if (!windowed) {
        state.coreCheckpoint = value;
        if (cursor)
            cursor.pinned = {};
        return;
    }
    if (!cursor) {
        throw new AutonomiError("INVALID_SOURCE", "A windowed upload checkpoint resumes only a File or Blob upload");
    }
    state.coreCheckpoint = windowed.checkpoint;
    cursor.nextRecord = windowed.window.firstIndex;
    cursor.pinned = { records: windowed.window.records };
    cursor.windowed = true;
}
/** Self-encrypt retained bytes with the native encryptor and upload every record as one batch. */
export async function uploadBytes(state, upload, report) {
    report(`Self-encrypting ${state.name} (${state.size} bytes)`, { phase: "preparing" });
    const encrypted = getBindings().encryptPublicFile(state.bytes);
    // Native self-encryption always ends with the canonical DataMap record.
    const dataMap = encrypted.records.at(-1).content;
    const records = state.visibility === "private" ? encrypted.records.slice(0, -1) : encrypted.records;
    const result = await upload({ records: records.map(({ address, content }) => ({ address, size: content.byteLength })), total_records: records.length }, (index) => records[index].content);
    return uploadedFile(state, result, records.length, {
        address: encrypted.address, size: state.size, blake3: encrypted.blake3,
        dataMapSize: encrypted.data_map_size, chunks: chunksFromCore(encrypted.chunks), dataMap,
    });
}
/**
 * Self-encrypt a File or Blob in a worker and upload it window by window. Each
 * window stages as many records as the origin's storage quota allows, is paid and
 * stored as one batch, and is deleted before the next window is encrypted. A file
 * that fits in one window is uploaded exactly as one batch.
 */
export async function uploadFileInWindows(state, upload, { report, signal, wasm }) {
    const cursor = state.cursor;
    let session;
    try {
        await requestPersistentStaging();
        for (;;) {
            throwIfAborted(signal);
            if (!cursor.window) {
                session ??= openStagingSession({
                    blob: state.blob, name: state.name, contentType: state.contentType, sessionId: cursor.sessionId,
                    skip: cursor.nextRecord, withholdDataMap: state.visibility === "private", wasm, report,
                });
                cursor.window = await stageWindow(session, cursor, signal);
            }
            const window = cursor.window;
            const end = window.firstIndex + window.records.length;
            report(cursor.windowed
                ? `Preparing storage for ${state.name} records ${window.firstIndex + 1}-${end}`
                : `Preparing storage for ${state.name}`, { phase: "preparing" });
            const result = await upload({ records: window.records, first_index: window.firstIndex, ...(window.file ? { total_records: end } : {}) }, (index, _address, size) => loadStagedRecord(cursor.sessionId, window.firstIndex + index, size, signal), cursor.windowed ? { firstIndex: window.firstIndex, records: window.records.length } : undefined);
            // The next window has its own checkpoint scope.
            delete state.coreCheckpoint;
            delete cursor.pinned;
            cursor.usedMerkle ||= result.paymentMode === "merkle";
            await deleteStagedRecordRange(cursor.sessionId, window.firstIndex, end);
            delete cursor.window;
            if (window.file) {
                const { file } = window;
                return uploadedFile(state, { ...result, paymentMode: cursor.usedMerkle ? "merkle" : result.paymentMode }, end, {
                    address: file.address, size: file.size, blake3: file.blake3, dataMapSize: file.data_map_size,
                    chunks: chunksFromCore(file.chunks), ...(window.dataMap ? { dataMap: window.dataMap } : {}),
                });
            }
        }
    }
    finally {
        session?.close();
    }
}
async function stageWindow(session, cursor, signal) {
    try {
        const limit = cursor.pinned ? cursor.pinned : { bytes: await stagingBudget() };
        const window = await session.next(limit, signal);
        cursor.nextRecord = window.firstIndex + window.records.length;
        if (!window.file)
            cursor.windowed = true;
        return window;
    }
    catch (error) {
        // Drop a partially staged window; a resumed attempt stages it again.
        await deleteStagedRecordRange(cursor.sessionId, cursor.nextRecord).catch(() => undefined);
        throw error;
    }
}
function uploadedFile(state, result, records, { address, dataMap, ...metadata }) {
    const described = { ...metadata, name: state.name, contentType: state.contentType, replicas: result.replicas };
    if (state.visibility === "private" && !dataMap)
        throw new Error("Self-encryption did not return the private DataMap");
    return {
        // A private file is read through its DataMap; the address would only name an unstored record.
        file: state.visibility === "private" ? { ...described, dataMap: dataMap.slice() } : { ...described, address },
        records,
        paymentMode: result.paymentMode,
        ...(result.transactionHash ? { transactionHash: result.transactionHash } : {}),
    };
}
//# sourceMappingURL=upload-sources.js.map