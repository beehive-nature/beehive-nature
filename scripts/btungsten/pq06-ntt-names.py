"""SPEC-BTUNGSTEN-PQ-1 PQ06: the MIR names pq06-saw/ntt.saw needs.

Reads the linked MIR JSON of pq06-ntt and prints SAW let-bindings for
ml-dsa's NTT and inverse NTT, the eight inverse layers in the order
ntt_inverse calls them (so by length 1, 2, 4, ... 128), the Elem-times-
Polynomial product that ends ntt_inverse, multiply_ntt, the Elem<BaseField> add, sub and
mul instances (found by signature: two Elem arguments, an Elem result) and
neg (one Elem argument), and the ADTs Elem, Polynomial, NttPolynomial and
the hybrid-array Array inside them. Refuses (exit 1) unless each name is
found exactly once and ntt_inverse calls exactly eight layers.

usage: python3 pq06-ntt-names.py <linked-mir.json> > names.saw
"""
import json
import re
import sys

d = json.load(open(sys.argv[1]))
tys = {t["name"]: t["ty"] for t in d["tys"]}
adts = {a["name"]: a for a in d["adts"]}
fns = {f["name"]: f for f in d["fns"]}


def one(kind, xs):
    xs = sorted(set(xs))
    if len(xs) != 1:
        sys.exit(f"pq06-ntt-names: {kind}: {len(xs)} matches {xs}")
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


def elem_op(op, arity):
    return one(f"Elem {op}", [
        strip(f["name"]) for f in d["fns"]
        if re.search(rf"^module_lattice/[^:]+::algebra::\{{impl#\d+\}}::{op}::_inst[0-9a-f]+\[0\]$", f["name"])
        and len(f["args"]) == arity and all(a["ty"] in elem_tys for a in f["args"]) and f["return_ty"] in elem_tys
    ])


def callees(name):
    out = []
    for b in fns[name]["body"]["blocks"]:
        t = b["block"]["terminator"]
        if t["kind"] == "Call":
            fn = t["func"]
            ty = tys.get(fn.get("constant", {}).get("ty") or fn.get("data", {}).get("ty"), {})
            if ty.get("kind") == "FnDef":
                out.append(ty["defid"])
    return out


ntt = one("ntt", [n for n in fns if re.search(r"^ml_dsa/[^:]+::ntt::\{impl#\d+\}::ntt$", n)])
inv = one("ntt_inverse", [n for n in fns if re.search(r"^ml_dsa/[^:]+::ntt::\{impl#\d+\}::ntt_inverse$", n)])
mul_ntt = one("multiply_ntt", [n for n in fns if re.search(r"^ml_dsa/[^:]+::ntt::\{impl#\d+\}::multiply_ntt$", n)])
called = callees(inv)
layers = [c for c in called if re.search(r"^ml_dsa/[^:]+::ntt::ntt_inverse_layer::_inst[0-9a-f]+\[0\]$", c)]
if len(layers) != 8 or len(set(layers)) != 8:
    sys.exit(f"pq06-ntt-names: ntt_inverse calls {len(layers)} inverse layers {layers}")
scale = one("Elem * &Polynomial", [c for c in called if re.search(r"^module_lattice/[^:]+::algebra::\{impl#\d+\}::mul::_inst[0-9a-f]+\[0\]$", c)])
sf = fns[scale]
if len(sf["args"]) != 2 or sf["args"][0]["ty"] not in elem_tys:
    sys.exit(f"pq06-ntt-names: {scale} is not Elem * &Polynomial")

print(f'let elem_adt_name = "{elem}";')
print(f'let poly_adt_name = "{poly}";')
print(f'let npoly_adt_name = "{npoly}";')
print(f'let arr_adt_name = "{arr}";')
print(f'let add_name = "{elem_op("add", 2)}";')
print(f'let sub_name = "{elem_op("sub", 2)}";')
print(f'let mul_name = "{elem_op("mul", 2)}";')
print(f'let neg_name = "{elem_op("neg", 1)}";')
print(f'let ntt_name = "{strip(ntt)}";')
print(f'let ntt_inverse_name = "{strip(inv)}";')
for n, c in zip([1, 2, 4, 8, 16, 32, 64, 128], layers):
    print(f'let inv_layer_{n}_name = "{strip(c)}";')
print(f'let scale_name = "{strip(scale)}";')
print(f'let multiply_ntt_name = "{strip(mul_ntt)}";')
