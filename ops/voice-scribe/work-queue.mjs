import { spawn } from 'node:child_process';

// Capacity includes the running job. A failed job never poisons the chain.
export function createSerialQueue(capacity = 4) {
  let depth = 0;
  let tail = Promise.resolve();
  return {
    get depth() { return depth; },
    run(job) {
      if (depth >= capacity) return Promise.reject(Object.assign(new Error('the scribe is busy — try again in a moment'), { statusCode: 503 }));
      depth += 1;
      const result = tail.then(job);
      const settled = result.finally(() => { depth -= 1; });
      tail = settled.catch(() => {});
      return settled;
    },
  };
}

// Resolve/reject only after close: the child has stopped before spool cleanup
// and before another job can run. Never return media/tool stderr to callers.
export function runChild(command, args, { timeoutMs, capture = false, maxOutput = 8192 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', 'ignore'] });
    let output = '';
    let failure;
    const timer = setTimeout(() => {
      failure = new Error('the transcriber took too long and was stopped');
      child.kill('SIGKILL');
    }, timeoutMs ?? 240_000);
    child.stdout?.on('data', chunk => {
      if (Buffer.byteLength(output) + chunk.length > maxOutput) {
        failure = new Error('the audio probe produced too much output');
        child.kill('SIGKILL');
      } else { output += chunk; }
    });
    child.on('error', error => { failure = error; });
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error('the audio processing tool failed'));
      else resolve(output);
    });
  });
}
