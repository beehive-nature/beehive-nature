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
            return await abortable(this.#raw.readRange(start, length), options.signal);
        }
        catch (error) {
            if (isAbort(error, options.signal))
                throw error;
            throw wrapError("OPEN_FILE_FAILED", "Could not read the public file range", error);
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
            cancel: () => removeAbortListener(),
        });
    }
    /** Release range caches. The reader cannot be reused after this call. */
    close() {
        if (this.#closed)
            return;
        this.#closed = true;
        try {
            this.#raw.close();
        }
        finally {
            this.#raw.free();
        }
    }
    #assertOpen() {
        if (this.#closed) {
            throw new AutonomiError("CLIENT_CLOSED", "Public file reader is closed");
        }
    }
}
//# sourceMappingURL=file-reader.js.map