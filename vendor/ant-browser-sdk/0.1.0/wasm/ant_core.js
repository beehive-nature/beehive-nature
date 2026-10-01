/* @ts-self-types="./ant_core.d.ts" */

/**
 * Incremental self-encryptor used from a worker with a synchronous file reader.
 *
 * Each call to `nextRecord` materializes at most one encrypted record. This
 * lets JavaScript persist the record before asking WASM for the next one,
 * keeping plaintext and ciphertext file-sized buffers out of the page.
 */
export class BrowserFileEncryptor {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserFileEncryptorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browserfileencryptor_free(ptr, 0);
    }
    /**
     * Return upload metadata after `nextRecord` has reached `undefined`.
     * @param {string} name
     * @param {string} content_type
     * @returns {any}
     */
    finish(name, content_type) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(content_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.browserfileencryptor_finish(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Create an encryptor around a synchronous `(offset, length) => Uint8Array` reader.
     *
     * Browsers expose synchronous `File` reads only inside dedicated workers,
     * so page code should construct this class there rather than on the UI thread.
     * @param {number} file_size
     * @param {Function} read_chunk
     */
    constructor(file_size, read_chunk) {
        const ret = wasm.browserfileencryptor_new(file_size, read_chunk);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        BrowserFileEncryptorFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Produce the next encrypted record, or `undefined` once all records are staged.
     * @returns {any}
     */
    nextRecord() {
        const ret = wasm.browserfileencryptor_nextRecord(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
}
if (Symbol.dispose) BrowserFileEncryptor.prototype[Symbol.dispose] = BrowserFileEncryptor.prototype.free;

/**
 * Random-access public-file reader for media playback and bounded downloads.
 */
export class BrowserFileReader {
    static __wrap(ptr) {
        const obj = Object.create(BrowserFileReader.prototype);
        obj.__wbg_ptr = ptr;
        BrowserFileReaderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserFileReaderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browserfilereader_free(ptr, 0);
    }
    /**
     * Release cached encrypted records held for playback read-ahead and seeks.
     */
    close() {
        wasm.browserfilereader_close(this.__wbg_ptr);
    }
    /**
     * Browser MIME type advertised by the file descriptor.
     * @returns {string}
     */
    get contentType() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.browserfilereader_contentType(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Display filename advertised by the file descriptor.
     * @returns {string}
     */
    get name() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.browserfilereader_name(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Fetch and decrypt one plaintext byte range without reconstructing the file.
     * @param {number} start
     * @param {number} length
     * @returns {Promise<Uint8Array>}
     */
    readRange(start, length) {
        const ret = wasm.browserfilereader_readRange(this.__wbg_ptr, start, length);
        return ret;
    }
    /**
     * Plaintext file size in bytes.
     * @returns {number}
     */
    get size() {
        const ret = wasm.browserfilereader_size(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) BrowserFileReader.prototype[Symbol.dispose] = BrowserFileReader.prototype.free;

/**
 * Shared Saorsa iterative lookup state driven by browser WebRtcDirect.
 */
export class BrowserIterativeLookup {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserIterativeLookupFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browseriterativelookup_free(ptr, 0);
    }
    /**
     * Add validated bootstrap or FIND_NODE candidates.
     * @param {any} nodes
     */
    addCandidates(nodes) {
        const ret = wasm.browseriterativelookup_addCandidates(this.__wbg_ptr, nodes);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Construct a browser lookup using the same scheduler as native QUIC.
     * @param {string} target
     * @param {number} count
     * @param {number} alpha
     * @param {number} max_iterations
     */
    constructor(target, count, alpha, max_iterations) {
        const ptr0 = passStringToWasm0(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browseriterativelookup_new(ptr0, len0, count, alpha, max_iterations);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        BrowserIterativeLookupFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Peer IDs selected for network queries, in query order.
     * @returns {any}
     */
    queriedPeers() {
        const ret = wasm.browseriterativelookup_queriedPeers(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Successful responders in final closest-first order.
     * @returns {any}
     */
    results() {
        const ret = wasm.browseriterativelookup_results(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * Run the complete shared Saorsa walk through a WebRtcDirect batch callback.
     * @param {Function} query_batch
     * @returns {Promise<string>}
     */
    run(query_batch) {
        const ret = wasm.browseriterativelookup_run(this.__wbg_ptr, query_batch);
        return ret;
    }
}
if (Symbol.dispose) BrowserIterativeLookup.prototype[Symbol.dispose] = BrowserIterativeLookup.prototype.free;

/**
 * Stateful Autonomi browser client sharing Rust lookup and data workflows.
 */
export class BrowserNetworkClient {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserNetworkClientFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browsernetworkclient_free(ptr, 0);
    }
    /**
     * Close all pooled WebRTC associations.
     */
    close() {
        wasm.browsernetworkclient_close(this.__wbg_ptr);
    }
    /**
     * Authenticate the first usable configured seed in this client's own pool.
     * Remaining seeds connect in the background within the bootstrap bound.
     * @param {any | null} [expected_payment]
     * @returns {Promise<any>}
     */
    connect(expected_payment) {
        const ret = wasm.browsernetworkclient_connect(this.__wbg_ptr, isLikeNone(expected_payment) ? 0 : addToExternrefTable0(expected_payment));
        return ret;
    }
    /**
     * Download and reconstruct a private file from the DataMap its uploader kept.
     * @param {any} file
     * @param {number | null} [concurrency]
     * @param {Function | null} [on_progress]
     * @returns {Promise<any>}
     */
    downloadPrivateFile(file, concurrency, on_progress) {
        const ret = wasm.browsernetworkclient_downloadPrivateFile(this.__wbg_ptr, file, isLikeNone(concurrency) ? Number.MAX_SAFE_INTEGER : (concurrency) >>> 0, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress));
        return ret;
    }
    /**
     * Download and reconstruct a complete public Autonomi file.
     * @param {any} file
     * @param {number | null} [concurrency]
     * @param {Function | null} [on_progress]
     * @returns {Promise<any>}
     */
    downloadPublicFile(file, concurrency, on_progress) {
        const ret = wasm.browsernetworkclient_downloadPublicFile(this.__wbg_ptr, file, isLikeNone(concurrency) ? Number.MAX_SAFE_INTEGER : (concurrency) >>> 0, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress));
        return ret;
    }
    /**
     * Run Saorsa's iterative closest-node lookup over Rust-owned DataChannels.
     * @param {string} target
     * @param {Function | null} [on_progress]
     * @returns {Promise<any>}
     */
    findClosest(target, on_progress) {
        const ptr0 = passStringToWasm0(target, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsernetworkclient_findClosest(this.__wbg_ptr, ptr0, len0, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress));
        return ret;
    }
    /**
     * Construct a reusable client around stable WebRTC Direct seed addresses.
     * @param {any} endpoints
     */
    constructor(endpoints) {
        const ret = wasm.browsernetworkclient_new(endpoints);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        BrowserNetworkClientFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Resolve a private file from its DataMap for random-access range reads.
     * @param {any} file
     * @param {Function | null} [on_progress]
     * @returns {Promise<BrowserFileReader>}
     */
    openPrivateFile(file, on_progress) {
        const ret = wasm.browsernetworkclient_openPrivateFile(this.__wbg_ptr, file, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress));
        return ret;
    }
    /**
     * Resolve and validate a public file for random-access range reads.
     * @param {any} file
     * @param {Function | null} [on_progress]
     * @returns {Promise<BrowserFileReader>}
     */
    openPublicFile(file, on_progress) {
        const ret = wasm.browsernetworkclient_openPublicFile(this.__wbg_ptr, file, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress));
        return ret;
    }
    /**
     * Resolve a definitively failed payment, persist the updated checkpoint, and return it.
     *
     * Call only after the original upload and wallet request have finished. The trusted
     * `verify_failure(attempt, scope)` callback must independently verify the entire
     * journal against the original wallet/payment network, without submitting payment.
     * It returns `{ status: "notSubmitted", evidence: {...} }` only when it can prove
     * the wallet never submitted and cannot still submit, or
     * `{ status: "reverted", transactionHashes: [...], evidence: {...} }` after verifying
     * final reverts for every transaction. A missing receipt or timeout is insufficient.
     *
     * Rust checks the result against the journal; the callback owns wallet/chain
     * verification, just as payment callbacks own confirmation. Failure evidence is
     * archived, confirmed proofs are retained, and persistence is awaited before return.
     * Resume the normal upload explicitly with the returned checkpoint.
     * @param {string} snapshot
     * @param {Function} verify_failure
     * @param {Function} on_checkpoint
     * @returns {Promise<string>}
     */
    reconcileFailedUploadPayment(snapshot, verify_failure, on_checkpoint) {
        const ptr0 = passStringToWasm0(snapshot, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsernetworkclient_reconcileFailedUploadPayment(this.__wbg_ptr, ptr0, len0, verify_failure, on_checkpoint);
        return ret;
    }
    /**
     * Self-encrypt, quote, pay through a wallet callback, and store a public file.
     * @param {Uint8Array} content
     * @param {string} name
     * @param {string} content_type
     * @param {any} payment_network
     * @param {Function} pay_for_quotes
     * @param {Function | null} [on_progress]
     * @param {string | null} [checkpoint]
     * @param {Function | null} [on_checkpoint]
     * @param {string | null} [payment_mode]
     * @param {Function | null} [pay_for_merkle]
     * @returns {Promise<any>}
     */
    uploadPublicFile(content, name, content_type, payment_network, pay_for_quotes, on_progress, checkpoint, on_checkpoint, payment_mode, pay_for_merkle) {
        const ptr0 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(name, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(content_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        var ptr3 = isLikeNone(checkpoint) ? 0 : passStringToWasm0(checkpoint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len3 = WASM_VECTOR_LEN;
        var ptr4 = isLikeNone(payment_mode) ? 0 : passStringToWasm0(payment_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len4 = WASM_VECTOR_LEN;
        const ret = wasm.browsernetworkclient_uploadPublicFile(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, payment_network, pay_for_quotes, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress), ptr3, len3, isLikeNone(on_checkpoint) ? 0 : addToExternrefTable0(on_checkpoint), ptr4, len4, isLikeNone(pay_for_merkle) ? 0 : addToExternrefTable0(pay_for_merkle));
        return ret;
    }
    /**
     * Quote, pay for, and store one batch of caller-staged records.
     *
     * Callers that cannot hold a whole file's encrypted records at once stage
     * and upload consecutive batches. Each batch is its own payment and
     * checkpoint scope; the shared coordinator selects single-node or Merkle
     * payment for it exactly as for a complete file. Records are loaded
     * lazily and verified against their addresses on every load.
     * @param {any} batch
     * @param {any} payment_network
     * @param {Function} load_record
     * @param {Function} pay_for_quotes
     * @param {Function | null} [on_progress]
     * @param {string | null} [checkpoint]
     * @param {Function | null} [on_checkpoint]
     * @param {string | null} [payment_mode]
     * @param {Function | null} [pay_for_merkle]
     * @returns {Promise<any>}
     */
    uploadRecords(batch, payment_network, load_record, pay_for_quotes, on_progress, checkpoint, on_checkpoint, payment_mode, pay_for_merkle) {
        var ptr0 = isLikeNone(checkpoint) ? 0 : passStringToWasm0(checkpoint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(payment_mode) ? 0 : passStringToWasm0(payment_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.browsernetworkclient_uploadRecords(this.__wbg_ptr, batch, payment_network, load_record, pay_for_quotes, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress), ptr0, len0, isLikeNone(on_checkpoint) ? 0 : addToExternrefTable0(on_checkpoint), ptr1, len1, isLikeNone(pay_for_merkle) ? 0 : addToExternrefTable0(pay_for_merkle));
        return ret;
    }
    /**
     * Quote, pay for, and upload records produced by `BrowserFileEncryptor`.
     *
     * Record bytes are requested lazily from the asynchronous JavaScript
     * callback, allowing the page to keep them in IndexedDB rather than WASM.
     * @param {any} staged
     * @param {any} payment_network
     * @param {Function} load_record
     * @param {Function} pay_for_quotes
     * @param {Function | null} [on_progress]
     * @param {string | null} [checkpoint]
     * @param {Function | null} [on_checkpoint]
     * @param {string | null} [payment_mode]
     * @param {Function | null} [pay_for_merkle]
     * @returns {Promise<any>}
     */
    uploadStagedPublicFile(staged, payment_network, load_record, pay_for_quotes, on_progress, checkpoint, on_checkpoint, payment_mode, pay_for_merkle) {
        var ptr0 = isLikeNone(checkpoint) ? 0 : passStringToWasm0(checkpoint, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(payment_mode) ? 0 : passStringToWasm0(payment_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.browsernetworkclient_uploadStagedPublicFile(this.__wbg_ptr, staged, payment_network, load_record, pay_for_quotes, isLikeNone(on_progress) ? 0 : addToExternrefTable0(on_progress), ptr0, len0, isLikeNone(on_checkpoint) ? 0 : addToExternrefTable0(on_checkpoint), ptr1, len1, isLikeNone(pay_for_merkle) ? 0 : addToExternrefTable0(pay_for_merkle));
        return ret;
    }
}
if (Symbol.dispose) BrowserNetworkClient.prototype[Symbol.dispose] = BrowserNetworkClient.prototype.free;

/**
 * Native BLAKE3 content address.
 * @param {Uint8Array} content
 * @returns {string}
 */
export function contentAddress(content) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.contentAddress(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Decode a confirmed vault event using the native ABI and prepared request.
 * @param {any} request
 * @param {string} vault
 * @param {any} logs
 * @returns {any}
 */
export function decodeMerklePaymentReceipt(request, vault, logs) {
    const ptr0 = passStringToWasm0(vault, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodeMerklePaymentReceipt(request, ptr0, len0, logs);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Decode a native public DataMap for browser-side record retrieval.
 * @param {Uint8Array} content
 * @returns {any}
 */
export function decodePublicDataMap(content) {
    const ptr0 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decodePublicDataMap(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Native public DataMap decoding and whole-file reconstruction.
 * @param {Uint8Array} data_map_content
 * @param {Array<any>} encrypted_contents
 * @returns {Uint8Array}
 */
export function decryptPublicFile(data_map_content, encrypted_contents) {
    const ptr0 = passArray8ToWasm0(data_map_content, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.decryptPublicFile(ptr0, len0, encrypted_contents);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Native `self_encryption` plus public DataMap generation.
 * @param {Uint8Array} content
 * @returns {any}
 */
export function encryptPublicFile(content) {
    const ptr0 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.encryptPublicFile(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Read bundled mainnet WebRTC seeds and evmlib payment defaults without I/O.
 * @returns {any}
 */
export function mainnetNetworkDefaults() {
    const ret = wasm.mainnetNetworkDefaults();
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Validate and normalize browser bootstrap and public-file metadata.
 * @param {any} value
 * @returns {any}
 */
export function parseBrowserManifest(value) {
    const ret = wasm.parseBrowserManifest(value);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Decode and bound-check a complete WebRTC browser response frame.
 * @param {Uint8Array} frame
 * @returns {any}
 */
export function parseResponseFrame(frame) {
    const ptr0 = passArray8ToWasm0(frame, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.parseResponseFrame(ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Validate and normalize a WebRTC Direct multiaddress in shared Rust.
 * @param {any} endpoint
 * @returns {any}
 */
export function parseWebRtcDirectMultiaddr(endpoint) {
    const ret = wasm.parseWebRtcDirectMultiaddr(endpoint);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Compute the native EVM `PaymentQuote` hash.
 * @param {Uint8Array} signed_bytes
 * @param {Uint8Array} public_key
 * @param {Uint8Array} signature
 * @returns {string}
 */
export function paymentQuoteHash(signed_bytes, public_key, signature) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passArray8ToWasm0(signed_bytes, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(public_key, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArray8ToWasm0(signature, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.paymentQuoteHash(ptr0, len0, ptr1, len1, ptr2, len2);
        deferred4_0 = ret[0];
        deferred4_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Build the ICE-lite answer pinned by a WebRTC Direct endpoint.
 * @param {any} endpoint
 * @param {string} ice_credential
 * @returns {any}
 */
export function serverAnswerFromEndpoint(endpoint, ice_credential) {
    const ptr0 = passStringToWasm0(ice_credential, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.serverAnswerFromEndpoint(endpoint, ptr0, len0);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Install a readable panic hook for browser developer tools.
 */
export function start() {
    wasm.start();
}

/**
 * Verify one content-addressed record with native BLAKE3.
 * @param {string} address
 * @param {Uint8Array} content
 * @returns {string}
 */
export function verifyRecord(address, content) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(content, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.verifyRecord(ptr0, len0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Fully verify a storage quote before exposing it to a wallet signer.
 * @param {any} quote
 * @param {string} expected_address
 * @param {string} expected_peer_id
 * @returns {any}
 */
export function verifyStorageQuote(quote, expected_address, expected_peer_id) {
    const ptr0 = passStringToWasm0(expected_address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(expected_peer_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.verifyStorageQuote(quote, ptr0, len0, ptr1, len1);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * Derive the v2 server ufrag from an unchanged browser local description.
 * @param {string} local_sdp
 * @returns {string}
 */
export function webRtcDirectV2ServerCredential(local_sdp) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(local_sdp, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.webRtcDirectV2ServerCredential(ptr0, len0);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_ef53bc310eb298a0: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_6b506e6536831eaa: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_38130e98eecd467d: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_1a45e2c38d4d41b9: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_0accd80f45e5faa2: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_70a403a56e771704: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_6ffd6468a9bc44b9: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_754e9f305ff6029e: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_56732c2bc353f41d: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_c236cabd84a4d769: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_67b456be8673d3d7: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_1068e624fa87f6ab: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_2c56564c75129511: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_9bb1761122181af2: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_72bdf95d3ae505b1: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_61db23ac97f16c31: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_addEventListener_7c5a0db2b2826a06: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_browserfilereader_new: function(arg0) {
            const ret = BrowserFileReader.__wrap(arg0);
            return ret;
        },
        __wbg_bufferedAmount_f973d7c9cfe8766d: function(arg0) {
            const ret = arg0.bufferedAmount;
            return ret;
        },
        __wbg_call_40e4174f169eaca7: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_call_6e37a87ff352da3d: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = arg0.call(arg1, arg2, arg3, arg4);
            return ret;
        }, arguments); },
        __wbg_call_7d39dd526ab44e10: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            const ret = arg0.call(arg1, arg2, arg3, arg4, arg5);
            return ret;
        }, arguments); },
        __wbg_call_8a89609d89f6608a: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_call_9c758de292015997: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_clearTimeout_113b1cde814ec762: function(arg0) {
            const ret = clearTimeout(arg0);
            return ret;
        },
        __wbg_close_46a302f048f55362: function(arg0) {
            arg0.close();
        },
        __wbg_close_49c1a4313997f616: function(arg0) {
            arg0.close();
        },
        __wbg_createDataChannel_91bd40e53ea00623: function(arg0, arg1, arg2, arg3) {
            const ret = arg0.createDataChannel(getStringFromWasm0(arg1, arg2), arg3);
            return ret;
        },
        __wbg_createOffer_308df5ff89c1d329: function(arg0) {
            const ret = arg0.createOffer();
            return ret;
        },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_data_bd354b70c783c66e: function(arg0) {
            const ret = arg0.data;
            return ret;
        },
        __wbg_done_60cf307fcc680536: function(arg0) {
            const ret = arg0.done;
            return ret;
        },
        __wbg_entries_04b37a02507f1713: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_from_d300fe49deab18f5: function(arg0) {
            const ret = Array.from(arg0);
            return ret;
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_get_1f8f054ddbaa7db2: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_2b48c7d0d006a781: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_de6a0f7d4d18a304: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_index_ab123d64c89e3156: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_unchecked_33f6e5c9e2f2d6b2: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_8f49811467741499: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Map_9fc06d9a951bcee6: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Map;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_86f30649f63ef9c2: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_67c2c9c4313f4448: function(arg0) {
            const ret = Array.isArray(arg0);
            return ret;
        },
        __wbg_isSafeInteger_66acec27e09e99a7: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_iterator_8732428d309e270e: function() {
            const ret = Symbol.iterator;
            return ret;
        },
        __wbg_length_4a591ecaa01354d9: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_66f1a4b2e9026940: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_localDescription_9af71b38aea553d6: function(arg0) {
            const ret = arg0.localDescription;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_578aeef4b6b94378: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_622fc80556be2e26: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_ce1ab61c1c2b300d: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_d90091b82fdf5b91: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_from_slice_18fa1f71286d66b8: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_bf31d18f92484486: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen__convert__closures_____invoke__h1a72669c4838b5a0(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_configuration_c5455bb5a1ffffaf: function() { return handleError(function (arg0) {
            const ret = new RTCPeerConnection(arg0);
            return ret;
        }, arguments); },
        __wbg_new_with_length_36a4998e27b014c5: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_next_9e03acdf51c4960d: function(arg0) {
            const ret = arg0.next;
            return ret;
        },
        __wbg_next_eb8ca7351fa27906: function() { return handleError(function (arg0) {
            const ret = arg0.next();
            return ret;
        }, arguments); },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_now_190933fa139cc119: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_3249fc62a0fafa30: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_queueMicrotask_35c611f4a14830b2: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_queueMicrotask_404ed0a58e0b63cc: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_readyState_561567918a6f08cd: function(arg0) {
            const ret = arg0.readyState;
            return (__wbindgen_enum_RtcDataChannelState.indexOf(ret) + 1 || 5) - 1;
        },
        __wbg_removeEventListener_5f35962e6c0b2ddc: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.removeEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_resolve_25a7e548d5881dca: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_sdp_9d1eefecb97d7fe0: function(arg0, arg1) {
            const ret = arg1.sdp;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_send_251327178fa2f848: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.send(getArrayU8FromWasm0(arg1, arg2));
        }, arguments); },
        __wbg_setLocalDescription_f1d8d5fcd90cb6d8: function(arg0, arg1) {
            const ret = arg0.setLocalDescription(arg1);
            return ret;
        },
        __wbg_setRemoteDescription_bb75c6d991a6f3e3: function(arg0, arg1) {
            const ret = arg0.setRemoteDescription(arg1);
            return ret;
        },
        __wbg_setTimeout_ef24d2fc3ad97385: function() { return handleError(function (arg0, arg1) {
            const ret = setTimeout(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_set_52b1e1eb5bed906a: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_binaryType_42788161dca49131: function(arg0, arg1) {
            arg0.binaryType = __wbindgen_enum_RtcDataChannelType[arg1];
        },
        __wbg_set_bufferedAmountLowThreshold_3d59ebc5cb312b1a: function(arg0, arg1) {
            arg0.bufferedAmountLowThreshold = arg1 >>> 0;
        },
        __wbg_set_dca99999bba88a9a: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_ice_servers_8d28db48d5fac06b: function(arg0, arg1) {
            arg0.iceServers = arg1;
        },
        __wbg_set_onbufferedamountlow_2320b07bca6d3eb9: function(arg0, arg1) {
            arg0.onbufferedamountlow = arg1;
        },
        __wbg_set_onclose_8ae6981a135b2358: function(arg0, arg1) {
            arg0.onclose = arg1;
        },
        __wbg_set_onerror_b5251a1533fd1057: function(arg0, arg1) {
            arg0.onerror = arg1;
        },
        __wbg_set_onmessage_037145d00ca09471: function(arg0, arg1) {
            arg0.onmessage = arg1;
        },
        __wbg_set_onopen_86348bf9ecce6b54: function(arg0, arg1) {
            arg0.onopen = arg1;
        },
        __wbg_set_ordered_71f6573f0cd09889: function(arg0, arg1) {
            arg0.ordered = arg1 !== 0;
        },
        __wbg_set_sdp_e84e01261ff10019: function(arg0, arg1, arg2) {
            arg0.sdp = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_type_ea82b7fc95b450a7: function(arg0, arg1) {
            arg0.type = __wbindgen_enum_RtcSdpType[arg1];
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_9d53f2689e622ca1: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_a1a35cec07001a8a: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_4c59f6c7ea29a144: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_e70ae9f2eb052253: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_4aa221f6a4f5ab22: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_then_18f476d590e58992: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_ac7b025999b52837: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_value_f3625092ee4b37f4: function(arg0) {
            const ret = arg0.value;
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 1003, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h6c639ae6ac52cf17);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 421, ret: NamedExternref("Promise<any>"), inner_ret: Some(NamedExternref("Promise<any>")) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h0adb10753c7fca5a);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("Event")], shim_idx: 423, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("MessageEvent")], shim_idx: 423, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1_3);
            return ret;
        },
        __wbindgen_cast_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [], shim_idx: 719, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen__convert__closures_____invoke__hc4b509476b4504c4);
            return ret;
        },
        __wbindgen_cast_0000000000000006: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000007: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000008: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000009: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_000000000000000a: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./ant_core_bg.js": import0,
    };
}

function wasm_bindgen__convert__closures_____invoke__hc4b509476b4504c4(arg0, arg1) {
    wasm.wasm_bindgen__convert__closures_____invoke__hc4b509476b4504c4(arg0, arg1);
}

function wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1_3(arg0, arg1, arg2) {
    wasm.wasm_bindgen__convert__closures_____invoke__h5206e33babbdebc1_3(arg0, arg1, arg2);
}

function wasm_bindgen__convert__closures_____invoke__h0adb10753c7fca5a(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__h0adb10753c7fca5a(arg0, arg1, arg2);
    return ret;
}

function wasm_bindgen__convert__closures_____invoke__h6c639ae6ac52cf17(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen__convert__closures_____invoke__h6c639ae6ac52cf17(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen__convert__closures_____invoke__h1a72669c4838b5a0(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen__convert__closures_____invoke__h1a72669c4838b5a0(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_RtcDataChannelState = ["connecting", "open", "closing", "closed"];


const __wbindgen_enum_RtcDataChannelType = ["arraybuffer", "blob"];


const __wbindgen_enum_RtcSdpType = ["offer", "pranswer", "answer", "rollback"];
const BrowserFileEncryptorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browserfileencryptor_free(ptr, 1));
const BrowserFileReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browserfilereader_free(ptr, 1));
const BrowserIterativeLookupFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browseriterativelookup_free(ptr, 1));
const BrowserNetworkClientFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browsernetworkclient_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('ant_core_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
