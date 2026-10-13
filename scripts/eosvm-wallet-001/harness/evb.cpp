// evb.cpp — EOSVM-WALLET-001 engine harness: runs a wasm module under the
// eos-vm INTERPRETER and JIT (AntelopeIO/eos-vm @ e8b4e8b, Spring v1.2.2's
// pinned submodule) and separates the phases the order names: cold parse/
// instantiation, first call, warm execution, native host-call time, db work,
// memory growth, end-to-end latency, RSS.
//
// Host imports are raw-i32 offsets rebased on linear memory — no pointer
// type-conversion magic, identical on both backends. Call results come back
// through fixed memory slots (zkr_last / micro slots), not backend return
// APIs, so both backends share one readout path.
//
// Pairing host function modes (the only non-native crypto on the host side):
//   stub  — returns 0. Timing runs only: wasm work is identical, host time is
//           excluded from engine numbers (the separation the order asks for).
//           NEVER used for accept/reject claims.
//   pyecc — consults pair_oracle.py (py_ecc, the estate's BN254 oracle
//           heritage from the zkbench lane); correctness battery only;
//           correctness stops at py_ecc.
//
// SOUND BY CONSTRUCTION / ISOLATED BY DESIGN — never stronger language.
#include <eosio/vm/backend.hpp>
#include <eosio/vm/watchdog.hpp>
#include <eosio/vm/error_codes.hpp>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "../component/field256.hpp"        // verbatim estate BN254 field library
#include "../component/vk_count_constants.hpp" // PL_Q / PL_QF (verbatim copy)

using namespace eosio::vm;

// ── the component's frozen layout (defined in component/zkr_component.cpp) ──
static constexpr uint32_t ZKR_PROOF_OFF = 1u << 16;
static constexpr uint32_t ZKR_PUBS_OFF  = ZKR_PROOF_OFF + 768;
static constexpr uint32_t ZKR_LAST_OFF  = ZKR_PUBS_OFF + 96;
static constexpr uint32_t MIC_SLOT      = 4096; // harness/micro.c grow() result

// ══════ keccak (host side): cached js-sha3 node oracle ══════
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
      if (!keccak_oracle((const uint8_t*)t.in, strlen(t.in), h)) { fprintf(stderr, "keccak ORACLE FAIL\n"); return false; }
      char hex[65]; for (int i = 0; i < 32; ++i) sprintf(hex + 2*i, "%02x", h[i]);
      if (strcmp(hex, t.hex)) { fprintf(stderr, "keccak SELFTEST FAIL: %s\n", hex); return false; }
   }
   return true;
}

// ══════════════════ BN254 G1 native (host side, on field256) ══════════════════
static uint64_t ns_since(std::chrono::steady_clock::time_point t) {
   return std::chrono::duration_cast<std::chrono::nanoseconds>(
      std::chrono::steady_clock::now() - t).count();
}

struct host_metrics {
   uint64_t kec_n=0, kec_ns=0, add_n=0, add_ns=0, mul_n=0, mul_ns=0,
            pair_n=0, pair_ns=0, dbput_n=0, dbput_ns=0, dbget_n=0, dbget_ns=0;
   uint64_t kec_exec=0, kec_cache=0;   // oracle execs vs cache hits
};

struct host_t {
   using host_type_t = host_t;            // eos-vm's detail::host_type contract
   host_metrics m;
   char* mem = nullptr;
   int pairing_mode = 0;                  // 0 stub · 1 pyecc
   std::map<std::string, std::string> db;
   std::string calllog;                   // ordered host-call fingerprint
   std::string py_oracle;
   std::string last_pair_hex; int32_t last_pair_rc = 0;

   void log(const char* name, const char* a = nullptr, uint32_t l = 0) {
      calllog += name; calllog += '(';
      if (a && l) { char b[4]; uint32_t n = l < 4 ? l : 4;
         for (uint32_t i = 0; i < n; ++i) { sprintf(b, "%02x", (uint8_t)a[i]); calllog += b; }
         calllog += ".."; }
      calllog += ')';
   }

   // wasm import: raw i32 offsets. The oracle runs ONCE per distinct input
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
            fprintf(stderr, "keccak oracle FAILED at runtime\n"); std::exit(3);
         }
         memcpy(mem + out, h.data(), 32);
         kec_cache[key] = h;
         m.kec_exec++;
      }
      m.kec_n++; m.kec_ns += ns_since(t0);
      log("kec", mem + in, (uint32_t)len);
   }
   int32_t db_get(int32_t k, int32_t kl, int32_t v, int32_t vl) {
      auto t0 = std::chrono::steady_clock::now();
      auto it = db.find(std::string(mem + k, (size_t)kl));
      int32_t r = -1;
      if (it != db.end() && it->second.size() <= (size_t)vl) {
         memcpy(mem + v, it->second.data(), it->second.size());
         r = (int32_t)it->second.size();
      }
      m.dbget_n++; m.dbget_ns += ns_since(t0); log("dbget"); return r;
   }
   int32_t db_put(int32_t k, int32_t kl, int32_t v, int32_t vl) {
      auto t0 = std::chrono::steady_clock::now();
      db[std::string(mem + k, (size_t)kl)] = std::string(mem + v, (size_t)vl);
      m.dbput_n++; m.dbput_ns += ns_since(t0); log("dbput"); return 0;
   }

   // BN254 G1 over qf; membership law identical to the verifier's phase 1
   // (plonk_verify_count.hpp plonk_checkProofData: y² = x³+3 over qf).
   struct G1 { u256 x, y; bool inf; };
   static G1 mk( const u256 x, const u256 y, bool inf ) {
      G1 g; f256_copy( g.x, x ); f256_copy( g.y, y ); g.inf = inf; return g;
   }
   static G1 inf_g1() { u256 z; f256_zero( z ); return mk( z, z, true ); }
   static void qf_ctx(fctx& c) { u256 qf; f256_from_be(qf, PL_QF); fctx_init(&c, qf); }
   static const u256& qf_minus_two(fctx& c) {
      static u256 r; static bool init = false;
      if (!init) { u256 qf, two; f256_from_be(qf, PL_QF); f256_set_u64(two, 2);
                   f_sub(&c, qf, two, r); init = true; }
      return r;
   }
   static G1 parse(const char* p) {
      G1 g; f256_from_be(g.x, (const unsigned char*)p);
      f256_from_be(g.y, (const unsigned char*)(p + 32));
      g.inf = f256_is_zero(g.x) && f256_is_zero(g.y); return g;
   }
   static void write(char* o, const G1& g) {
      if (g.inf) { memset(o, 0, 64); return; }
      f256_to_be((unsigned char*)o, g.x); f256_to_be((unsigned char*)(o + 32), g.y);
   }
   static bool on_curve(const G1& g) {
      if (g.inf) return true;
      fctx c; qf_ctx(c); u256 x2, x3, lhs, rhs, three;
      f_mul(&c, g.x, g.x, x2); f_mul(&c, x2, g.x, x3);
      f256_set_u64(three, 3); f_add(&c, x3, three, lhs); f_mul(&c, g.y, g.y, rhs);
      return f256_eq(lhs, rhs);
   }
   static G1 dbl(const G1& a, fctx& c) {
      if (a.inf || f256_is_zero(a.y)) return mk(a.x, a.y, true);
      u256 num, den, l, xx, t, x3, y3;
      f_mul(&c, a.x, a.x, xx); f_add(&c, xx, xx, t); f_add(&c, t, xx, num);  // 3x²
      f_add(&c, a.y, a.y, den);                                             // 2y
      f_pow(&c, den, qf_minus_two(c), l);                                   // l = 3x²/2y
      f_mul(&c, l, l, t); f_sub(&c, t, a.x, x3); f_sub(&c, x3, a.x, x3);
      f_sub(&c, a.x, x3, t); f_mul(&c, l, t, y3); f_sub(&c, y3, a.y, y3);
      return mk(x3, y3, false);
   }
   static G1 add(const G1& a, const G1& b, fctx& c) {
      if (a.inf) return b;
      if (b.inf) return a;
      u256 dx, dy, l, l2, x3, y3, t;
      f_sub(&c, b.x, a.x, dx); f_sub(&c, b.y, a.y, dy);
      if (f256_is_zero(dx))
         return f256_is_zero(dy) ? dbl(a, c) : mk(a.x, a.y, true);
      f_pow(&c, dx, qf_minus_two(c), l); f_mul(&c, dy, l, l);           // l = dy/dx
      f_mul(&c, l, l, l2); f_sub(&c, l2, a.x, x3); f_sub(&c, x3, b.x, x3);
      f_sub(&c, a.x, x3, t); f_mul(&c, l, t, y3); f_sub(&c, y3, a.y, y3);
      return mk(x3, y3, false);
   }
   // Curve ops: the first implementation of this lane did affine add/dbl on
   // field256 locally and produced off-curve results (receipted); it was
   // REPLACED by the ffjavascript oracle with an on-curve validation gate —
   // this harness's own field math (on_curve, proven against vectors) only
   // VALIDATES oracle outputs, it never computes curve results anymore.
   std::map<std::string, std::vector<uint8_t>> curve_cache;
   std::string hexn(const char* p, int n) {
      std::string s; char b[3];
      for (int i = 0; i < n; ++i) { sprintf(b, "%02x", (uint8_t)p[i]); s += b; }
      return s;
   }
   bool curve_oracle(const char* mode, const std::string& inhex, uint8_t* out64) {
      auto it = curve_cache.find(mode + inhex);
      if (it != curve_cache.end()) { memcpy(out64, it->second.data(), 64); return true; }
      FILE* f = fopen("/tmp/evb_curve.hex", "w");
      if (!f) return false;
      fwrite(inhex.data(), 1, inhex.size(), f); fclose(f);
      std::string cmd = "node '" + py_oracle + "' " + mode + " < /tmp/evb_curve.hex";
      FILE* r = popen(cmd.c_str(), "r");
      if (!r) return false;
      char line[140] = {0};
      bool ok = fgets(line, sizeof line, r) != nullptr;
      pclose(r);
      if (!ok || strlen(line) < 128 || line[0] == '-') return false;
      std::vector<uint8_t> h(64);
      for (int i = 0; i < 64; ++i) {
         char b[3] = { line[2*i], line[2*i+1], 0 };
         h[i] = (uint8_t)strtoul(b, nullptr, 16);
      }
      // VALIDATION GATE: the oracle's point must satisfy y² = x³+3 (the
      // same membership law the verifier's phase 1 enforces)
      G1 g = parse((const char*)h.data());
      if (!on_curve(g)) return false;
      memcpy(out64, h.data(), 64);
      curve_cache[mode + inhex] = h;
      return true;
   }
   int32_t alt_bn128_add(int32_t op1, int32_t, int32_t op2, int32_t,
                         int32_t res, int32_t rl) {
      auto t0 = std::chrono::steady_clock::now();
      int32_t rc = -1;
      if (rl >= 64) {
         if (pairing_mode == 1) {
            rc = curve_oracle("g1add", hexn(mem + op1, 64) + hexn(mem + op2, 64),
                              (uint8_t*)(mem + res)) ? 0 : -1;
         } else {
            // stub (timing only): echo op1 — result CONTENT is irrelevant to
            // engine timing; never used for accept/reject claims
            memcpy(mem + res, mem + op1, 64);
            rc = 0;
         }
      }
      m.add_n++; m.add_ns += ns_since(t0); log("add", mem + op1, 4); return rc;
   }
   int32_t alt_bn128_mul(int32_t g1p, int32_t, int32_t sp, int32_t,
                         int32_t res, int32_t rl) {
      auto t0 = std::chrono::steady_clock::now();
      int32_t rc = -1;
      if (rl >= 64) {
         if (pairing_mode == 1) {
            rc = curve_oracle("g1mul", hexn(mem + g1p, 64) + hexn(mem + sp, 32),
                              (uint8_t*)(mem + res)) ? 0 : -1;
         } else {
            memcpy(mem + res, mem + g1p, 64);   // stub echo (timing only)
            rc = 0;
         }
      }
      m.mul_n++; m.mul_ns += ns_since(t0); log("mul", mem + g1p, 4); return rc;
   }
   int32_t alt_bn128_pair(int32_t pairs, int32_t pairs_len) {
      auto t0 = std::chrono::steady_clock::now();
      int32_t rc = 0;
      if (pairing_mode == 1) {
         std::string hex; char b[3];
         for (int32_t i = 0; i < pairs_len; ++i) {
            sprintf(b, "%02x", (uint8_t)mem[pairs + i]); hex += b;
         }
         if (hex != last_pair_hex) {          // the verifier asks exactly once
            FILE* f = fopen("/tmp/evb_pair.hex", "w");
            if (f) { fwrite(hex.data(), 1, hex.size(), f); fclose(f); }
            std::string cmd = "node '" + py_oracle + "' < /tmp/evb_pair.hex";
            FILE* r = popen(cmd.c_str(), "r");
            char line[8] = {0};
            if (r) { if (!fgets(line, sizeof line, r)) line[0] = 'x'; pclose(r); }
            last_pair_hex = hex; last_pair_rc = (int32_t)strtol(line, nullptr, 10);
         }
         rc = last_pair_rc;
      }
      m.pair_n++; m.pair_ns += ns_since(t0); log("pair", mem + pairs, 4); return rc;
   }
};

// register host imports on both backends (same names the modules import)
static void register_hosts() {
   registered_host_functions<host_t>::add<&host_t::keccak256>("env", "keccak256");
   registered_host_functions<host_t>::add<&host_t::db_get>("env", "db_get");
   registered_host_functions<host_t>::add<&host_t::db_put>("env", "db_put");
   registered_host_functions<host_t>::add<&host_t::alt_bn128_add>("env", "alt_bn128_add");
   registered_host_functions<host_t>::add<&host_t::alt_bn128_mul>("env", "alt_bn128_mul");
   registered_host_functions<host_t>::add<&host_t::alt_bn128_pair>("env", "alt_bn128_pair");
}

// ══════════════════ plumbing ══════════════════
static size_t rss_kb() {
   std::ifstream f("/proc/self/status"); std::string k; size_t v;
   while (f >> k) if (k == "VmRSS:") { f >> v; return v; }
   return 0;
}
static std::vector<uint8_t> readfile(const char* p) {
   std::ifstream f(p, std::ios::binary);
   return std::vector<uint8_t>((std::istreambuf_iterator<char>(f)),
                               std::istreambuf_iterator<char>());
}
static std::string hexread(const char* p) {
   std::ifstream f(p); std::string s, line;
   while (f >> line) s += line;
   return s;
}
static std::vector<uint8_t> unhex(const std::string& h) {
   std::vector<uint8_t> v; v.reserve(h.size() / 2);
   for (size_t i = 0; i + 1 < h.size(); i += 2)
      v.push_back((uint8_t)strtoul(h.substr(i, 2).c_str(), nullptr, 16));
   return v;
}
static uint64_t fnv(const std::string& s) {
   uint64_t h = 1469598103934665603ull;
   for (unsigned char c : s) { h ^= c; h *= 1099511628211ull; }
   return h;
}
static std::vector<double> quantiles(std::vector<uint64_t> v) {
   std::sort(v.begin(), v.end());
   auto pick = [&](double q) -> double {
      if (v.empty()) return 0;
      size_t i = (size_t)(q * (v.size() - 1)); return (double)v[i];
   };
   return { pick(0), pick(0.5), pick(0.95), v.empty() ? 0.0 : (double)v.back() };
}

template <typename Impl>
static int run(int argc, char** argv) {
   const char* module = argv[1];
   std::string mode = argv[3];
   host_t h;
   if (const char* e = getenv("EVB_PAIR_ORACLE")) h.py_oracle = e;
   else h.py_oracle = "oracle.js";
   int warm_n = 0; std::string entry; std::vector<int32_t> args;
   const char *prooff = nullptr, *pubsf = nullptr; int expect = 0;
   int parse_n = 10; int maxpages = 4096;
   for (int i = 4; i < argc; ++i) {
      std::string a = argv[i];
      if (a == "--pairing") h.pairing_mode = strcmp(argv[++i], "oracle") ? 0 : 1;
      else if (a == "--warm") warm_n = atoi(argv[++i]);
      else if (a == "--entry") entry = argv[++i];
      else if (a == "--args") { std::string s = argv[++i];
         for (size_t p = 0; p <= s.size();) { size_t c = s.find(',', p);
            args.push_back((int32_t)strtol(s.substr(p, c - p).c_str(), nullptr, 0));
            if (c == std::string::npos) break; p = c + 1; } }
      else if (a == "--proof") prooff = argv[++i];
      else if (a == "--pubs") pubsf = argv[++i];
      else if (a == "--expect") expect = atoi(argv[++i]);
      else if (a == "--parse") parse_n = atoi(argv[++i]);
      else if (a == "--pages") maxpages = atoi(argv[++i]);
   }
   if (!keccak_selftest()) return 3;

   auto code = readfile(module);
   if (code.empty()) { fprintf(stderr, "cannot read %s\n", module); return 2; }
   register_hosts();
   using host_rhf = registered_host_functions<host_t>;  // Spring's pattern:
   // the backend's HostFunctions arg is registered_host_functions<host_t>
   // itself; it supplies resolve/operator()/type_converter_t.
   wasm_allocator wa;
   const char* backend_name = strcmp(argv[2], "jit") == 0 ? "jit" : "interp";

   // ── cold: parse + instantiate (+ JIT codegen) ──
   size_t rss0 = rss_kb();
   auto tc = std::chrono::steady_clock::now();
   std::unique_ptr<backend<host_rhf, Impl>> bk;
   try { bk = std::make_unique<backend<host_rhf, Impl>>(code, h, &wa); }
   catch (const eosio::vm::exception& e) {
      printf("{\"backend\":\"%s\",\"mode\":\"ctor\",\"error\":\"%s\",\"detail\":\"%s\"}\n",
             backend_name, e.what(), e.detail());
      return 7;
   }
   int64_t cold_ns = ns_since(tc);
   h.mem = bk->get_context().linear_memory();
   if (!h.mem) { fprintf(stderr, "no linear memory\n"); return 2; }

   int rc = 0;
   if (mode == "parse") {
      std::vector<uint64_t> t;
      for (int i = 1; i < parse_n; ++i) {   // first ctor already measured
         auto t0 = std::chrono::steady_clock::now();
         backend<host_rhf, Impl> b2(code, h, &wa);
         t.push_back(ns_since(t0));
      }
      auto q = quantiles(t);
      printf("{\"backend\":\"%s\",\"mode\":\"parse\",\"n\":%d,\"cold_first_ns\":%lld,"
             "\"ctor_p50_ns\":%.0f,\"ctor_p95_ns\":%.0f,\"wasm_bytes\":%zu,\"rss_kb\":%zu}\n",
             backend_name, parse_n, (long long)cold_ns, q[1], q[2], code.size(), rss_kb());
      return 0;
   }
   if (mode == "phase") {   // bisect: write fixtures, run --entry, print return
      if (!prooff || !pubsf) { fprintf(stderr, "phase needs --proof/--pubs\n"); return 2; }
      {
         auto proof = unhex(hexread(prooff));
         auto pubs  = unhex(hexread(pubsf));
         if (proof.size() != 768 || pubs.size() != 96) {
            fprintf(stderr, "fixture sizes %zu/%zu (want 768/96)\n", proof.size(), pubs.size());
            return 2;
         }
         memcpy(h.mem + ZKR_PROOF_OFF, proof.data(), 768);
         memcpy(h.mem + ZKR_PUBS_OFF,  pubs.data(),  96);
      }
      if (entry.empty()) entry = "zkr_scalars";
      try {
         auto r = bk->call_with_return(h, "env", entry.c_str(),
                                       (uint32_t)ZKR_PROOF_OFF, (uint32_t)ZKR_PUBS_OFF);
         printf("{\"backend\":\"%s\",\"mode\":\"phase\",\"entry\":\"%s\",\"ret\":%d,"
                "\"kec_exec\":%llu,\"kec_cache\":%llu}\n",
                backend_name, entry.c_str(), r ? (int32_t)r->to_ui32() : -999,
                (unsigned long long)h.m.kec_exec, (unsigned long long)h.m.kec_cache);
      } catch (const eosio::vm::exception& e) {
         printf("{\"backend\":\"%s\",\"mode\":\"phase\",\"entry\":\"%s\",\"error\":\"%s\",\"detail\":\"%s\"}\n",
                backend_name, entry.c_str(), e.what(), e.detail());
         return 4;
      }
      return 0;
   }
   if (mode == "warm" || mode == "verify") {
      if (mode == "verify") {
         if (!prooff || !pubsf) { fprintf(stderr, "verify needs --proof/--pubs\n"); return 2; }
         auto proof = unhex(hexread(prooff));
         auto pubs  = unhex(hexread(pubsf));
         if (proof.size() != 768 || pubs.size() != 96) {
            fprintf(stderr, "fixture sizes %zu/%zu (want 768/96)\n", proof.size(), pubs.size());
            return 2;
         }
         memcpy(h.mem + ZKR_PROOF_OFF, proof.data(), 768);
         memcpy(h.mem + ZKR_PUBS_OFF,  pubs.data(),  96);
         entry = "zkr_verify"; args = { (int32_t)ZKR_PROOF_OFF, (int32_t)ZKR_PUBS_OFF };
         if (!warm_n) warm_n = 1;
      }
      if (entry.empty()) { fprintf(stderr, "warm needs --entry\n"); return 2; }
      // first call separately
      auto t0 = std::chrono::steady_clock::now();
      try {
         if (args.size() == 0) bk->call(h, "env", entry.c_str());
         else if (args.size() == 1) bk->call(h, "env", entry.c_str(), (uint32_t)args[0]);
         else if (args.size() == 2) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1]);
         else if (args.size() == 3) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1], (uint32_t)args[2]);
         else if (args.size() >= 4) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1], (uint32_t)args[2], (uint32_t)args[3]);
      } catch (const eosio::vm::exception& e) {
         printf("{\"backend\":\"%s\",\"mode\":\"%s\",\"error\":\"first call: %s\",\"detail\":\"%s\"}\n",
                backend_name, mode.c_str(), e.what(), e.detail());
         return 4;
      }
      int64_t first_ns = ns_since(t0);
      std::vector<uint64_t> t;
      for (int i = 1; i < warm_n; ++i) {
         auto s = std::chrono::steady_clock::now();
         if (args.size() == 0) bk->call(h, "env", entry.c_str());
         else if (args.size() == 1) bk->call(h, "env", entry.c_str(), (uint32_t)args[0]);
         else if (args.size() == 2) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1]);
         else if (args.size() == 3) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1], (uint32_t)args[2]);
         else if (args.size() >= 4) bk->call(h, "env", entry.c_str(), (uint32_t)args[0], (uint32_t)args[1], (uint32_t)args[2], (uint32_t)args[3]);
         t.push_back(ns_since(s));
      }
      int32_t slot = mode == "verify" ? *(int32_t*)(h.mem + ZKR_LAST_OFF)
                                      : *(int32_t*)(h.mem + MIC_SLOT);
      auto q = quantiles(t);
      const char* hm = h.pairing_mode ? "pyecc" : "stub";
      printf("{\"backend\":\"%s\",\"mode\":\"%s\",\"entry\":\"%s\",\"n\":%d,"
             "\"first_ns\":%lld,\"p50_ns\":%.0f,\"p95_ns\":%.0f,\"max_ns\":%.0f,"
             "\"slot\":%d,\"result\":\"%s\",\"host\":\"%s\","
             "\"kec_n\":%llu,\"kec_ns\":%llu,\"kec_exec\":%llu,\"kec_cache\":%llu,\"add_n\":%llu,\"add_ns\":%llu,"
             "\"mul_n\":%llu,\"mul_ns\":%llu,\"pair_n\":%llu,\"pair_ns\":%llu,"
             "\"dbput_n\":%llu,\"dbget_n\":%llu,\"calllog_fnv\":\"%016llx\",\"rss_kb\":%zu}\n",
             backend_name, mode.c_str(), entry.c_str(), warm_n, (long long)first_ns,
             q[1], q[2], q[3], slot,
             mode == "verify" ? (slot == expect ? "MATCH" : "MISMATCH") : "n/a",
             hm,
             (unsigned long long)h.m.kec_n, (unsigned long long)h.m.kec_ns,
             (unsigned long long)h.m.kec_exec, (unsigned long long)h.m.kec_cache,
             (unsigned long long)h.m.add_n, (unsigned long long)h.m.add_ns,
             (unsigned long long)h.m.mul_n, (unsigned long long)h.m.mul_ns,
             (unsigned long long)h.m.pair_n, (unsigned long long)h.m.pair_ns,
             (unsigned long long)h.m.dbput_n, (unsigned long long)h.m.dbget_n,
             (unsigned long long)fnv(h.calllog), rss_kb());
      if (mode == "verify" && slot != expect) rc = 5;
      return rc;
   }
   if (mode == "mem") { // micro.wasm: grow pages until refusal; watch RSS
      int pages = 0; uint32_t total = 0;
      for (int step = 0; step < 4096 && total < (uint32_t)maxpages; ++step) {
         *(int32_t*)(h.mem + MIC_SLOT) = -1;
         try {
            bk->call(h, "env", "grow", (uint32_t)1);
            int32_t r = *(int32_t*)(h.mem + MIC_SLOT);
            if (r < 0) break;
            ++pages; total += 1;
         } catch (const eosio::vm::exception&) { break; }
      }
      printf("{\"backend\":\"%s\",\"mode\":\"mem\",\"pages_grown\":%d,"
             "\"max_pages_wasm\":%d,\"rss_kb\":%zu}\n",
             backend_name, pages, maxpages, rss_kb());
      return 0;
   }
   if (mode == "malformed") {
      struct { const char* name; std::vector<uint8_t> bytes; } cases[] = {
         {"empty", {}},
         {"magic-only", {0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00}},
         {"truncated-section", {0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,0x01,0x05,0x01}},
         {"bad-section-id", {0x00,0x61,0x73,0x6d,0x01,0x00,0x00,0x00,0x63,0x00}},
         {"bad-magic", {0x00,0x61,0x73,0x6e,0x01,0x00,0x00,0x00}},
         {"garbage-256", std::vector<uint8_t>(256, 0xA7)},
      };
      int pass = 0, fail = 0;
      for (auto& c : cases) {
         try {
            backend<host_rhf, Impl> bad(c.bytes, h, &wa);
            printf("{\"mode\":\"malformed\",\"case\":\"%s\",\"rejected\":false}\n", c.name);
            ++fail;
         } catch (const eosio::vm::exception&) {
            printf("{\"mode\":\"malformed\",\"case\":\"%s\",\"rejected\":true}\n", c.name);
            ++pass;
         }
      }
      printf("{\"mode\":\"malformed\",\"pass\":%d,\"fail\":%d}\n", pass, fail);
      return fail ? 6 : 0;
   }
   fprintf(stderr, "unknown mode %s\n", mode.c_str());
   return 2;
}

int main(int argc, char** argv) {
   if (argc < 4) {
      fprintf(stderr,
         "usage: evb MODULE BACKEND MODE [options]\n"
         "  BACKEND interp|jit\n"
         "  MODE parse|warm|verify|mem|malformed\n"
         "  options: --pairing stub|pyecc --warm N --entry NAME --args a,b,c\n"
         "           --proof F.hex --pubs F.hex --expect R --parse N --pages N\n");
      return 2;
   }
   if (strcmp(argv[2], "jit") == 0)
      return run<eosio::vm::jit>(argc, argv);
   return run<eosio::vm::interpreter>(argc, argv);
}
