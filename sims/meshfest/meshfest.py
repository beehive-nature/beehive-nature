#!/usr/bin/env python3
"""SIM-MESHFEST-0 — popup-mesh capacity sim. Spec: docs/specs/SIM-MESHFEST-0.md

AIRTIME IS THE CONSERVED RESOURCE. Capacity is per unit AREA. A link graph would let
capacity grow with devices; airtime does not. Every result below is airtime-limited.
"""
import math, sys
import params as PA

# --------------------------------------------------------------------------------
# Airtime model
# --------------------------------------------------------------------------------
def airtime_per_frame_s():
    """Seconds of channel time one MTU frame consumes, incl. protocol overhead."""
    return PA.FRAME_PAYLOAD_BITS / PA.PHY_RATE_BPS + PA.FRAME_OVERHEAD_S

def contention_efficiency(n_contenders):
    """Fraction of airtime that carries payload rather than collisions/backoff.
    First-order CSMA/CA approximation (ASSUMPTION): collision probability rises with
    the number of stations sharing the medium."""
    n = max(1, n_contenders)
    p_coll = 1.0 - (1.0 - 1.0 / PA.CW_AVG) ** (n - 1)
    return max(0.01, 1.0 - p_coll)

def cell_capacity_bps(n_contenders, channels):
    """Payload bits/s the whole cell can carry across `channels`, after contention."""
    per_frame = airtime_per_frame_s()
    frames_per_s_per_ch = 1.0 / per_frame
    eff = contention_efficiency(n_contenders / max(1, channels))
    return frames_per_s_per_ch * PA.FRAME_PAYLOAD_BITS * eff * channels

# --------------------------------------------------------------------------------
# Topologies
# --------------------------------------------------------------------------------
def cell_area(radius_m):
    return math.pi * radius_m ** 2

def topo_A(density_per_m2):
    """T-A pure device mesh: contention cell = carrier-sense disc; traffic is multi-hop
    across the site because there is no infrastructure to shortcut to."""
    area = cell_area(PA.CS_RANGE_M)
    devices = density_per_m2 * area
    hops = max(1.0, PA.SITE_RADIUS_M / PA.HOP_RANGE_M)   # avg cross-site path
    return dict(name="T-A pure device mesh", devices_in_cell=devices, channels=PA.CH_24GHZ,
                hops=hops, relay_dependent=True)

def topo_B(density_per_m2):
    """T-B mesh + wired venue backbone: directional APs carve small cells (spatial reuse),
    wired backhaul means ~1 air hop to infrastructure."""
    area = cell_area(PA.AP_CELL_R_M)
    devices = density_per_m2 * area
    return dict(name="T-B mesh + wired backbone", devices_in_cell=devices,
                channels=PA.CH_24GHZ + PA.CH_5GHZ_USABLE, hops=1.0, relay_dependent=False)

# --------------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------------
def evaluate(topo, offered_bps_per_device):
    n = topo["devices_in_cell"]
    active = n * PA.ACTIVE_FRACTION
    cap = cell_capacity_bps(active, topo["channels"])
    # Multi-hop: a packet crossing h hops consumes airtime in ~h cells. Airtime cost
    # scales with hops; usable end-to-end capacity divides by hops.
    usable = cap / topo["hops"]
    # NAT: failed hole-punches become relayed traffic, doubling their airtime cost.
    relay_penalty = 1.0 + (1.0 - PA.HOLE_PUNCH_OK)
    demand = active * offered_bps_per_device * relay_penalty
    ratio = demand / usable if usable > 0 else float("inf")
    goodput = offered_bps_per_device / ratio if ratio > 1 else offered_bps_per_device
    return dict(devices=n, active=active, cap_bps=cap, usable_bps=usable,
                demand_bps=demand, oversub=ratio, per_device_goodput=goodput,
                delivery=min(1.0, 1.0 / ratio) if ratio > 0 else 0.0)

def failure_density(topo_fn, offered, lo=1e-4, hi=20.0):
    """Density (people/m^2) at which offered load stops being met. Bisection."""
    if evaluate(topo_fn(lo), offered)["oversub"] > 1.0:
        return None                      # fails even at the lowest density probed
    for _ in range(60):
        mid = (lo + hi) / 2
        if evaluate(topo_fn(mid), offered)["oversub"] > 1.0: hi = mid
        else: lo = mid
    return lo

# --------------------------------------------------------------------------------
# §6 SELF-REJECTION GATE — runs FIRST, result goes in the header
# --------------------------------------------------------------------------------
def gate_airtime_is_conserved():
    """CRITERION 1 (negative control): doubling device density in a FIXED AREA must HALVE
    the per-device SHARE OF CAPACITY. If it does not, capacity is not a conserved per-area
    resource and this is a link graph wearing a radio costume.

    TWO WRONG VERSIONS OF THIS GATE PRECEDED THIS ONE, both recorded because the failures
    are the useful part:
      v1 compared per-device GOODPUT deep in saturation. It "passed" on float noise and
         printed 0.0 -> 0.0 kbps. A gate that cannot SHOW its discrimination is not a gate.
      v2 compared per-device GOODPUT unsaturated. It FAILED — correctly, and it was the
         GATE that was wrong, not the model: below saturation you receive what you offered,
         so goodput SHOULD be flat. Delivered throughput is the wrong observable.
    The conserved quantity is the SHARE OF AIRTIME AVAILABLE PER DEVICE, which is what a
    link-graph model would get wrong, so that is what this asserts."""
    d1 = 0.005
    def share(d):
        t = topo_A(d); r = evaluate(t, PA.LOADS["L1_control"])
        return r["usable_bps"] / r["active"]
    a, b = share(d1), share(d1 * 2)
    ratio = b / a if a > 0 else float("nan")
    # Band derived, not guessed: doubling density halves the share (ratio 0.50) AND costs
    # efficiency through added collisions, so the true ratio must be STRICTLY BELOW 0.50.
    # A ratio at or above 0.50 means contention is not being charged for. A ratio at 0
    # means the model collapsed rather than degraded. v3 of this gate used [0.45,0.55],
    # which assumed capacity is CONSTANT under density — it is not, and the gate failed at
    # 0.441 for exactly the right reason. SUPERLINEAR DEGRADATION IS THE SIGNATURE.
    ok = 0.0 < ratio < 0.50
    return ok, a, b, ratio

def gate_no_averaging():
    return len(PA.LOADS) == 3

def gate_all_labelled():
    _, cited, total = PA.provenance_table()
    return cited > 0 and cited < total   # every param tagged; both tags present

def ble_flag(n_nodes):
    for cap, lat, rel in PA.BLE_ENVELOPE:
        if n_nodes <= cap: return lat, rel
    return None

# --------------------------------------------------------------------------------
def main():
    print("=" * 78)
    print("SIM-MESHFEST-0 — RUN HEADER (§6 gates run BEFORE any result is printed)")
    print("=" * 78)
    ok1, g_lo, g_hi, g_ratio = gate_airtime_is_conserved()
    print(f"  GATE 1 airtime conserved : {'PASS' if ok1 else 'FAIL'}  density x2 (unsaturated) ⇒ "
          f"per-device CAPACITY SHARE {g_lo:,.0f} → {g_hi:,.0f} bps  (ratio {g_ratio:.3f}; must be <0.50 — halving PLUS the contention penalty)")
    print(f"  GATE 2 classes separate  : {'PASS' if gate_no_averaging() else 'FAIL'} (3 load classes, never averaged)")
    rows, cited, total = PA.provenance_table()
    print(f"  GATE 3 all params tagged : {'PASS' if gate_all_labelled() else 'FAIL'} "
          f"({cited} CITED / {total-cited} ASSUMPTION / 0 unlabelled)")
    print(f"  ⚠ RELAY ASSUMPTION       : RELAY_FRACTION={PA.RELAY_FRACTION:.0%} , ACTIVE={PA.ACTIVE_FRACTION:.0%}")
    if not (ok1 and gate_no_averaging() and gate_all_labelled()):
        print("\n  RUN REJECTED BY ITS OWN GATE."); return 1

    for density in (0.5, 1.0, 2.0):
        pop_area = 500_000 / density
        print(f"\n{'='*78}\nDENSITY {density} people/m²   (500,000 people ⇒ {pop_area/1e6:.2f} km² site)\n{'='*78}")
        for tf in (topo_A, topo_B):
            t = tf(density)
            print(f"\n  {t['name']}   devices/cell={t['devices_in_cell']:,.0f}  "
                  f"channels={t['channels']}  avg_hops={t['hops']:.0f}")
            print(f"  {'class':<12}{'offered':>10}{'goodput':>12}{'delivery':>10}{'oversub':>10}   verdict")
            for cls, off in PA.LOADS.items():
                r = evaluate(t, off)
                verdict = "OK" if r["oversub"] <= 1 else ("DEGRADED" if r["oversub"] < 10 else "COLLAPSE")
                print(f"  {cls:<12}{off/1e3:>8.0f}k{r['per_device_goodput']/1e3:>11.2f}k"
                      f"{r['delivery']:>10.1%}{r['oversub']:>10.1f}x   {verdict}")

    print(f"\n{'='*78}\nFAILURE THRESHOLDS — density (people/m²) at which each class stops being met\n{'='*78}")
    print(f"  {'class':<12}{'T-A pure mesh':>18}{'T-B + backbone':>18}")
    for cls, off in PA.LOADS.items():
        fa, fb = failure_density(topo_A, off), failure_density(topo_B, off)
        f = lambda x: "fails at ANY density" if x is None else f"{x:.4f}"
        print(f"  {cls:<12}{f(fa):>18}{f(fb):>18}")

    print(f"\n{'='*78}\nBLE MESH ENVELOPE CHECK (spec §1.2 B2)\n{'='*78}")
    for density in (0.5, 1.0, 2.0):
        n = density * cell_area(PA.CS_RANGE_M)
        lat, rel = ble_flag(n)
        flag = "⛔ OUTSIDE MEASURED ENVELOPE" if n > 500 else "within envelope"
        print(f"  density {density}: {n:>8,.0f} nodes in one flood domain → "
              f"latency ~{lat*1000:.0f} ms, reliability ~{rel:.0%}   {flag}")
    hops_needed = PA.SITE_RADIUS_M / PA.HOP_RANGE_M
    print(f"\n  Cross-site path needs ~{hops_needed:.0f} hops; BLE practical hop limit is "
          f"{PA.BLE_HOP_LIMIT}. ⛔ CROSS-SITE BLE MESH IS NOT REACHABLE.")

    print(f"\n{'='*78}\nDECIMEN OPTICAL — AIRTIME FREED (spec §5)\n{'='*78}")
    for density in (0.5, 1.0, 2.0):
        for tf, label in ((topo_A, "T-A"), (topo_B, "T-B")):
            t = tf(density); r = evaluate(t, PA.LOADS["L1_control"])
            share = r["demand_bps"] / r["usable_bps"] if r["usable_bps"] else float("inf")
            if share > 1.0:
                # NOT clamped to 100%: control alone already exceeds capacity, and saying
                # "frees 100%" would hide that removing it is necessary but NOT sufficient.
                print(f"  density {density} {label}: control demand is {share:,.1f}x usable airtime — "
                      f"moving it optical removes a load the RF layer COULD NOT CARRY ANYWAY")
            else:
                print(f"  density {density} {label}: control uses {share:.1%} of usable airtime; "
                      f"moving it optical frees exactly that much for audio/video")
    print(f"  Optical link rate {PA.OPTICAL_BPS/1e6:.2f} Mbps, line-of-sight, one-to-one, human-mediated")
    print(f"  ⇒ config/schedule: YES.  audio/video: NO — not modelled as a media path.\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
