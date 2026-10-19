/**
 * Stages consecutive encrypted records in bounded windows. A record that does not
 * fit is held back in memory and opens the next window, so the encryptor runs once.
 */
export class WindowStager {
    #next;
    #put;
    #withholdDataMap;
    /** Produced but not yet staged, in encryptor order: a held-back or looked-ahead record. */
    #buffered = [];
    #exhausted = false;
    #produced = 0;
    constructor(next, put, { withholdDataMap = false } = {}) {
        this.#next = next;
        this.#put = put;
        this.#withholdDataMap = withholdDataMap;
    }
    /** Re-encrypt and discard records that earlier windows already stored. */
    skip(count, onSkipped) {
        while (this.#produced < count) {
            if (!this.#take())
                throw new Error("The file ended before the resumed upload window; select the original file");
            this.#produced += 1;
            onSkipped?.(this.#produced);
        }
    }
    async stage(limit, onStaged) {
        const firstIndex = this.#produced;
        const records = [];
        let bytes = 0;
        for (;;) {
            const record = this.#take();
            if (!record)
                return { firstIndex, records, complete: true };
            // The withheld DataMap needs no storage, so it never opens a window of its own.
            if (this.#withholdDataMap && this.#isLast()) {
                return { firstIndex, records, complete: true, dataMap: record.content };
            }
            const size = record.content.byteLength;
            if (windowIsFull(limit, records.length, bytes, size)) {
                this.#buffered.unshift(record);
                return { firstIndex, records, complete: false };
            }
            try {
                await this.#put(this.#produced, record.content);
            }
            catch (error) {
                if (!isQuotaExceeded(error))
                    throw error;
                // Quota estimates are hints; end a byte-bounded window early rather than fail it.
                if ("bytes" in limit && records.length > 0) {
                    this.#buffered.unshift(record);
                    return { firstIndex, records, complete: false };
                }
                throw new Error(`Not enough browser storage to stage an upload window: IndexedDB refused a ${size.toLocaleString()}-byte record`, { cause: error });
            }
            records.push({ address: record.address, size });
            bytes += size;
            this.#produced += 1;
            onStaged?.(this.#produced);
        }
    }
    #take() {
        return this.#buffered.shift() ?? this.#produce();
    }
    /** Whether the record just taken was the encryptor's last, looking one record ahead. */
    #isLast() {
        if (this.#buffered.length > 0)
            return false;
        const following = this.#produce();
        if (!following)
            return true;
        this.#buffered.push(following);
        return false;
    }
    #produce() {
        if (this.#exhausted)
            return undefined;
        const record = this.#next();
        this.#exhausted = record === undefined;
        return record;
    }
}
function windowIsFull(limit, count, bytes, size) {
    if (!("bytes" in limit))
        return limit.records !== undefined && count >= limit.records;
    if (bytes + size <= limit.bytes)
        return false;
    if (count > 0)
        return true;
    throw new Error(`Not enough browser storage to stage an upload window: ${Math.max(0, limit.bytes).toLocaleString()} bytes available, a record needs ${size.toLocaleString()}`);
}
function isQuotaExceeded(error) {
    return typeof error === "object" && error !== null && error.name === "QuotaExceededError";
}
//# sourceMappingURL=window-stager.js.map