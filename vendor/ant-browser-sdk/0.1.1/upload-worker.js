import initAntCore, { BrowserFileEncryptor } from "./wasm/ant_core.js";
import { putStagedRecord } from "./internal/record-store.js";
import { WindowStager } from "./internal/window-stager.js";

// One upload per worker. The encryptor keeps its stream position between windows,
// so each record is self-encrypted once while IndexedDB holds only one window.
let session;
let queue = Promise.resolve();

self.addEventListener("message", (event) => {
  queue = queue.then(() => handle(event.data)).catch((error) => {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

async function handle(message) {
  if (message?.type === "start") await start(message);
  if (message?.type === "stage") await stage(message);
}

async function start({ blob, name, contentType, sessionId, wasm, skip, withholdDataMap }) {
  await initAntCore(wasm === undefined ? undefined : { module_or_path: wasm });
  if (typeof FileReaderSync !== "function") {
    throw new Error("This browser cannot read files inside an upload worker");
  }
  const reader = new FileReaderSync();
  const encryptor = new BrowserFileEncryptor(blob.size, (offset, length) =>
    new Uint8Array(reader.readAsArrayBuffer(blob.slice(offset, offset + length))),
  );
  const stager = new WindowStager(
    () => encryptor.nextRecord(),
    (index, content) => putStagedRecord(sessionId, index, content.slice()),
    { withholdDataMap },
  );
  session = { encryptor, stager, name, contentType };
  if (skip > 0) {
    progress(`Self-encrypting ${name} again to resume after record ${skip}`);
    stager.skip(skip, (produced) => progress(`Re-encrypted stored record ${produced}/${skip}`, produced));
  } else {
    progress(`Self-encrypting ${name} without loading it into page memory`);
  }
}

async function stage({ limit }) {
  if (!session) throw new Error("Upload staging has not started");
  const window = await session.stager.stage(limit, (staged) =>
    progress(`Encrypted and staged record ${staged}`, staged),
  );
  self.postMessage({
    type: "window",
    ...window,
    ...(window.complete ? { file: session.encryptor.finish(session.name, session.contentType) } : {}),
  });
}

function progress(message, completed) {
  self.postMessage({ type: "progress", message, ...(completed === undefined ? {} : { completed }) });
}
