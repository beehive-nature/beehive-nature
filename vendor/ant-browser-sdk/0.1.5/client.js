import { writePointer, resumePointer } from "./pointers.js";
import { getNetworkDefaults, snapshotNetworkProfile } from "./network-profile.js";
import { saveUploadCheckpoint } from "./internal/record-store.js";
import { assertFileSize, SDK_LIMITS } from "./limits.js";
import { coreFileReference, corePrivateFile, helloFromCore, isPrivateFile, lookupFromCore, nodeFromCore, privateFileFromCore, publicFileFromCore, } from "./internal/protocol.js";
import { AutonomiError, UploadError, wrapError } from "./errors.js";
import { createPublicFileReader } from "./file-reader.js";
import { abortable, isAbort, settledWithin, throwIfAborted } from "./internal/abort.js";
import { getBindings, initializeClientWasm } from "./internal/runtime.js";
import { isPlayableMedia, MediaBridge, primePlayback } from "./internal/media.js";
import { assertStagingSupported } from "./internal/staging.js";
import { restoreCheckpoint, uploadBytes, uploadFileInWindows, } from "./internal/upload-sources.js";
import { unwrapWindowCheckpoint, wrapWindowCheckpoint } from "./internal/window-checkpoint.js";
import { operationId, progressReporter } from "./internal/progress.js";
import { awaitUploadSettlement, claimUpload, paidReceipt, releaseUpload, retainUpload, uploadResult, uploadSettlement, recordPayment, reconcilePayments, trackPayment, } from "./internal/upload-recovery.js";
import { snapshot } from "./internal/snapshot.js";
import { corePaymentNetwork, paymentNetworkFromCore, assertPaymentChainId, } from "./internal/payment-network.js";
import { requestSaveFileHandle, saveDownload } from "./save.js";
import { checkSha256, fileName, isManifestEntry, manifestEntrySource, recordedSha256 } from "./manifest.js";
/** Saved-file name when neither the caller nor the source names one. */
const DEFAULT_SAVE_NAME = "autonomi-file";
/** As Rust's page-callback timeout: the longest a wallet waits for its broadcast to be journaled. */
const SUBMISSION_JOURNAL_TIMEOUT_MS = 30_000;
/** High-level, stateful browser client for direct Autonomi applications. */
export class AutonomiClient {
    #connection;
    #files = [];
    #pendingUploads = new Set();
    #network;
    #payment;
    #listeners = new Set();
    #operations = new Set();
    #closed = false;
    /** Raw calls borrowing the WASM handle; it is freed only once none remain. */
    #networkLeases = 0;
    /** Writes whose payment may be submitted; the transport stays open for them. */
    #transportHolds = 0;
    #transportClosed = false;
    #networkFreed = false;
    #media;
    #workerWasm;
    constructor(network, connection, options, workerWasm) {
        this.#network = network;
        const { files, ...metadata } = connection;
        this.#connection = snapshot(metadata);
        this.#files = files.map((file) => snapshot(file));
        this.#payment = options.payment;
        this.#workerWasm = workerWasm;
        if (options.onProgress)
            this.#listeners.add(options.onProgress);
    }
    /** Connect using application-bundled seeds and payment identity, with seed failover. */
    static async connectNetwork(profile, options = {}) {
        throwIfAborted(options.signal);
        const trusted = snapshotNetworkProfile(profile);
        return this.#connectSeeds(trusted.seeds, { ...options, expectedPaymentNetwork: trusted.payment });
    }
    static async connect(bootstrapMultiaddr = {}, options = {}) {
        if (typeof bootstrapMultiaddr !== "string") {
            const { network = "mainnet", ...settings } = bootstrapMultiaddr;
            if (typeof network === "string" && network !== "mainnet") {
                throw new AutonomiError("INVALID_SOURCE", `Unknown network: ${network}`);
            }
            // Snapshot custom trust settings before the first asynchronous operation.
            const profile = network === "mainnet"
                ? await getNetworkDefaults(settings) : snapshotNetworkProfile(network);
            return this.connectNetwork(profile, settings);
        }
        return this.#connectSeeds([bootstrapMultiaddr], options);
    }
    static async #connectSeeds(seeds, options) {
        const report = progressReporter("connect", operationId(), "initializing", (event) => {
            if (options.onProgress)
                safelyNotify(options.onProgress, event);
        }, options.signal, options.parentOperationId);
        let network;
        let connecting;
        try {
            throwIfAborted(options.signal);
            // Copy policy before asynchronous setup or application callbacks can mutate it.
            const expected = options.expectedPaymentNetwork === undefined
                ? undefined : normalizeExpectedNetwork(options.expectedPaymentNetwork);
            report("Initializing the Autonomi browser core");
            const workerWasm = await abortable(initializeClientWasm(options.wasm), options.signal);
            const { BrowserNetworkClient } = getBindings();
            // Validate the complete selected profile before any seed is dialed.
            const endpoints = seeds.map(parseBootstrapMultiaddr);
            network = new BrowserNetworkClient(endpoints);
            report(`Authenticating ${endpoints.length} bootstrap node${endpoints.length === 1 ? "" : "s"}`, { phase: "connecting" });
            connecting = network.connect(expected === undefined ? undefined : corePaymentNetwork(expected));
            const hello = await abortable(connecting, options.signal);
            const endpoint = parseBootstrapMultiaddr(hello.endpoint.multiaddr);
            if (!endpoints.some(candidate => candidate.multiaddr === endpoint.multiaddr)) {
                throw new AutonomiError("CONNECTION_FAILED", "Authenticated bootstrap is outside the selected seed profile");
            }
            if (!hello.capabilities.includes("chunk_protocol")) {
                throw new AutonomiError("CONNECTION_FAILED", "Bootstrap node does not support the shared storage protocol; upgrade ant-node to a version advertising chunk_protocol");
            }
            const identity = normalizePaymentNetwork(hello.payment);
            const paymentNetwork = {
                chainId: identity.chain_id,
                paymentTokenAddress: identity.payment_token_address,
                paymentVaultAddress: identity.payment_vault_address,
            };
            if (expected && (expected.chainId !== paymentNetwork.chainId ||
                expected.paymentTokenAddress !== paymentNetwork.paymentTokenAddress ||
                expected.paymentVaultAddress !== paymentNetwork.paymentVaultAddress)) {
                throw new AutonomiError("NETWORK_MISMATCH", "Authenticated payment network does not match expectedPaymentNetwork");
            }
            throwIfAborted(options.signal);
            const connection = {
                bootstrapMultiaddr: endpoint.multiaddr,
                paymentNetwork,
                bootstrap: helloFromCore(hello, paymentNetwork),
                files: [],
            };
            report(`Connected to authenticated peer ${hello.peer_id}`, { phase: "complete" });
            throwIfAborted(options.signal);
            const client = new AutonomiClient(network, connection, options, workerWasm);
            report.finish();
            return client;
        }
        catch (error) {
            if (network) {
                const failed = network;
                // Close immediately to wake bootstrap waiters, but release the WASM
                // handle only after its borrowed async call has settled.
                failed.close();
                if (connecting)
                    void connecting.then(() => closeNetwork(failed), () => closeNetwork(failed));
                else
                    closeNetwork(failed);
            }
            const failure = isAbort(error, options.signal) ? error
                : String(error).includes("NETWORK_MISMATCH:")
                    ? new AutonomiError("NETWORK_MISMATCH", "Authenticated payment network does not match expectedPaymentNetwork", error)
                    : wrapError("CONNECTION_FAILED", "Could not connect to Autonomi", error);
            report.finish({ status: isAbort(failure, options.signal) ? "cancelled" : "failed", error: failure });
            throw failure;
        }
    }
    /** A frozen snapshot; later operations produce new snapshots. */
    get connection() {
        return Object.freeze({ ...this.#connection, files: this.files });
    }
    get closed() {
        return this.#closed;
    }
    get files() {
        return Object.freeze([...this.#files]);
    }
    /** Failed/cancelled uploads whose retained input still needs resume or discard. */
    get pendingUploads() {
        for (const recovery of this.#pendingUploads) {
            if (recovery.status === "completed" || recovery.status === "discarded")
                this.#pendingUploads.delete(recovery);
        }
        return Object.freeze([...this.#pendingUploads]);
    }
    /** Install or replace the wallet/payment adapter used by future uploads. */
    setPaymentProvider(payment) {
        this.#payment = payment;
    }
    /** Subscribe to progress from all subsequent operations. */
    onProgress(listener) {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }
    /** Find the closest known storage nodes to a 32-byte hex address. */
    async findClosest(target = randomHex(32), options = {}) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("lookup", options.onProgress, operation);
        try {
            this.#assertOpen();
            report(`Finding nodes closest to ${target}`);
            const result = (await abortable(this.#withNetwork((network) => network.findClosest(target, report)), operation.signal));
            report("Closest-node lookup complete", { phase: "complete" });
            return lookupFromCore(result);
        }
        catch (error) {
            const failure = isAbort(error, operation.signal) ? error : wrapError("LOOKUP_FAILED", "Closest-node lookup failed", error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    async upload(input, options = {}) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("upload", options.onProgress, operation);
        try {
            this.#assertOpen();
            const payment = options.payment ?? this.#payment;
            if (!payment && !options.checkpoint) {
                throw new AutonomiError("PAYMENT_REQUIRED", "Uploading requires a PaymentProvider; pass one to connect() or upload()");
            }
            throwIfAborted(operation.signal);
            const visibility = options.visibility ?? "public";
            if (visibility !== "public" && visibility !== "private") {
                throw new AutonomiError("INVALID_SOURCE", 'Upload visibility must be "public" or "private"');
            }
            let retained;
            if (input instanceof Uint8Array) {
                assertFileSize(input.byteLength);
                const name = options.name ?? `${visibility}-file.bin`;
                report(`Preparing ${name}`);
                retained = retainUpload(this.#connection.paymentNetwork, {
                    bytes: input.slice(), name, contentType: options.contentType ?? "application/octet-stream", visibility,
                }, operation.id);
            }
            else if (typeof Blob === "function" && input instanceof Blob) {
                assertFileSize(input.size);
                assertStagingSupported();
                const isFile = typeof File === "function" && input instanceof File;
                const name = options.name ?? (isFile ? input.name : `${visibility}-file.bin`);
                report(`Preparing ${name}`);
                retained = retainUpload(this.#connection.paymentNetwork, {
                    blob: input, name, contentType: options.contentType || input.type || "application/octet-stream", visibility,
                }, operation.id);
            }
            else {
                throw new TypeError("upload input must be a File, Blob, or Uint8Array");
            }
            if (options.paymentMode !== undefined)
                retained.paymentMode = options.paymentMode;
            if (options.checkpoint !== undefined)
                restoreCheckpoint(retained, options.checkpoint);
            if (options.onCheckpoint !== undefined)
                retained.onCheckpoint = options.onCheckpoint;
            return await this.#runUpload(retained, payment, false, options.retainOnFailure !== false, operation, report, options.onPaymentSubmitted);
        }
        catch (error) {
            const failure = isAbort(error, operation.signal) ? error : wrapError("UPLOAD_FAILED", "File upload failed", error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    /**
     * Resolve a definitively failed payment using the native journal validator.
     * Wait for the original upload and wallet work to settle before calling this.
     * Resume with upload(input, { checkpoint: returnedCheckpoint, ... }); this does
     * not mutate an existing in-memory recovery handle or submit another payment.
     */
    async reconcileFailedUploadPayment(checkpoint, options) {
        this.#assertOpen();
        if (typeof options?.verifyFailure !== "function" || typeof options.onCheckpoint !== "function") {
            throw new TypeError("Failed payment reconciliation requires verification and durable checkpoint callbacks");
        }
        try {
            // A windowed checkpoint keeps naming its window after reconciliation.
            const windowed = unwrapWindowCheckpoint(checkpoint);
            const envelope = (value) => windowed ? wrapWindowCheckpoint(value, windowed.window) : value;
            return envelope(await this.#withNetwork((network) => network.reconcileFailedUploadPayment(windowed?.checkpoint ?? checkpoint, (attempt, scope) => options.verifyFailure(attempt, scope), value => options.onCheckpoint(envelope(value)))));
        }
        catch (error) {
            throw wrapError("PAYMENT_FAILED", "Could not reconcile failed storage payment", error);
        }
    }
    /**
     * Retry retained input. New payments require an explicit provider on this call.
     * The result's file is a `PrivateFile` when `recovery.visibility` is `private`.
     */
    async resumeUpload(recovery, options = {}) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("upload", options.onProgress, operation);
        try {
            this.#assertOpen();
            const settled = uploadSettlement(recovery);
            operation.recovery = recovery;
            await abortable(settled, operation.signal);
            throwIfAborted(operation.signal);
            const state = claimUpload(recovery, this.#connection.paymentNetwork);
            if (options.onCheckpoint)
                state.onCheckpoint = options.onCheckpoint;
            return await this.#runUpload(state, options.payment, true, true, operation, report, options.onPaymentSubmitted);
        }
        catch (error) {
            operation.fail(error);
            throw error;
        }
        finally {
            operation.finish();
        }
    }
    async #runUpload(state, payment, resuming, retainOnFailure, operation, report, onPaymentSubmitted) {
        operation.recovery = state.handle;
        let paymentFailure;
        const payForQuotes = async (networkValue, quoteValue, persistValue) => {
            const persistSubmission = typeof persistValue === "function" ? persistValue : undefined;
            try {
                throwIfAborted(operation.signal);
                const network = paymentNetworkFromCore(networkValue, state.network);
                const quotes = snapshot(quoteValue);
                const previous = resuming ? paidReceipt(state, network, quotes) : undefined;
                if (previous) {
                    report("Reusing a confirmed storage payment", { phase: "uploading" });
                    return previous;
                }
                if (!payment) {
                    throw new AutonomiError("RECOVERY_PAYMENT_REQUIRED", "Fresh quotes are not covered by a retained receipt; pass payment to resumeUpload() to authorize another payment");
                }
                report("Waiting for storage payment", { phase: "payment", total: quotes.length, unit: "quotes" });
                throwIfAborted(operation.signal);
                // Observe the actual provider promise, even after the upload stops waiting.
                const submitted = [];
                const journalWrites = [];
                const pending = Promise.resolve(payment.pay(network, quotes, {
                    report, signal: operation.signal,
                    submitted: (submission) => {
                        // Journal broadcast evidence before validating provider metadata.
                        let write;
                        if (persistSubmission) {
                            write = persistSubmission({ transactionHash: submission.transactionHash,
                                totalAmount: submission.totalAmount, walletAddress: submission.walletAddress });
                            void write.catch(() => undefined);
                            journalWrites.push(write);
                        }
                        const tracked = trackPayment(state, network, quotes, submission);
                        submitted.push(tracked);
                        try {
                            onPaymentSubmitted?.(tracked.handle);
                        }
                        catch { /* Receipt observation must survive UI failures. */ }
                        // The wallet waits, bounded, until the broadcast is journaled; a failed write never fails it.
                        return write && settledWithin(write, SUBMISSION_JOURNAL_TIMEOUT_MS);
                    },
                })).then(async (receipt) => {
                    // A malformed receipt may still identify a transaction that spent funds.
                    if (persistSubmission)
                        await persistSubmission(receipt);
                    await Promise.all(journalWrites);
                    const recorded = recordPayment(state, network, quotes, receipt);
                    for (const tracked of submitted)
                        tracked.confirm(receipt);
                    return recorded.receipt;
                });
                state.paymentTasks.push(pending);
                const receipt = await abortable(pending, operation.signal);
                report("Storage payment confirmed", { phase: "uploading" });
                return receipt;
            }
            catch (error) {
                paymentFailure = isAbort(error, operation.signal)
                    ? error : wrapError("PAYMENT_FAILED", "Storage payment failed", error);
                throw paymentFailure;
            }
        };
        const payForMerkle = async (networkValue, requestValue, persistValue) => {
            const persistSubmission = typeof persistValue === "function" ? persistValue : undefined;
            try {
                throwIfAborted(operation.signal);
                const network = paymentNetworkFromCore(networkValue, state.network);
                const request = snapshot(requestValue);
                const previous = state.payments.find((paid) => paid.merkle?.calldata === request.calldata);
                if (previous) {
                    report("Reusing a confirmed Merkle storage payment", { phase: "uploading" });
                    return previous.receipt;
                }
                if (!payment?.payMerkle)
                    throw new AutonomiError("PAYMENT_FAILED", "PaymentProvider must implement payMerkle for this upload, or select paymentMode: single");
                const submitted = [];
                const journalWrites = [];
                report("Waiting for Merkle storage payment", { phase: "payment" });
                const pending = Promise.resolve(payment.payMerkle(network, request, {
                    report, signal: operation.signal,
                    decodeReceipt: (logs) => {
                        const decode = getBindings().decodeMerklePaymentReceipt;
                        if (!decode)
                            throw new Error("WASM does not support Merkle receipt decoding");
                        return decode(request, network.paymentVaultAddress, logs);
                    },
                    submitted: (submission) => {
                        // Journal broadcast evidence before validating provider metadata.
                        let write;
                        if (persistSubmission) {
                            write = persistSubmission({ transactionHash: submission.transactionHash,
                                totalAmount: submission.totalAmount, walletAddress: submission.walletAddress });
                            void write.catch(() => undefined);
                            journalWrites.push(write);
                        }
                        const tracked = trackPayment(state, network, [], submission, request);
                        submitted.push(tracked);
                        try {
                            onPaymentSubmitted?.(tracked.handle);
                        }
                        catch { /* Preserve settlement observation. */ }
                        return write && settledWithin(write, SUBMISSION_JOURNAL_TIMEOUT_MS);
                    },
                })).then(async (receipt) => {
                    // A malformed receipt may still identify a transaction that spent funds.
                    if (persistSubmission)
                        await persistSubmission(receipt);
                    await Promise.all(journalWrites);
                    const recorded = recordPayment(state, network, [], receipt, request);
                    for (const tracked of submitted)
                        tracked.confirm(receipt);
                    return recorded.receipt;
                });
                state.paymentTasks.push(pending);
                const receipt = await abortable(pending, operation.signal);
                report("Merkle storage payment confirmed", { phase: "uploading" });
                return receipt;
            }
            catch (error) {
                paymentFailure = isAbort(error, operation.signal) ? error : wrapError("PAYMENT_FAILED", "Merkle payment failed", error);
                throw paymentFailure;
            }
        };
        // Recovery callbacks observe retained/chain receipts; they never call pay().
        payForQuotes.recover = async (networkValue, quoteValue, _persist, attempt) => {
            const network = paymentNetworkFromCore(networkValue, state.network);
            const quotes = snapshot(quoteValue);
            await reconcilePayments(state, operation.signal);
            const previous = paidReceipt(state, network, quotes);
            if (previous)
                return previous;
            if (payment?.recover) {
                const receipt = await payment.recover(network, quotes, attempt, { report, signal: operation.signal });
                return recordPayment(state, network, quotes, receipt).receipt;
            }
            throw new AutonomiError("PAYMENT_FAILED", "Payment outcome unknown; reconcile the original payment before retrying");
        };
        payForMerkle.recover = async (networkValue, requestValue, _persist, attempt) => {
            const network = paymentNetworkFromCore(networkValue, state.network);
            const request = snapshot(requestValue);
            await reconcilePayments(state, operation.signal);
            const previous = state.payments.find(paid => paid.merkle?.calldata === request.calldata);
            if (previous)
                return previous.receipt;
            if (payment?.recoverMerkle) {
                const receipt = await payment.recoverMerkle(network, request, attempt, { report, signal: operation.signal });
                return recordPayment(state, network, [], receipt, request).receipt;
            }
            throw new AutonomiError("PAYMENT_FAILED", "Merkle payment outcome unknown; reconcile the original payment before retrying");
        };
        try {
            throwIfAborted(operation.signal);
            if (resuming)
                await reconcilePayments(state, operation.signal);
            if (!state.result) {
                report(`Preparing storage for ${state.name}`, { phase: "preparing" });
                const uploadBatch = async (batch, load, window) => {
                    const checkpoint = async (value) => {
                        state.coreCheckpoint = value;
                        const persisted = window ? wrapWindowCheckpoint(value, window) : value;
                        if (state.onCheckpoint)
                            await state.onCheckpoint(persisted);
                        else {
                            await saveUploadCheckpoint(state.handle.id, persisted);
                            state.checkpointStoredLocally = true;
                        }
                    };
                    return await this.#withNetwork((network) => network.uploadRecords(batch, corePaymentNetwork(state.network), load, payForQuotes, report, state.coreCheckpoint, checkpoint, state.paymentMode ?? "auto", payForMerkle));
                };
                const uploading = state.cursor
                    ? uploadFileInWindows(state, uploadBatch, { report, signal: operation.signal, wasm: this.#workerWasm })
                    : uploadBytes(state, uploadBatch, report);
                state.work = uploading.then((uploaded) => {
                    state.result = uploadResult(state, uploaded);
                    return state.result;
                });
                await abortable(state.work, operation.signal);
            }
            throwIfAborted(operation.signal);
            const result = state.result;
            if ("address" in result.file)
                this.#rememberFile(result.file);
            report(`Uploaded ${result.file.name}`, {
                phase: "complete", completed: result.file.size, total: result.file.size, unit: "bytes",
            });
            try {
                await releaseUpload(state, "completed");
                this.#pendingUploads.delete(state.handle);
            }
            catch {
                // The upload is complete. Retain cleanup ownership without paying again.
                awaitUploadSettlement(state);
                this.#pendingUploads.add(state.handle);
            }
            return result;
        }
        catch (error) {
            awaitUploadSettlement(state);
            this.#pendingUploads.add(state.handle);
            if (!retainOnFailure)
                void state.handle.discard().catch(() => undefined);
            if (isAbort(error, operation.signal))
                throw error;
            const failure = wrapError("UPLOAD_FAILED", "File upload failed", paymentFailure ?? error);
            throw new UploadError(failure, state.handle);
        }
    }
    async download(source, options = {}) {
        // A manifest entry reads as its embedded DataMap or its public address.
        const file = isManifestEntry(source) ? manifestEntrySource(source) : source;
        const sha256 = isManifestEntry(source) ? recordedSha256(source) : undefined;
        const operation = this.#startOperation(options);
        const report = this.#reporter("download", options.onProgress, operation);
        try {
            this.#assertOpen();
            const limits = SDK_LIMITS.downloadConcurrency;
            const concurrency = options.concurrency ?? limits.default;
            if (concurrency !== "auto" && (!Number.isInteger(concurrency) || concurrency < limits.min || concurrency > limits.max)) {
                throw new AutonomiError("DOWNLOAD_FAILED", `Download concurrency must be "auto" or an integer from ${limits.min} through ${limits.max}`);
            }
            throwIfAborted(operation.signal);
            const cap = concurrency === "auto" ? undefined : concurrency;
            // Buffered results hold the whole file; the default keeps an unbounded file from exhausting the tab.
            const maxMemoryBytes = options.maxMemoryBytes ?? SDK_LIMITS.defaultDownloadMemoryBytes;
            if (!Number.isSafeInteger(maxMemoryBytes) || maxMemoryBytes < 0) {
                throw new AutonomiError("DOWNLOAD_FAILED", "maxMemoryBytes must be a non-negative safe integer");
            }
            const downloadOptions = { maxMemoryBytes, signal: operation.signal };
            const raw = (await abortable(this.#withNetwork((network) => isPrivateFile(file)
                ? network.downloadPrivateFile(corePrivateFile(file), cap, report, downloadOptions)
                : network.downloadPublicFile(typeof file === "string" ? file : coreFileReference(file), cap, report, downloadOptions)), operation.signal));
            throwIfAborted(operation.signal);
            // The core returns a JS-owned buffer. Blob takes its own snapshot; avoid
            // another file-sized intermediate copy. Copy only shared-buffer inputs.
            const blobBytes = raw.content.buffer instanceof ArrayBuffer
                ? new Uint8Array(raw.content.buffer, raw.content.byteOffset, raw.content.byteLength)
                : new Uint8Array(raw.content);
            // Before the Blob snapshot exists, so WebCrypto's copy does not raise the peak.
            if (sha256 !== undefined)
                await abortable(checkSha256(blobBytes, sha256, raw.file.name), operation.signal);
            report(`Downloaded ${raw.file.name}`, { phase: "complete", completed: raw.content.byteLength, total: raw.content.byteLength, unit: "bytes" });
            const downloaded = {
                bytes: raw.content,
                blob: new Blob([blobBytes], {
                    type: raw.file.content_type || "application/octet-stream",
                }),
                hash: raw.hash,
            };
            // Private files stay out of client.files, which lists public metadata only.
            if (isPrivateFile(file))
                return { ...downloaded, file: privateFileFromCore(raw.file, file.dataMap) };
            const publicFile = publicFileFromCore(raw.file);
            this.#rememberFile(publicFile);
            if (!raw.dataMapNode)
                throw new Error("The core did not report the node serving the public DataMap");
            return { ...downloaded, file: publicFile, dataMapNode: nodeFromCore(raw.dataMapNode) };
        }
        catch (error) {
            const failure = isAbort(error, operation.signal) ? error : wrapError("DOWNLOAD_FAILED", `${visibilityLabel(file)} file download failed`, error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    async downloadAndSave(source, options = {}) {
        const file = isManifestEntry(source) ? manifestEntrySource(source) : source;
        const operation = this.#startOperation(options);
        const report = this.#reporter("download-and-save", options.onProgress, operation);
        try {
            this.#assertOpen();
            report("Choosing a download destination", { phase: "saving" });
            const suggestedName = options.suggestedName ?? this.#knownFile(file)?.name;
            const picked = (options.fileHandle || options.useFilePicker === false)
                ? undefined
                : await requestSaveFileHandle(suggestedName, operation.signal);
            const fileHandle = options.fileHandle ?? picked;
            // The entry itself, so its sha256 is checked before anything is saved.
            const download = await this.download(source, {
                ...options,
                parentOperationId: operation.id,
                signal: operation.signal,
            });
            report(`Saving ${download.file.name}`, { phase: "saving" });
            const save = await saveDownload(download, {
                ...options,
                ...(fileHandle ? { fileHandle } : { useFilePicker: false }),
                parentOperationId: operation.id,
                onProgress: (event) => this.#notify(options.onProgress, event),
                signal: operation.signal,
            });
            report(`Saved ${download.file.name}`, { phase: "complete" });
            return { download, save };
        }
        catch (error) {
            operation.fail(error);
            throw error;
        }
        finally {
            operation.finish();
        }
    }
    /** Stream a complete verified file to disk or a supplied stream, with bounded memory. */
    async streamAndSave(source, options = {}) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("stream-and-save", options.onProgress, operation);
        let reader;
        let destination;
        try {
            this.#assertOpen();
            throwIfAborted(operation.signal);
            if (options.destination && options.fileHandle)
                throw new AutonomiError("INVALID_SOURCE", "Supply either destination or fileHandle");
            if (options.destination?.locked)
                throw new AutonomiError("INVALID_SOURCE", "The destination stream is locked");
            // A manifest entry reads as its embedded DataMap or public address and saves under its own name.
            const file = isManifestEntry(source) ? manifestEntrySource(source) : source;
            const name = options.suggestedName || (isManifestEntry(source) ? fileName(source) : this.#knownFile(file)?.name) || DEFAULT_SAVE_NAME;
            report("Choosing a streaming destination", { phase: "saving" });
            let picked;
            // Invoke the picker before any network await, while user activation is available.
            if (!options.destination && !options.fileHandle) {
                picked = await requestSaveFileHandle(name, operation.signal);
                if (!picked) {
                    throw new AutonomiError("SAVE_FAILED", "Streaming saves require a destination WritableStream, a fileHandle, or a browser save picker opened from a user action");
                }
            }
            const handle = options.fileHandle ?? picked;
            destination = options.destination;
            reader = await this.#openReader(file, {
                signal: operation.signal, parentOperationId: operation.id, ...(options.onProgress ? { onProgress: options.onProgress } : {}),
            }, false);
            if (handle)
                destination = await abortable(handle.createWritable(), operation.signal, undefined, (late) => { void late.abort(operation.signal.reason).catch(() => undefined); });
            throwIfAborted(operation.signal);
            const result = await reader.pipeTo(destination, {
                signal: operation.signal,
                onProgress: (completed, total) => {
                    report(`Saved ${completed} of ${total} bytes`, { phase: "saving", completed, total, unit: "bytes" });
                },
            });
            const savedName = handle?.name || name;
            report(`Saved ${savedName}`, { phase: "complete" });
            return { ...result, name: savedName, method: handle ? "file-picker" : "stream" };
        }
        catch (error) {
            // pipeTo owns its writer during transfer. Abort an acquired but not yet handed-off stream too.
            if (destination && !destination.locked)
                void destination.abort(error).catch(() => undefined);
            const failure = isAbort(error, operation.signal) ? error : wrapError("SAVE_FAILED", "Could not stream and save the file", error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            reader?.close();
            operation.finish();
        }
    }
    getPointer(address, options = {}) {
        return this.#pointerOperation(options, (network) => network.getPointer(address), true);
    }
    resolvePointer(address, options = {}) {
        return this.#pointerOperation(options, (network) => network.resolvePointer(address), true);
    }
    pointerFinality(address, options = {}) {
        return this.#pointerOperation(options, (network) => network.pointerFinality(address), true);
    }
    createPointer(options) {
        return this.#writePointer("createPointer", options);
    }
    updatePointer(options) {
        return this.#writePointer("updatePointer", options);
    }
    /** Permanently transfer control. A successful write still requires a finality check. */
    transferPointer(options) {
        return this.#writePointer("transferPointer", options);
    }
    /** Reuse the original payment and signed state; never submits another payment. */
    resumePointer(checkpoint, options) {
        return this.#pointerOperation(options, (network, signal, report) => resumePointer(network, this.#connection.paymentNetwork, checkpoint, { ...options, signal, payment: options.payment ?? this.#payment }, report));
    }
    #writePointer(method, options) {
        return this.#pointerOperation(options, (network, signal, report) => writePointer(network, this.#connection.paymentNetwork, method, { ...options, signal, payment: options.payment ?? this.#payment }, { report, holdTransport: () => this.#holdTransport() }));
    }
    async #pointerOperation(options, run, cancellable = false) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("pointer", options.onProgress, operation, false);
        try {
            this.#assertOpen();
            throwIfAborted(operation.signal);
            const pending = this.#withNetwork((network) => run(network, operation.signal, report));
            const result = await (cancellable ? abortable(pending, operation.signal) : pending);
            return snapshot(result);
        }
        catch (error) {
            const failure = isAbort(error, operation.signal) ? error : wrapError("POINTER_FAILED", "Pointer operation failed", error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    /** Open a bounded random-access reader without reconstructing the whole file. */
    openFile(file, options = {}) {
        return this.#openReader(isManifestEntry(file) ? manifestEntrySource(file) : file, options, false);
    }
    /** A streaming reader treats every read as sequential and fetches ahead of it. */
    async #openReader(file, options, streaming) {
        const operation = this.#startOperation(options);
        const report = this.#reporter("open-file", options.onProgress, operation);
        let raw;
        try {
            this.#assertOpen();
            throwIfAborted(operation.signal);
            raw = await abortable(this.#withNetwork((network) => isPrivateFile(file)
                ? network.openPrivateFile(corePrivateFile(file), report, { streaming })
                : network.openPublicFile(typeof file === "string" ? file : coreFileReference(file), report, { streaming })), operation.signal, undefined, closeReader);
            throwIfAborted(operation.signal);
            const address = isPrivateFile(file) ? "" : typeof file === "string" ? normalizeAddress(file) : file.address;
            const reader = createPublicFileReader(raw, address);
            report(`Opened ${reader.name}`, { phase: "complete" });
            raw = undefined;
            return reader;
        }
        catch (error) {
            if (raw)
                closeReader(raw);
            const failure = isAbort(error, operation.signal) ? error : wrapError("OPEN_FILE_FAILED", `Could not open the ${visibilityLabel(file).toLowerCase()} file`, error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    /**
     * Create a seekable URL suitable for `<video>` or `<audio>`.
     *
     * Copy `node_modules/@withautonomi/ant-browser-sdk/dist/autonomi-stream-sw.js` to
     * your site's public root before using the default serviceWorkerUrl.
     */
    async createMediaSource(target, options = {}) {
        const file = isManifestEntry(target) ? manifestEntrySource(target) : target;
        const operation = this.#startOperation(options);
        const report = this.#reporter("media", options.onProgress, operation);
        let reader;
        let source;
        try {
            this.#assertOpen();
            report("Opening an Autonomi random-access media reader");
            this.#media ??= new MediaBridge();
            // Nothing waits on anything it need not: the service worker installs while
            // the reader opens, and the head and tail are read the moment it is open.
            const worker = this.#media.prepare({ ...options, signal: operation.signal });
            // Awaited after the reader, so a failure surfaces in the same order as
            // when one waited for the other.
            worker.catch(() => undefined);
            // The reader opens without streaming mode. That mode starts fetching ahead,
            // and the file's last record, alongside the first block a player waits
            // for, which on the live network delayed the first frame (ADR-0003); a
            // plain reader still reads ahead once playback's reads follow each other.
            const opened = await this.#openReader(file, {
                ...(options.onProgress ? { onProgress: options.onProgress } : {}),
                parentOperationId: operation.id,
                signal: operation.signal,
            }, false);
            reader = opened;
            if (options.primePlayback ?? isPlayableMedia(opened)) {
                report(`Priming playback of ${opened.name}`, { phase: "media" });
                // Not awaited: the reads only warm the reader's cache for the player.
                void primePlayback(opened);
            }
            await worker;
            source = await this.#media.attach(opened, {
                ...options,
                signal: operation.signal,
            });
            report(`Media source ready for ${source.file.name}`, { phase: "complete" });
            return source;
        }
        catch (error) {
            try {
                if (source)
                    source.close();
                else
                    reader?.close();
            }
            catch {
                // Preserve the media setup or cancellation error.
            }
            const failure = isAbort(error, operation.signal) ? error : wrapError("MEDIA_FAILED", "Could not create the media source", error);
            operation.fail(failure);
            throw failure;
        }
        finally {
            operation.finish();
        }
    }
    /** Close WebRTC associations, readers owned by media sources, and caches. */
    close() {
        if (this.#closed)
            return;
        this.#closed = true;
        const reason = new DOMException("The Autonomi client was closed", "AbortError");
        for (const operation of this.#operations)
            operation.abort(reason);
        try {
            this.#media?.close();
        }
        catch {
            // Continue closing the network if a media reader cleanup failed.
        }
        finally {
            this.#releaseNetwork();
            if (this.#operations.size === 0)
                this.#listeners.clear();
        }
    }
    #assertOpen() {
        if (this.#closed)
            throw new AutonomiError("CLIENT_CLOSED", "Autonomi client is closed");
    }
    /**
     * Borrow the WASM network handle for one raw call. A cancelled operation may
     * return before its Rust future settles; close() frees the handle only after.
     */
    async #withNetwork(call) {
        this.#assertOpen();
        this.#networkLeases++;
        try {
            return await call(this.#network);
        }
        finally {
            this.#networkLeases--;
            this.#releaseNetwork();
        }
    }
    /** Keep the transport open while a possibly submitted payment is stored. Returns the release. */
    #holdTransport() {
        this.#transportHolds++;
        let released = false;
        return () => {
            if (released)
                return;
            released = true;
            this.#transportHolds--;
            this.#releaseNetwork();
        };
    }
    /** After close(): shut the transport once no paid write needs it, then free once nothing borrows the handle. */
    #releaseNetwork() {
        if (!this.#closed)
            return;
        if (!this.#transportClosed && this.#transportHolds === 0) {
            this.#transportClosed = true;
            try {
                this.#network.close();
            }
            catch {
                // Continue releasing the WASM allocation even if transport shutdown failed.
            }
        }
        if (this.#transportClosed && this.#networkLeases === 0 && !this.#networkFreed) {
            this.#networkFreed = true;
            try {
                this.#network.free();
            }
            catch {
                // Closing is idempotent and best effort.
            }
        }
    }
    /** Metadata this client already holds for a source, used to name a saved file. */
    #knownFile(file) {
        return typeof file === "string"
            ? this.files.find((candidate) => normalizeAddress(candidate.address) === normalizeAddress(file))
            : file;
    }
    #reporter(operation, local, scope, cancellable = true) {
        const phases = {
            "stream-and-save": "saving", pointer: "opening",
            connect: "connecting", lookup: "lookup", upload: "preparing",
            download: "downloading", "open-file": "opening", media: "media", "download-and-save": "downloading", save: "saving",
        };
        const report = progressReporter(operation, scope.id, phases[operation], (event) => {
            this.#notify(local, event);
        }, cancellable ? scope.signal : undefined, scope.parentOperationId);
        scope.reporters.push(report);
        return report;
    }
    #notify(local, event) {
        for (const listener of this.#listeners)
            safelyNotify(listener, event);
        if (local && !this.#listeners.has(local))
            safelyNotify(local, event);
    }
    #startOperation(options) {
        const externalSignal = options.signal;
        const controller = new AbortController();
        const forwardAbort = () => controller.abort(externalSignal?.reason);
        if (externalSignal?.aborted)
            forwardAbort();
        else
            externalSignal?.addEventListener("abort", forwardAbort, { once: true });
        this.#operations.add(controller);
        let finished = false;
        let outcome = { status: "succeeded" };
        const reporters = [];
        const scope = {
            id: operationId(),
            ...(options.parentOperationId === undefined ? {} : { parentOperationId: options.parentOperationId }),
            reporters,
            signal: controller.signal,
            fail: (error) => {
                outcome = {
                    status: isAbort(error, controller.signal) ? "cancelled" : "failed", error,
                    ...(scope.recovery === undefined ? {} : { recovery: scope.recovery }),
                };
            },
            finish: () => {
                if (finished)
                    return;
                finished = true;
                reporters.forEach((reporter) => reporter.finish(outcome));
                externalSignal?.removeEventListener("abort", forwardAbort);
                this.#operations.delete(controller);
                if (this.#closed && this.#operations.size === 0)
                    this.#listeners.clear();
            },
        };
        return scope;
    }
    #rememberFile(file) {
        const index = this.#files.findIndex((known) => known.address === file.address);
        if (index === -1)
            this.#files.push(snapshot(file));
        else
            this.#files[index] = snapshot(file);
    }
}
function visibilityLabel(file) {
    return isPrivateFile(file) ? "Private" : "Public";
}
function closeReader(reader) {
    try {
        reader.close();
    }
    catch {
        // Best-effort cleanup for a reader that resolved after its operation aborted.
    }
    try {
        reader.free();
    }
    catch {
        // Best-effort cleanup for a reader that resolved after its operation aborted.
    }
}
function closeNetwork(network) {
    try {
        network.close();
    }
    catch {
        // Continue releasing the WASM allocation even if transport shutdown failed.
    }
    try {
        network.free();
    }
    catch {
        // Closing is idempotent and best effort.
    }
}
function parseBootstrapMultiaddr(value) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new AutonomiError("INVALID_SOURCE", "A WebRTC Direct bootstrap multiaddress is required");
    }
    try {
        return getBindings().parseWebRtcDirectMultiaddr(value);
    }
    catch (error) {
        throw new AutonomiError("INVALID_SOURCE", "Invalid WebRTC Direct bootstrap multiaddress", error);
    }
}
function normalizePaymentNetwork(value) {
    if (typeof value !== "object" || value === null) {
        throw new TypeError("bootstrap node advertises invalid payment configuration");
    }
    const payment = value;
    const chainId = payment.chain_id;
    if (typeof chainId !== "number") {
        throw new TypeError("bootstrap node advertises an invalid payment chain ID");
    }
    assertPaymentChainId(chainId);
    return {
        chain_id: chainId,
        payment_token_address: normalizeEvmAddress(requiredString(payment.payment_token_address, "payment token address")),
        payment_vault_address: normalizeEvmAddress(requiredString(payment.payment_vault_address, "payment vault address")),
    };
}
function normalizeExpectedNetwork(value) {
    try {
        assertPaymentChainId(value.chainId);
        return {
            chainId: value.chainId,
            paymentTokenAddress: normalizeEvmAddress(value.paymentTokenAddress),
            paymentVaultAddress: normalizeEvmAddress(value.paymentVaultAddress),
        };
    }
    catch (error) {
        throw new AutonomiError("INVALID_SOURCE", "expectedPaymentNetwork requires a valid chain ID and both EVM contract addresses", error);
    }
}
function requiredString(value, name) {
    if (typeof value !== "string" || value.trim() === "") {
        throw new TypeError(`bootstrap node advertises an invalid ${name}`);
    }
    return value;
}
function normalizeEvmAddress(value) {
    const normalized = value
        .trim()
        .replace(/^0x/iu, "")
        .replaceAll(":", "")
        .toLowerCase();
    if (!/^[0-9a-f]{40}$/u.test(normalized)) {
        throw new TypeError("bootstrap node advertises an invalid payment contract address");
    }
    return `0x${normalized}`;
}
function randomHex(bytes) {
    return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function normalizeAddress(value) {
    return value.trim().replace(/^0x/iu, "").replaceAll(":", "").toLowerCase();
}
function safelyNotify(listener, event) {
    try {
        listener(event);
    }
    catch {
        // UI progress callbacks must never change a network operation's result.
    }
}
//# sourceMappingURL=client.js.map