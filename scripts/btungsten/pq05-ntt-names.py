"""SPEC-BTUNGSTEN-PQ-1 PQ05: the MIR names pq05-saw/ntt.saw needs.

Reads the linked MIR JSON of pq05-ntt and prints SAW let-bindings for
ml-kem's NTT and inverse NTT, the Elem<BaseField> add, sub and mul instances
(found by signature: two Elem arguments, an Elem result), and the ADTs
Elem, Polynomial, NttPolynomial and the hybrid-array Array inside them.
Refuses (exit 1) unless each name is found exactly once.

usage: python3 pq05-ntt-names.py <linked-mir.json> > names.saw
"""
import json
import re
import sys

d = json.load(open(sys.argv[1]))
tys = {t["name"]: t["ty"] for t in d["tys"]}
adts = {a["name"]: a for a in d["adts"]}


def one(kind, xs):
    xs = sorted(set(xs))
    if len(xs) != 1:
        sys.exit(f"pq05-ntt-names: {kind}: {len(xs)} matches {xs}")
    return xs[0]


poly = one("Polynomial", [n for n in adts if re.search(r"^module_lattice/[^:]+::algebra::Polynomial::_adt", n)])
npoly = one("NttPolynomial", [n for n in adts if re.search(r"^module_lattice/[^:]+::algebra::NttPolynomial::_adt", n)])
arr_ty = adts[poly]["variants"][0]["fields"][0]["ty"]
arr = one("Array", [tys[arr_ty]["name"]] if tys.get(arr_ty, {}).get("kind") == "Adt" else [])
elem = one("Elem", [n for n in adts if re.search(r"^module_lattice/[^:]+::algebra::Elem::_adt", n)])
elem_tys = {k for k, v in tys.items() if v.get("kind") == "Adt" and v.get("name") == elem}


def strip(n):
    # SAW takes the path without the crate disambiguator and the [0] suffix
    return re.sub(r"/[0-9a-f]+::", "::", n).removesuffix("[0]")


def elem_op(op):
    return one(f"Elem {op}", [
        strip(f["name"]) for f in d["fns"]
        if re.search(rf"^module_lattice/[^:]+::algebra::\{{impl#\d+\}}::{op}::_inst[0-9a-f]+\[0\]$", f["name"])
        and len(f["args"]) == 2 and all(a["ty"] in elem_tys for a in f["args"]) and f["return_ty"] in elem_tys
    ])


ntt = one("ntt", [strip(f["name"]) for f in d["fns"] if re.search(r"^ml_kem/[^:]+::algebra::\{impl#\d+\}::ntt$", f["name"])])
inv = one("ntt_inverse", [strip(f["name"]) for f in d["fns"] if re.search(r"^ml_kem/[^:]+::algebra::\{impl#\d+\}::ntt_inverse$", f["name"])])

print(f'let elem_adt_name = "{elem}";')
print(f'let poly_adt_name = "{poly}";')
print(f'let npoly_adt_name = "{npoly}";')
print(f'let arr_adt_name = "{arr}";')
print(f'let add_name = "{elem_op("add")}";')
print(f'let sub_name = "{elem_op("sub")}";')
print(f'let mul_name = "{elem_op("mul")}";')
print(f'let ntt_name = "{ntt}";')
print(f'let ntt_inverse_name = "{inv}";')
