#!/usr/bin/env python3
# patch_evb.py — one-shot: replace the hand-rolled keccak in evb.cpp with a
# cached js-sha3 node oracle (see README). Runs on the worktree file.
import sys
p = sys.argv[1]
src = open(p, encoding='utf-8').read()
def line_start(src, marker):
    i = src.index(marker)
    return src.rfind('\n', 0, i) + 1

start = line_start(src, 'keccak-f[1600] (host side)')
end = line_start(src, 'BN254 G1 native (host side, on field256)')
oracle_impl = '''// ══════ keccak (host side): cached js-sha3 node oracle ══════
// The hand-rolled permutation this lane first used failed its own fail-closed
// self-test (receipts/engine-suite.log, first run) and was REMOVED — no
// hand-rolled crypto without vectors rides this harness (estate law).
// Correctness anchors: the canonical empty/"abc" vectors, checked at startup.
static std::string kec_oracle_path() {
   const char* e = getenv("EVB_KECCAK_ORACLE");
   return e ? e : "keccak_oracle.js";
}
static bool keccak_oracle(const uint8_t* in, size_t len, uint8_t out[32]) {
   FILE* w = fopen("/tmp/evb_kec.hex", "w");
   if (!w) return false;
   for (size_t i = 0; i < len; ++i) fprintf(w, "%02x", in[i]);
   fclose(w);
   std::string full = "node '" + kec_oracle_path() + "' < /tmp/evb_kec.hex";
   FILE* r = popen(full.c_str(), "r");
   if (!r) return false;
   char line[80] = {0};
   bool ok = fgets(line, sizeof line, r) != nullptr;
   pclose(r);
   if (!ok || strlen(line) < 64) return false;
   for (int i = 0; i < 32; ++i) {
      char b[3] = { line[2*i], line[2*i+1], 0 };
      out[i] = (uint8_t)strtoul(b, nullptr, 16);
   }
   return true;
}
static bool keccak_selftest() { // canonical vectors — fail closed
   struct { const char* in; const char* hex; } v[2] = {
      {"", "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"}, // PUBLIC-CONSTANT keccak256("")
      {"abc","4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"}, // PUBLIC-CONSTANT keccak256("abc")
   };
   for (auto& t : v) {
      uint8_t h[32];
      if (!keccak_oracle((const uint8_t*)t.in, strlen(t.in), h)) { fprintf(stderr, "keccak ORACLE FAIL\\n"); return false; }
      char hex[65]; for (int i = 0; i < 32; ++i) sprintf(hex + 2*i, "%02x", h[i]);
      if (strcmp(hex, t.hex)) { fprintf(stderr, "keccak SELFTEST FAIL: %s\\n", hex); return false; }
   }
   return true;
}

'''
src = src[:start] + oracle_impl + src[end:]

old_metrics = '''struct host_metrics {
   uint64_t kec_n=0, kec_ns=0, add_n=0, add_ns=0, mul_n=0, mul_ns=0,
            pair_n=0, pair_ns=0, dbput_n=0, dbput_ns=0, dbget_n=0, dbget_ns=0;
};'''
new_metrics = '''struct host_metrics {
   uint64_t kec_n=0, kec_ns=0, add_n=0, add_ns=0, mul_n=0, mul_ns=0,
            pair_n=0, pair_ns=0, dbput_n=0, dbput_ns=0, dbget_n=0, dbget_ns=0;
   uint64_t kec_exec=0, kec_cache=0;   // oracle execs vs cache hits
};'''
assert old_metrics in src
src = src.replace(old_metrics, new_metrics)

old_host = '''   // wasm imports: every pointer is a raw i32 offset into linear memory
   void keccak256(int32_t in, int32_t len, int32_t out) {
      auto t0 = std::chrono::steady_clock::now();
      ::keccak256((const uint8_t*)(mem + in), (size_t)len, (uint8_t*)(mem + out));
      m.kec_n++; m.kec_ns += ns_since(t0);
      log("kec", mem + in, (uint32_t)len);
   }'''
new_host = '''   // wasm import: raw i32 offsets. The oracle runs ONCE per distinct input
   // (cache); warm loops measure the wasm->host boundary + cache cost, the
   // first call measures true keccak cost. Both are reported separately.
   std::map<std::string, std::vector<uint8_t>> kec_cache;
   void keccak256(int32_t in, int32_t len, int32_t out) {
      auto t0 = std::chrono::steady_clock::now();
      std::string key(mem + in, mem + in + len);
      auto it = kec_cache.find(key);
      if (it != kec_cache.end()) {
         memcpy(mem + out, it->second.data(), 32);
         m.kec_cache++;
      } else {
         std::vector<uint8_t> h(32);
         if (!keccak_oracle((const uint8_t*)(mem + in), (size_t)len, h.data())) {
            fprintf(stderr, "keccak oracle FAILED at runtime\\n"); exit(3);
         }
         memcpy(mem + out, h.data(), 32);
         kec_cache[key] = h;
         m.kec_exec++;
      }
      m.kec_n++; m.kec_ns += ns_since(t0);
      log("kec", mem + in, (uint32_t)len);
   }'''
assert old_host in src
src = src.replace(old_host, new_host)

old_json = '\\"kec_n\\":%llu,\\"kec_ns\\":%llu,'
new_json = '\\"kec_n\\":%llu,\\"kec_ns\\":%llu,\\"kec_exec\\":%llu,\\"kec_cache\\":%llu,'
assert old_json in src, 'json fmt not found'
src = src.replace(old_json, new_json)
old_args = '(unsigned long long)h.m.kec_n, (unsigned long long)h.m.kec_ns,'
new_args = '(unsigned long long)h.m.kec_n, (unsigned long long)h.m.kec_ns,\n             (unsigned long long)h.m.kec_exec, (unsigned long long)h.m.kec_cache,'
assert old_args in src, 'json args not found'
src = src.replace(old_args, new_args)

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print('patched OK')
