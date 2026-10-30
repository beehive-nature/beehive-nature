import { AutonomiError, wrapError } from "./errors.js";
import { abortable, abortReason, isAbort, throwIfAborted } from "./internal/abort.js";
import { SDK_LIMITS } from "./limits.js";
/** @internal Only the SDK may wrap a WASM reader. Not exported by the package. */
export let createPublicFileReader;
/** Bounded random-access reader backed by direct WebRTC record fetches. */
export class PublicFileReader {
    /** DataMap address; empty for a private file, which has no network DataMap. */
    address;
    name;
    size;
    contentType;
    #raw;
    #closed = false;
    #active = 0;
    #freed = false;
    #pipes = new Set();
    constructor(raw, address) {
        this.#raw = raw;
        this.address = address;
        this.name = raw.name;
        this.size = raw.size;
        this.contentType = raw.contentType;
    }
    static {
        createPublicFileReader = (raw, address) => new PublicFileReader(raw, address);
    }
    get closed() {
        return this.#closed;
    }
    /** Read one plaintext range. Reads past end-of-file are truncated. */
    async read(start, length, options = {}) {
        this.#assertOpen();
        throwIfAborted(options.signal);
        if (!Number.isSafeInteger(start) || start < 0) {
            throw new AutonomiError("OPEN_FILE_FAILED", "Range start must be a non-negative integer");
        }
        if (!Number.isSafeInteger(length) || length < 0 || length > SDK_LIMITS.maxRangeBytes) {
            throw new AutonomiError("OPEN_FILE_FAILED", `Range length must be an integer from 0 through ${SDK_LIMITS.maxRangeBytes}`);
        }
        try {
            return await abortable(this.#call(() => this.#raw.readRange(start, length)), options.signal);
        }
        catch (error) {
            if (isAbort(error, options.signal))
                throw error;
            throw wrapError("OPEN_FILE_FAILED", "Could not read the public file range", error);
        }
    }
    /**
     * Write a verified range with the core's bounded, concurrent download pipeline.
     * Closes the destination on success and aborts it on transfer failure. Invalid
     * options leave it untouched. Cancellation during close may happen after the
     * destination has committed. The reader remains reusable until close().
     * Failed reads reject with OPEN_FILE_FAILED; a failed destination write or
     * close rejects with SAVE_FAILED.
     */
    async pipeTo(destination, options = {}) {
        this.#assertOpen();
        const signal = options.signal;
        throwIfAborted(signal);
        if (typeof WritableStream !== "function" || !(destination instanceof WritableStream))
            throw new AutonomiError("OPEN_FILE_FAILED", "The destination must be a WritableStream");
        if (destination.locked)
            throw new AutonomiError("OPEN_FILE_FAILED", "The destination stream is locked");
        const controller = new AbortController();
        const abort = () => controller.abort(abortReason(signal));
        signal?.addEventListener("abort", abort, { once: true });
        this.#pipes.add(controller);
        const target = forwardTo(destination);
        try {
            return await this.#call(() => this.#raw.pipeTo(target.stream, { ...options, signal: controller.signal }));
        }
        catch (error) {
            if (isAbort(error, controller.signal))
                throw error;
            if (target.failed)
                throw wrapError("SAVE_FAILED", "Could not write to the destination", target.failure);
            throw wrapError("OPEN_FILE_FAILED", "Could not stream the file to its destination", error);
        }
        finally {
            signal?.removeEventListener("abort", abort);
            this.#pipes.delete(controller);
        }
    }
    /** Stream a sequential plaintext range while keeping memory use bounded. */
    stream(options = {}) {
        this.#assertOpen();
        throwIfAborted(options.signal);
        const start = options.start ?? 0;
        const end = options.end ?? this.size;
        const chunkSize = options.chunkSize ?? SDK_LIMITS.defaultStreamChunkBytes;
        if (!Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            end < start ||
            end > this.size) {
            throw new AutonomiError("OPEN_FILE_FAILED", "Stream bounds must describe a valid half-open file range");
        }
        if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > SDK_LIMITS.maxRangeBytes) {
            throw new AutonomiError("OPEN_FILE_FAILED", `Stream chunkSize must be an integer from 1 through ${SDK_LIMITS.maxRangeBytes}`);
        }
        let offset = start;
        let aborted = false;
        let removeAbortListener = () => { };
        return new ReadableStream({
            start: (controller) => {
                if (!options.signal)
                    return;
                const abort = () => {
                    aborted = true;
                    removeAbortListener();
                    controller.error(abortReason(options.signal));
                };
                options.signal.addEventListener("abort", abort, { once: true });
                removeAbortListener = () => options.signal?.removeEventListener("abort", abort);
            },
            pull: async (controller) => {
                if (aborted)
                    return;
                if (this.#closed) {
                    removeAbortListener();
                    controller.error(new AutonomiError("CLIENT_CLOSED", "Public file reader is closed"));
                    return;
                }
                if (offset >= end) {
                    removeAbortListener();
                    controller.close();
                    return;
                }
                try {
                    const bytes = await this.read(offset, Math.min(chunkSize, end - offset), options);
                    if (aborted)
                        return;
                    if (bytes.byteLength === 0) {
                        removeAbortListener();
                        controller.close();
                        return;
                    }
                    offset += bytes.byteLength;
                    controller.enqueue(bytes);
                }
                catch (error) {
                    removeAbortListener();
                    if (!aborted)
                        controller.error(error);
                }
            },
            cancel: () => { aborted = true; removeAbortListener(); },
        });
    }
    /** Release range caches. The reader cannot be reused after this call. */
    close() {
        if (this.#closed)
            return;
        this.#closed = true;
        for (const pipe of this.#pipes) {
            pipe.abort(new DOMException("The file reader was closed", "AbortError"));
        }
        try {
            this.#raw.close();
        }
        finally {
            this.#freeWhenIdle();
        }
    }
    // A cancelled range can still be settling in WASM. Never free a reader while
    // a raw method holds it, including when close() interrupts a pending pipe.
    async #call(run) {
        this.#active++;
        try {
            return await run();
        }
        finally {
            this.#active--;
            this.#freeWhenIdle();
        }
    }
    #freeWhenIdle() {
        if (this.#closed && this.#active === 0 && !this.#freed) {
            this.#freed = true;
            this.#raw.free();
        }
    }
    #assertOpen() {
        if (this.#closed) {
            throw new AutonomiError("CLIENT_CLOSED", "Public file reader is closed");
        }
    }
}
/**
 * A stream forwarding each operation to the caller's destination, so a failure
 * the destination raised is told apart from one in the read pipeline. Takes the
 * destination's writer on first use, leaving it untouched by an invalid call,
 * and releases it once closed or aborted. Each write still awaits the destination.
 */
function forwardTo(destination) {
    let writer;
    let failed = false;
    let failure;
    const take = () => {
        writer ??= destination.getWriter();
        return writer;
    };
    const release = () => {
        writer?.releaseLock();
    };
    const forward = async (operation) => {
        try {
            await operation(take());
        }
        catch (error) {
            failed = true;
            failure = error;
            // This stream now errors, and aborting an errored stream skips its sink: release here.
            release();
            throw error;
        }
    };
    const stream = new WritableStream({
        write: (chunk) => forward((target) => target.write(chunk)),
        close: async () => {
            await forward((target) => target.close());
            release();
        },
        abort: async (reason) => {
            try {
                await take().abort(reason);
            }
            catch {
                // The pipe has already failed; keep its error.
            }
            finally {
                release();
            }
        },
    });
    return {
        stream,
        get failed() { return failed; },
        get failure() { return failure; },
    };
}
//# sourceMappingURL=file-reader.js.map