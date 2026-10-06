const DATABASE_NAME = "autonomi-browser-sdk-upload-staging";
const DATABASE_VERSION = 2;
const CHECKPOINT_STORE = "checkpoints";
const RECORD_STORE = "records";
let databasePromise;
function uploadDatabase() {
    if (databasePromise)
        return databasePromise;
    const opening = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        let abandoned = false;
        request.addEventListener("upgradeneeded", () => {
            if (!request.result.objectStoreNames.contains(CHECKPOINT_STORE))
                request.result.createObjectStore(CHECKPOINT_STORE);
            if (!request.result.objectStoreNames.contains(RECORD_STORE))
                request.result.createObjectStore(RECORD_STORE);
        });
        request.addEventListener("blocked", () => {
            abandoned = true;
            reject(new Error("Close older Autonomi tabs to upgrade upload recovery storage"));
        });
        request.addEventListener("success", () => {
            const database = request.result;
            if (abandoned) {
                database.close();
                return;
            }
            database.addEventListener("versionchange", () => {
                database.close();
                if (databasePromise === opening)
                    databasePromise = undefined;
            });
            resolve(database);
        });
        request.addEventListener("error", () => {
            reject(request.error ?? new Error("Could not open upload staging storage"));
        });
    });
    databasePromise = opening;
    void opening.catch(() => { if (databasePromise === opening)
        databasePromise = undefined; });
    return opening;
}
function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.addEventListener("complete", () => resolve(), { once: true });
        transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("Upload staging transaction aborted")), { once: true });
        transaction.addEventListener("error", () => reject(transaction.error ?? new Error("Upload staging transaction failed")), { once: true });
    });
}
export async function putStagedRecord(sessionId, index, content) {
    const database = await uploadDatabase();
    const transaction = database.transaction(RECORD_STORE, "readwrite");
    transaction.objectStore(RECORD_STORE).put(content, [sessionId, index]);
    await transactionDone(transaction);
}
export async function getStagedRecord(sessionId, index) {
    const database = await uploadDatabase();
    const transaction = database.transaction(RECORD_STORE, "readonly");
    const request = transaction.objectStore(RECORD_STORE).get([sessionId, index]);
    const result = await new Promise((resolve, reject) => {
        request.addEventListener("success", () => resolve(request.result), { once: true });
        request.addEventListener("error", () => reject(request.error ?? new Error("Could not read a staged upload record")), { once: true });
    });
    await transactionDone(transaction);
    if (result === undefined) {
        throw new Error(`Staged upload record ${index + 1} is missing`);
    }
    return result instanceof Uint8Array ? result : new Uint8Array(result);
}
/** Remove a session's records from `start` up to, but excluding, `end`. */
export async function deleteStagedRecordRange(sessionId, start, end = Number.MAX_SAFE_INTEGER) {
    if (end <= start)
        return;
    const database = await uploadDatabase();
    const transaction = database.transaction(RECORD_STORE, "readwrite");
    const range = IDBKeyRange.bound([sessionId, start], [sessionId, end], false, true);
    transaction.objectStore(RECORD_STORE).delete(range);
    await transactionDone(transaction);
}
/** Remove every record a session staged, including windows a terminated worker left behind. */
export async function deleteStagedSession(sessionId) {
    await deleteStagedRecordRange(sessionId, 0);
}
/** Persist the core payment journal before the signer is invoked. */
export async function saveUploadCheckpoint(id, checkpoint) {
    const database = await uploadDatabase();
    const transaction = database.transaction(CHECKPOINT_STORE, "readwrite", { durability: "strict" });
    transaction.objectStore(CHECKPOINT_STORE).put(checkpoint, id);
    await transactionDone(transaction);
}
/** Journals survive reloads; reselect the input and pass its checkpoint to upload(). */
export async function storedUploadCheckpoints() {
    const database = await uploadDatabase();
    const transaction = database.transaction(CHECKPOINT_STORE, "readonly");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(CHECKPOINT_STORE);
    const keys = store.getAllKeys();
    const values = store.getAll();
    await done;
    return keys.result.map((id, index) => ({ id: String(id), checkpoint: String(values.result[index]) }));
}
/** Forget a completed upload journal after all storage work has settled. */
export async function deleteUploadCheckpoint(id) {
    const database = await uploadDatabase();
    const transaction = database.transaction(CHECKPOINT_STORE, "readwrite");
    transaction.objectStore(CHECKPOINT_STORE).delete(id);
    await transactionDone(transaction);
}
//# sourceMappingURL=record-store.js.map