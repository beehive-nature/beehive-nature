"""SIM-MESHFEST-0 parameters. EVERY value carries its provenance (spec §1).

Provenance tags:
  CITED      — from a named source, recorded in docs/specs/SIM-MESHFEST-0.md §1
  ASSUMPTION — chosen here; must be swept, never defended as measured
  DERIVED    — computed by the model; never an input
"""
from dataclasses import dataclass, field

P = {}  # name -> (value, tag, note)

def p(name, value, tag, note):
    P[name] = (value, tag, note); return value

# ---- Wi-Fi (802.11), spec §1.1 -------------------------------------------------
CLIENTS_PER_AP_OK   = p("CLIENTS_PER_AP_OK", 75, "CITED",
    "50-100 clients/AP for adequate airtime (high-density design guidance); midpoint used")
AP_STA_CAPACITY     = p("AP_STA_CAPACITY", 150, "CITED", "stadium-class AP supports 100-200 STAs; midpoint")
VENUE_PRECEDENT     = p("VENUE_PRECEDENT", 100_000, "CITED",
    "largest cited venue precedent (stadium). OUR TARGET IS 5x THIS — model extrapolates past source")
CH_24GHZ            = p("CH_24GHZ", 3, "ASSUMPTION", "non-overlapping 2.4 GHz channels (standard, not re-verified)")
CH_5GHZ_USABLE      = p("CH_5GHZ_USABLE", 8, "ASSUMPTION", "usable 5 GHz channels after DFS/power; VENUE+REGULATORY specific")
PHY_RATE_BPS        = p("PHY_RATE_BPS", 24e6, "ASSUMPTION", "effective MCS in a dense body-absorbing crowd, 2.4 GHz")
FRAME_OVERHEAD_S    = p("FRAME_OVERHEAD_S", 180e-6, "ASSUMPTION",
    "lumped DIFS+avg backoff+preamble+SIFS+ACK per frame")
FRAME_PAYLOAD_BITS  = p("FRAME_PAYLOAD_BITS", 1500*8, "ASSUMPTION", "MTU-sized frame")
CW_AVG              = p("CW_AVG", 32, "ASSUMPTION", "average contention window slots; first-order")

# ---- BLE mesh, spec §1.2 -------------------------------------------------------
BLE_ENVELOPE = p("BLE_ENVELOPE", [(50, 0.100, 0.985), (200, 0.300, 0.955),
                                  (500, 0.800, 0.890), (10**9, 1.500, 0.800)], "CITED",
    "(max_nodes, latency_s, reliability) — measured degradation curve; 500+ is >1s at <85%")
BLE_HOP_LIMIT = p("BLE_HOP_LIMIT", 6, "CITED", "TTL default 5; real degradation beyond 5-7 hops; midpoint")
BLE_PAYLOAD_B = p("BLE_PAYLOAD_B", 13, "CITED", "typical 11-15 byte payload")

# ---- Geometry / crowd, spec §1.3 -----------------------------------------------
CS_RANGE_M   = p("CS_RANGE_M", 50.0, "ASSUMPTION", "phone carrier-sense radius in open crowd, 2.4 GHz")
HOP_RANGE_M  = p("HOP_RANGE_M", 30.0, "ASSUMPTION", "reliable phone-to-phone hop distance in a body-dense crowd")
SITE_RADIUS_M= p("SITE_RADIUS_M", 500.0, "ASSUMPTION", "multiday festival site radius")
AP_CELL_R_M  = p("AP_CELL_R_M", 25.0, "ASSUMPTION",
    "T-B directional-AP cell radius; CITED basis is <=30deg beamwidth sectorisation for spatial reuse")

# ---- Devices / battery / churn, spec §1.3 — ALL ASSUMPTION, ALL SWEPT ----------
RELAY_FRACTION = p("RELAY_FRACTION", 0.20, "ASSUMPTION",
    "fraction sustaining volunteer relaying. THE RESULT DEPENDS ON THIS — reported with every run")
ACTIVE_FRACTION= p("ACTIVE_FRACTION", 0.30, "ASSUMPTION", "fraction transmitting concurrently")

# ---- Load classes, spec §4 -----------------------------------------------------
LOADS = p("LOADS", {"L1_control": 2e3, "L2_audio": 64e3, "L3_video": 1.5e6}, "ASSUMPTION",
    "per-device offered bits/s: control/gossip, audio, video")

# ---- NAT / uplink, spec §1.4 ---------------------------------------------------
HOLE_PUNCH_OK = p("HOLE_PUNCH_OK", 0.70, "ASSUMPTION", "p2p hole-punch success behind CGNAT; failures become relayed")

# ---- Decimen optical, spec §5 --------------------------------------------------
OPTICAL_BPS = p("OPTICAL_BPS", 128e3*8, "CITED", "~128 KB/s phone-to-phone (L-VERIFY receipt)")

def provenance_table():
    rows = [(k, v[1], v[2]) for k, v in P.items()]
    n_cited = sum(1 for r in rows if r[1] == "CITED")
    return rows, n_cited, len(rows)
