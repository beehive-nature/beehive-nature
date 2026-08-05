# CAL-1 — BNR PHYSICAL CALIBRATION TARGET SPECIFICATION

**Status:** normative. Issued under founder ruling, before Phase 1.
**Binds:** `docs/canonical-biometric-key.md` (§2.2 capture row; §7 thousand-year table, row "NIR 850 nm sensors, ≥200 px optics"), `docs/open-attested-capture-device.md` (§ optical BOM lines 79–96; §3 Link 3 / Link X; §6 ceremony).
**Closes:** the gap named in `canonical-biometric-key.md` §7 — *"bit-exactness needs a published physical calibration target spec, not just a software spec. This is currently missing and must be written."*

**Evidence tags used throughout:** `[D]` derived in this document from stated parameters; `[M]` measured, source cited; `[E]` estimate, with the pinning experiment named in §10.

---

## 1. Purpose and scope

BNR-K derives a canonical 188-bit key from iris texture through a frozen, versioned, integer-only fixed-point pipeline with published test vectors; given identical input pixels that pipeline yields an identical key on hardware not yet invented. The input pixels are not identical. They are the output of a physical capture chain — illumination spectrum and geometry, optics MTF and OTF phase, geometric mapping, sensor spectral response, radiometric transfer, readout timing, noise — and two chains imaging the same iris produce different pixels, hence different Gabor responses, hence a different key. **The software specification is therefore necessary and not sufficient; what is additionally required is a commensurability requirement: every conforming chain, past and future, must be correctable to one canonical virtual camera to within a stated error budget, and must prove it did so.** This document specifies the physical artifacts that make that provable — **CAL-1A**, a metrology plate from which each device derives its correction map, and **CAL-1B**, a canonical iris phantom whose published codeword a corrected chain must reproduce bit-exactly — together with their materials, their tolerances (all derived in §2 from one error budget), the device verification protocol and its binding to the secure element, the method by which a builder proves a newly made target is in specification with no reference sample, and the reduction of every dimension and optical property to SI constants that survive institutional collapse. Without this artifact the failure mode is not a visible error but a silent one: a device with excellent image quality by every published metric (ISO/IEC 29794-6 measures delivered pixels, and a miscalibrated chain can produce sharp, well-exposed, high-scoring pixels) that nonetheless re-derives a key at Hamming distance beyond `r = 0.12` from the enrolled one — a person locked out of their own identity, with no diagnostic and no operator to appeal to.

**Out of scope:** the frozen software pipeline itself (specified in `canonical-biometric-key.md`); enclosure, thermal and power design (in `open-attested-capture-device.md`); the append-only log (named there as the one genuine institutional dependency); ocular safety limits, which are governed by the then-current radiation-safety standard and must be re-verified against it, never inherited from this document.

---

## 2. The error budget

Every tolerance in §§3–8 is derived here. No tolerance in this document is asserted.

### 2.1 The ceiling

From `canonical-biometric-key.md` §1.3, Regime A (28-day cadence, syndrome re-issued each cycle, so drift never accumulates):

```
r            = 0.1200      key decode radius, fractional Hamming distance
mu           = 0.0500      intra-person mean HD                            [D from M]
sigma_joint  = 0.0210      intra-person joint std                          [D from M]
q            = 1e-2        permitted per-attempt failure  ->  z = 2.326

reproducibility floor  =  mu + z*sigma  =  0.0500 + 2.326 x 0.0210  =  0.0989
budget available       =  r - floor     =  0.1200 - 0.0989           =  0.0211
BUDGET ALLOCATED       =  0.0200                       (94.8% of available)
UNALLOCATED            =  0.0011
```

**Addition rule: arithmetic, not quadrature.** For two independent per-bit flip processes, `p_tot = p1 + p2 - 2*p1*p2`; at `p ~ 1e-2` the cross term is `2e-4` and is neglected conservatively. Two *coherent* phase offsets add as phasors and may reinforce, so the worst case is again linear. Quadrature would overstate the budget by roughly 3x. All contributions below are summed arithmetically.

**The unallocated 0.0011 is not reserve.** It is the residual of the ceiling arithmetic. Terms not enumerated in Table 2.6 — live-eye three-dimensional structure, tear film, corneal refraction not reproduced by a flat phantom (§10.6), thermal cycling of the mount, sensor-to-sensor quantum-efficiency spread — have **no allocation at all**. Two consequences are normative:

- **(N-2.1.a)** Every acceptance threshold in §5 is set at **half** its Table 2.6 allocation. The other half is held implicitly against the unenumerated.
- **(N-2.1.b)** If measurement shows any unenumerated term exceeding 0.005 HD, the response is to raise `n` or renegotiate `r` in `canonical-biometric-key.md`. It is *not* to tighten this document. The budget, not the target, is the thing that breaks.

### 2.2 The two master transfer functions

Everything below reduces to one of these two. State them once; use them everywhere.

**(T1) Coherent phase perturbation → HD.** Phase-quadrant bits are `sign(Re z)` and `sign(Im z)` of the Gabor response `z = A·exp(i·phi)`. Each bit has two sign boundaries per `2*pi`. `canonical-biometric-key.md` §2.2 specifies the reliability mask as **global, population-derived, published, identical for every human** — it selects *coordinates*, not per-capture bit magnitudes. There is therefore **no fragile-bit deadband**: a globally reliable coordinate can still land arbitrarily close to a quadrant axis for a given individual, so `phi` is taken uniform on `[0, 2*pi)` and the unattenuated result applies:

```
HD(dphi)   = |dphi| / pi                    d(HD)/d(dphi) = 0.318 per radian
dphi_max   = pi * (HD allocation)
```

> **Named relief valve.** If a per-capture magnitude gate is ever added to the pipeline, every coefficient derived from (T1) drops by 2–3x. That is the single largest available relief if the tolerances below prove unbuildable. It is recorded here as an explicit lever, not left as a silent assumption.

**(T2) Incoherent additive noise → HD.** With `z = A·exp(i·phi) + n`, `n` complex Gaussian with per-quadrature standard deviation `sigma_n`, and `rho = A/sigma_n` the **Gabor-band amplitude SNR** (not pixel SNR):

```
P_flip = (1/2pi) INTEGRAL Q(rho|cos phi|) dphi  ->  (2/pi)(0.3989)/rho  =  0.254/rho
HD     = 0.508 / rho                        (enrol and verify are independent draws)
```
valid for `rho >~ 3`.

### 2.3 The design point, and the three exact cancellations

Geometry at the measured design point (`open-attested-capture-device.md` line 94: ~343 px across an 11.5 mm iris, IMX219-class optics, 200 mm standoff, f/5.6, 1.12 µm pixels):

```
sampling            343 px / 11.5 mm                = 29.83 px/mm  (33.53 µm/px object)
magnification m     1.12 µm / 33.53 µm              = 0.0334
R_iris                                              = 171.5 px
R_pupil  (canonical p/i = 0.400)                    =  68.6 px
annulus  1.0 -> 2.2 R_p                             =  68.6 -> 150.9 px
annulus width W                                     =  82.3 px = 2.759 mm
annulus mid-radius R_mid                            = 109.8 px
```

**Frozen Gabor-bank assumption — must be published alongside the bank; all geometric tolerances scale as 1/N (see §10.4):**

```
N_r     = 4   cycles across the annulus       -> radial period  Lambda_r = 20.6 px = 0.690 mm
N_theta = 32  cycles around 2*pi              -> angular period Lambda_t = 21.6 px
f0 = 1 / 0.690 mm = 1.449 cycles/mm at the object plane
```

Three cancellations follow, and they determine what this document does *not* have to specify. Each is exact, not first-order.

**(C1) Global geometric scale — coefficient exactly zero.** The normalised radial coordinate is `rho = (R/R_p - 1)/1.2` with `R_p` measured **in the same frame** (`canonical-biometric-key.md` §2.2: the radial coordinate is referenced to the pupil, never the limbus). Under `R -> (1+s)R`, `R_p -> (1+s)R_p`:

```
rho' = ((1+s)R / (1+s)R_p - 1)/1.2 = rho          exactly
d(HD)/d(global scale) = 0
```

This is the most consequential line in the budget. Pupil-referencing — adopted to kill the contact-lens outer-boundary attack — buys exact immunity to focal length, standoff, sensor pitch and thermal expansion of the mount, for free. **A builder who does not know this will over-specify the mechanics by two orders of magnitude and still fail on distortion.** What survives is *differential* scale, i.e. distortion (§2.4 A1).

**(C2) Radiometric gain and black level — coefficients exactly zero.** The Gabor kernel is DC-free, `INTEGRAL g = 0`, so `INTEGRAL (I+b) g = INTEGRAL I g`: an additive offset cancels identically. A multiplicative gain `a > 0` gives `z -> a·z`, real positive, so every phase and every sign is unchanged. **`d(HD)/d(black level) = 0` and `d(HD)/d(gain) = 0`, identically.** Consequence: **CAL-1 requires no absolute radiometric reference at any point** — no traceable luminance, no absolute irradiance, no exposure standard. It needs a *shape* reference only. This removes what would otherwise be the hardest thousand-year metrology requirement in the document (§7.5).

**(C3) Symmetric blur — coefficient zero in the noiseless limit.** Blurring by a real, even PSF `h` gives `z -> H(f0)·z` with `H(f0)` real. A real positive multiplier changes no sign. **Defocus, diffraction and symmetric aberration cost nothing directly.** ISO/IEC 29794-6 §7.3 ("modulation > 50% at 1 lp/mm") therefore measures the wrong quantity for this pipeline, as does the depth-of-field emphasis in `open-attested-capture-device.md` line 96. MTF enters only by three indirect routes:

- **(C3a) Sign reversal past the first OTF zero — a cliff, not a slope.** If defocus is large enough that `H(f0) < 0`, every bit inverts, `HD -> 0.5`, catastrophically, and *silently*: the image merely looks soft. **Normative: `MTF(f0) >= 0.20` AND the sign of `H(f0)` verified positive (§5, M4).** No existing standard names this failure.
- **(C3b) Band SNR.** MTF attenuates signal, not sensor noise: `rho_band = MTF(f0)·rho_0`. Charged to A4.
- **(C3c) OTF phase.** Only PSF *asymmetry* rotates phase. Charged to A2.

**Margin note, and it is favourable.** At f/5.6 and 850 nm the diffraction cutoff is `1/(lambda·N) = 210 cy/mm` in image space, i.e. `210 x 0.0334 = 7.02 cy/mm` at the object. Sensor Nyquist is `1/(2 x 0.03353 mm) = 14.9 cy/mm` at the object. **The chain is optically band-limited well below Nyquist: there is no aliasing, and any structure on the target finer than 143 µm is invisible to it** — a fact §4.4 uses to build greys out of geometry. At `f0 = 1.449 cy/mm`, `nu/nu_c = 0.207`, and the diffraction-limited MTF is

```
MTF_diff = (2/pi)(arccos s - s*sqrt(1-s^2)),  s = 0.207
         = (2/pi)(1.3623 - 0.2025) = 0.738
```

so the `MTF(f0) >= 0.20` floor leaves a 3.7x margin for aberration and defocus. Sampling density never binds; OTF phase and band SNR bind.

### 2.4 Per-axis derivations

**A1 — Geometric mapping residual. Allocation 0.0070.**
What survives (C1) is the *differential* part of the mapping: radial distortion (changes the ratio `R(2.2)/R(1.0)`), anamorphism and astigmatic distortion (second angular harmonic), decentring distortion (first angular harmonic), and error in the estimate of `R_p` itself. All are expressed as one quantity: **`delta_geo`, the RMS residual displacement error of the fitted correction map over the iris field, after removing translation, rotation and isotropic scale** (the gauge that (C1) makes free). By (T1), `dphi_max = pi x 0.0070 = 0.02199 rad`. Two routes:

```
radial :  dphi = 2*pi*N_r*(delta/W)     ->  delta <= 0.02199 * 82.3 / (2*pi*4)  = 0.0720 px
angular:  dphi = N_theta*(delta/R_mid)  ->  delta <= 0.02199 * 109.8 / 32       = 0.0754 px
```

The two routes land within 5% of each other, which is a consistency check on the model, not a coincidence: the bank is roughly isotropic in cycles per unit length. Take the binding one.

> **A1 tolerance: `delta_geo <= 0.072 px RMS` over the iris field, translation-, rotation- and scale-removed. At 29.83 px/mm this is 2.41 µm in object space.**

Equivalently, via the pupil-radius route: a fractional error `e` in `R_p` gives `d(rho) = -e(rho + 0.833)`, mean `1.33e` over the annulus, so `HD = 2*N_r*1.33e = 10.6e`; allocation 0.0070 gives `e <= 6.6e-4`, i.e. **`R_p` reproducible device-to-device to 0.045 px.** Per-*capture* jitter in `R_p` is already inside `sigma_joint` and is not charged here; A1 constrains the systematic, device-to-device part only.

**Validation against a number the model was not fitted to.** `canonical-biometric-key.md` reports a cross-sensor term of **+0.06 HD** for two independent device builds `[M]`. Inverting A1: `HD = 0.06 -> dphi = 0.1885 rad -> delta = 0.617 px`. Two uncalibrated lens/sensor builds differing by ~0.6 px of radial mapping is exactly the right order. The model reproduces a measured number it did not use.

> **The job of CAL-1A, in one line: reduce residual geometric mapping mismatch from ~0.62 px to <=0.072 px — a factor of 8.6 — by measurement and software resampling, not by making identical lenses.**

**A2 — OTF phase asymmetry. Allocation 0.0040.** Only asymmetry rotates phase: coma, lateral chromatic aberration, motion smear, asymmetric pixel crosstalk. A PSF centroid displaced by `dx` px gives `dphi = 2*pi*dx/Lambda_r`, so `HD = 2*dx/Lambda_r`, i.e. `d(HD)/d(dx) = 2/20.6 = 0.097 per px`. A *global* centroid shift is a translation and cancels under the A1 gauge; the constrained quantity is the **variation of PSF centroid across the 11.5 mm iris**, i.e. field-dependent coma.

> **A2 tolerance: PSF centroid variation `<= 0.041 px` across the iris field (= 1.38 µm object space), measured as edge-spread-function skew (§5, M5).**

**A3 — Spectral centroid and bandwidth. Allocation 0.0030.** Not analytically derivable; stated as such. Two mechanisms:

- *Contrast scaling.* Melanin absorption falls smoothly across the NIR (~`lambda^-3.5` for eumelanin). This scales all Gabor amplitudes — a real positive multiplier, **phase-free** by (C2), costing only via SNR.
- *Differential penetration depth.* `depth = 1/sqrt(3 mu_a (mu_a + mu_s'))` grows by 20–40% over 700 → 850 nm in iris stroma. A longer wavelength images a **different depth section** of a three-dimensional tissue whose texture-forming structures (crypts, trabeculae, collarette) are 0.1–0.5 mm in scale. This is a genuine change of the source pattern, not a scaling, and it is the irreducible term.

Cross-wavelength iris matching gives ~0.06 HD for a 700 → 850 nm change, i.e. `4e-4 HD/nm` `[E]`. Specify at **`6e-4 HD/nm`** (1.5x conservatism, because `d(depth)/d(lambda)` is steeper near 850 nm).

```
allocation 0.0030 / 6e-4 HD/nm = +/- 5.0 nm
```

The constrained object is not the LED but the **system response** `S(lambda) = E(lambda) · T_optics(lambda) · QE_sensor(lambda)`:

> **A3 tolerance: `|centroid(S) - 850.0 nm| <= 5.0 nm`; `|FWHM(S) - FWHM(S_canonical)| <= 15 nm` `[E]`.**

Three traps, each individually larger than the whole 0.0030 allocation:

1. **LED junction-temperature drift.** GaAs NIR emitters shift `+0.27 nm/K`. The tolerance permits only `dT_j <= 18.5 K`. Stopping to f/5.6 for depth of field costs ~4x illumination (`open-attested-capture-device.md` line 96); a 30–60 K junction swing is normal under that drive. **Thermal drift alone overruns the spectral budget by 2–3x.** Fix in §3.5: the spectral reference is *not* on a bench plate used once at manufacture; it is **permanently in the field of view of every capture**, on the head-unit bezel. This converts a one-time calibration into a per-frame monitor, absorbs LED output ageing over 10 kh, and hardens the SE optical challenge for free.
2. **Interference bandpass filter angular shift.** `lambda(theta) ~ lambda_0 (1 - sin^2(theta)/(2 n_eff^2))`. Field half-angle `atan(55/200) = 15.4 deg`; with `n_eff = 1.8`: `dlambda = 850 x 0.0705/(2 x 3.24) = 9.2 nm` corner to centre. That is **1.8x the entire spectral tolerance, as a field gradient** — the two eyes in one binocular frame get different effective wavelengths, and a single-point spectral check cannot see it. The f/5.6 cone contributes only 1.0 nm and is fine. **The interference bandpass filter is disqualified at this field angle** (`open-attested-capture-device.md` line 81 must change). Permitted alternatives: an absorptive colour-glass long-pass (no angle dependence), the filter placed in telecentric space, or no filter with reliance on the LED band plus ambient subtraction.
3. **850 vs 860 nm.** `open-attested-capture-device.md` line 82 specifies an 850 nm iris illuminator and line 86 an 860 nm vein illuminator. 10 nm is 2x the iris tolerance. Vein contrast legitimately wants `>= 860 nm` (deoxyhaemoglobin absorption rises past the ~800–810 nm isosbestic point), so the anchors genuinely differ. **Normative resolution (N-2.4.a): two canonical wavelengths are declared — `lambda_iris = 850.0 nm` and `lambda_vein = 860.0 nm` — with two independent calibrations, two illuminator chains, and two entries in the attestation. This is not a bill-of-materials detail and must never again be left as one.**

**A4 — Gabor-band SNR. Allocation 0.0020.** By (T2), `HD = 0.508/rho_band`.

```
rho_band >= 0.508 / 0.0020 = 254        (48.1 dB, amplitude, in the Gabor band)
```

> **A4 tolerance: `rho_band >= 254` measured directly on the CAL-1A `f0` sine patch (§5, M6), and `MTF(f0) >= 0.20` with `sign H(f0) > 0` (C3a).**

The band SNR is not the pixel SNR: a Gabor kernel at `Lambda_r = 20.6 px` integrates of order `Lambda^2 ~ 4e2` pixels, giving roughly `sqrt(4e2)/2 ~ 10x` over pixel SNR after the DC-free weighting `[E]`. A sensor at the ISO/IEC 29794-6 §7.7 floor of 36 dB (amplitude 63) therefore delivers `rho_band ~ 630` before MTF, and `~ 470` at `MTF(f0) = 0.74`. **A4 is met with margin at the design point; it becomes binding only if illumination is reduced or exposure shortened.**

**A5 — Radiometric integral nonlinearity. Allocation 0.0010.** By (C2) only nonlinearity survives. With `I = a·L + b·L^2` and `L = L_0(1 + m(x))`:

```
I = [a L_0 + b L_0^2]            DC              -> killed by the DC-free kernel
  + [a L_0 + 2 b L_0^2] m        gain            -> phase-free by (C2)
  + b L_0^2 m^2                  distortion      -> THE ONLY SURVIVING TERM
```

The `m^2` product injects energy into the Gabor band from other spatial frequencies at a phase uncorrelated with the true one. With `INL = |b·L_0/a|` (fractional integral nonlinearity at mid-scale) and `kappa ~ 0.5` the in-band fraction for iris-like texture spectra `[E]`:

```
dphi ~ kappa * INL    ->    HD = kappa*INL/pi = 0.159 * INL
INL <= 0.0010 / 0.159 = 0.0063
```

> **A5 tolerance: `INL <= 0.63%` of the used range, *after* correction by the transfer curve fitted to the CAL-1A wedge. Equivalently, residual gamma `|gamma_res - 1| <= 0.050`** (from `|gamma-1|·m_rms/2 ~ 0.125|gamma-1| <= 0.0063`, taking `m_rms = 0.25`).

A linear CMOS sensor in range holds under 1% INL natively; after fitting and inverting a 16-step wedge, residual INL of 0.2–0.3% is routine, giving `HD ~ 0.0004`. **A5 is the cheapest axis, and existing chart standards over-invest in it.** The hard part is not the tolerance; it is making the steps out of materials specifiable in a document with no product names (§4.4).

**A6 — Illumination directionality. Allocation 0.0010.** Iris texture has three-dimensional relief; crypts are 0.1–0.4 mm deep. Under illumination at obliquity `psi`, Lambertian shading contributes a term proportional to the surface height gradient, which for a given spatial frequency is in **quadrature** with the albedo term. Let `s` = (shading-driven Gabor amplitude)/(albedo-driven Gabor amplitude). A quadrature admixture rotates phase by `dphi = d(s)`, so `HD = d(s)/pi`. With six LEDs on a ring of radius 25 mm at 200 mm standoff, `psi = 7.1 deg`, `tan psi = 0.125`, and `s ~ 0.06` `[E — the weakest empirical input in this budget; see §10.1]`. Since `s` scales with `tan psi`:

```
d(s) <= pi * 0.0010 = 3.14e-3    ->    d(s)/s <= 5.2%
```

> **A6 tolerance: illuminator ring radius / standoff ratio reproduced device-to-device to 5%, i.e. ring radius `25.0 +/- 1.3 mm` and standoff `200 +/- 10 mm`.**

Single-emitter failure check: one of six at 0.8x output shifts the illumination centroid by ~0.83 mm, `d(psi) = 0.24 deg`, `d(s) = 0.002`, `HD = 0.0006`. **Emitter-to-emitter radiant-intensity matching to 20% is sufficient** — a deliberately loose requirement, and the correct one.

**A7 — Illumination uniformity gradient. Allocation 0.0010.** The Gabor kernel is DC-free and narrowband, so a smooth multiplicative gradient is largely rejected; the residual is the derivative coupling, of order `g·Lambda_r` with `g` the fractional gradient per pixel.

```
HD ~ g*Lambda_r/pi   ->   g <= pi*0.0010/20.6 = 1.53e-4 per px
over the 343 px iris:  5.2% peak-to-peak
```

> **A7 tolerance: `<= 5% peak-to-peak across the iris`, `<= 15% across the 110 mm field.** This is *looser* than ISO 12233 §4.1 chart-illumination uniformity, and correctly so.

**A8 — Rolling-shutter row time and readout geometry. Allocation 0.0010.** The rolling shutter is used deliberately: the SE derives an optical pulse schedule from its nonce and fires it during readout, and the pulse's spatial band position encodes its firing time (`open-attested-capture-device.md` §Link X; line time ~19 µs at 3280x2464 `[D — measure on bench]`). Row time is therefore part of the calibrated chain, not a nuisance.

Relative head-camera motion during readout shears the image. Per-*capture* shear magnitude is inside `sigma_joint`; what A8 constrains is the **accuracy of the declared row time and readout model used to undo it**. With `N_rows = 343` across the iris, `t_row = 19 µs`, skew span `343 x 19 µs = 6.52 ms`, and typical slow head drift `v ~ 5 mm/s` `[E — see §10.8]`, a relative row-time error `eps` leaves residual shear

```
residual = eps * v * 6.52 ms = eps * 32.6 µm = eps * 0.97 px
```

Charging A8 through the angular route of (T1): `delta <= pi*0.0010*109.8/32 = 0.0108 px`, hence `eps <= 1.1%`.

> **A8 tolerance: measured `t_row` agrees with declared `t_row` to `<= 1.0%`, and line time is constant across the frame to `<= 1.0%`. Row order and first-row index are declared and verified. Measured against the SE clock using the challenge banding (§5, M8).**

### 2.5 Terms with coefficient exactly zero — do not specify them

Recorded so that a future revision does not reintroduce cost by "improving" them:

| quantity | coefficient | why |
|---|---|---|
| Global magnification / focal length / standoff / sensor pitch | **0** | (C1), pupil-referencing, exact |
| Thermal expansion of the mount (isotropic) | **0** | (C1) |
| Sensor black level / dark offset | **0** | (C2), DC-free kernel, exact |
| Illumination absolute level, exposure time, analogue gain | **0** | (C2), real positive multiplier, exact |
| Symmetric defocus, diffraction, symmetric aberration | **0** | (C3), while `H(f0) > 0` |
| Head tilt (roll) | **0** | derotation by the inter-pupil line in the same frame |

### 2.6 The allocation table

| # | Axis | Allocation (HD) | Governing transfer | Derived tolerance | §5 acceptance (half) |
|---|---|---:|---|---|---|
| A1 | Geometric mapping residual (distortion, anamorphism, decentre, `R_p` estimate) | 0.0070 | (T1), `dphi = 2 pi N_r delta/W` | `delta_geo <= 0.072 px` RMS, gauge-removed | `<= 0.036 px` |
| A2 | OTF phase asymmetry (field coma, lateral chromatic, smear) | 0.0040 | (T1), `HD = 2 dx/Lambda_r` | PSF centroid variation `<= 0.041 px` | `<= 0.021 px` |
| A3 | Spectral centroid + bandwidth of `S(lambda)` | 0.0030 | `6e-4 HD/nm` `[E]` | `+/- 5.0 nm` centroid; `+/- 15 nm` FWHM | `+/- 2.5 nm`; `+/- 7.5 nm` |
| A4 | Gabor-band SNR (MTF magnitude x photon/read noise) | 0.0020 | (T2), `HD = 0.508/rho` | `rho_band >= 254`; `MTF(f0) >= 0.20`, `H(f0) > 0` | `rho_band >= 508` |
| A5 | Radiometric nonlinearity residual | 0.0010 | `HD = 0.159 INL` | `INL <= 0.63%` FS post-correction | `<= 0.32%` |
| A6 | Illumination directionality (shading admixture) | 0.0010 | (T1), `HD = d(s)/pi` | ring/standoff ratio matched to 5% | 2.5% |
| A7 | Illumination uniformity gradient | 0.0010 | `HD = g Lambda_r/pi` | `<= 5%` p-p across iris | `<= 2.5%` |
| A8 | Rolling-shutter row time / readout geometry | 0.0010 | (T1), angular route | `t_row` accurate and constant to `1.0%` | `0.5%` |
| | **TOTAL ALLOCATED** | **0.0200** | | | |
| | *unallocated residual of the ceiling* | *0.0011* | | **not reserve** — see (N-2.1.a/b) | |

### 2.7 Requirement on the target itself

A calibration target must be better than the residual it is used to remove. **Rule: the target's own systematic error contributes no more than one third of the axis it governs** (a third contributes 1/3 in the arithmetic sum, i.e. under 0.0024 HD across A1+A2, and leaves the measurement dominated by the device, not the artifact).

```
A1 target accuracy  =  0.072 px / 3  =  0.024 px  =  0.024 / 29.83 mm  =  0.80 µm
                       over the 110 mm field                          =  7.3 ppm
```

> **This single number — 0.80 µm of *systematic* form error over 110 mm, 7.3 ppm — selects the manufacturing process (§4.2) and is the hardest requirement in the document.**

It is not, however, a per-point requirement, and the difference is what makes CAL-1A buildable. §3.2 places a lattice of which **212 fiducials survive the omission windows** (§3.7), fitting a 13-parameter mapping model: 424 scalar measurements, over-determination ratio 32.6. **Random, uncorrelated per-fiducial position error averages down by `sqrt(212/13) = 4.04`.**

```
random per-point position tolerance  =  0.80 µm x 4.04  =  3.2 µm   -> specify 3.0 µm
systematic / low-order form error    =  0.80 µm                     -> specify 0.80 µm
```

And the dominant *systematic* error of a ruled lattice is pitch error, which is a global scale error, which **cancels exactly by (C1)**. What is left is low-order bow and trapezoid, which §6.2 shows how to measure and remove with no reference sample. *This is the load-bearing chain of the entire document: 7.3 ppm sounds unbuildable; 4.0 µm random plus a self-calibrated low-order figure is a Tuesday.*

---

## 3. Target geometry

Two artifacts, one specification.

- **CAL-1A — metrology plate.** A flat reflective plate from which a device derives its geometric correction map, its radiometric transfer curve, its OTF-phase and MTF metrics, and its row-time measurement.
- **CAL-1B — canonical iris phantom plate.** A flat reflective plate bearing two synthetic irides whose published feature vector and 188-bit codeword a corrected chain must reproduce. **Only CAL-1B closes the founder's stated gap. CAL-1A exists to make CAL-1B achievable and to diagnose why CAL-1B failed.**

### 3.1 Common conventions

- **Coordinate system.** Right-handed, origin at the plate's geometric centre on the front (patterned) surface. `+X` to the plate's right when viewed from the camera, `+Y` up, `+Z` toward the camera. All dimensions in millimetres. All angles in degrees.
- **Presentation.** Plate front surface normal to the optical axis within `0.5 deg`, at `200 +/- 10 mm` standoff, plate centre on the optical axis within `2 mm`. (These are loose because (C1) makes them nearly free; they matter only for keeping features in the field and inside depth of field.)
- **Active area.** `X` in `[-55.000, +55.000]`, `Y` in `[-41.000, +41.000]` — the 110 x 82 mm object field of the design point.
- **Substrate.** `160.0 x 120.0 x 12.0 mm`, front surface flat to `<= 10 µm` peak-to-valley over the active area (a `10 µm` sag at `m = 0.0334` is `0.33 µm` of image-space defocus-equivalent displacement, an order below A1's 2.41 µm, and it is a *symmetric* effect, hence free by (C3)). Edges square to `0.1 mm`. Three kinematic seats on the back face at `120 deg` on a `100.0 mm` bolt circle, for repeatable mounting and for the reversal measurement of §6.2.
- **Two fabrication classes are permitted and both are normative:**
  - **Class L (lithographic).** Pattern defined by photolithography or direct-write on a polished substrate; dark regions are an absorbing or structured layer, light regions a diffuse white layer. Achieves the `0.80 µm` systematic figure directly.
  - **Class M (mechanical).** Pattern defined by machining, jig-boring or laser ablation in a sintered ceramic plate. Achieves `4.0 µm` random per-point easily; relies on §6.2 self-calibration for the `0.80 µm` systematic figure. **Class M is the thousand-year path** and must remain buildable; Class L is the convenient path while lithography exists.

### 3.2 Zone F — the fiducial lattice

The primary metrological structure. A square lattice of dark circular marks on the diffuse white field.

```
pitch                     p = 5.0000 mm, both axes
columns  23 :  X = -55.000, -50.000, ... , +55.000
rows     17 :  Y = -40.000, -35.000, ... , +40.000
nominal count             23 x 17 = 391
mark form                 blind cylindrical cavity, D = 1.0000 mm, depth >= 10.00 mm
                          (aspect ratio >= 10, R_eff <= 0.005 -- see 4.3)
mark edge                 sharp, burr-free; edge radius <= 20 µm
```

**Lattice points falling inside a window listed in §3.7 are omitted.** The omitted set is published as an explicit index list, not left implicit, so that a mark counted missing is a defect and not a design feature.

**Why 1.0 mm marks.** At 29.83 px/mm a mark is 29.8 px across, with ~94 px of edge. Centroid estimation from an over-resolved dark disc on a bright field reaches `<= 0.02 px` per axis at the A4 SNR floor `[D]`. Marks are cavities, not printed dots, so their apparent centroid is illumination-independent: a cavity is dark from every direction, whereas a printed dot's centroid shifts with oblique illumination.

**Fitted model.** 13 parameters:

| group | parameters | count | gauge? |
|---|---|---:|---|
| translation | `tx, ty` | 2 | **gauge — removed** |
| rotation | `theta` | 1 | **gauge — removed** |
| isotropic scale | `s` | 1 | **gauge — removed, free by (C1)** |
| anamorphic + shear | `a, b` | 2 | physical |
| principal point | `cx, cy` | 2 | physical |
| radial distortion | `k1, k2, k3` | 3 | physical |
| tangential distortion | `p1, p2` | 2 | physical |
| **total** | | **13** | 9 physical |

Measurements after the §3.7 omissions: `2 x 212 = 424`. Over-determination `424/13 = 32.6`. Centroid noise of `0.10 px` (a conservative 5x margin over the `0.02 px` estimate) propagates to a fitted-map error of `0.10 x sqrt(13/424) = 0.018 px`, inside A1's `0.072 px` and inside the `0.024 px` target-accuracy allowance of §2.7.

> **(N-3.2.a)** The correction map is defined **only up to translation, rotation and isotropic scale**. Implementations must not attempt to fix the gauge. Fixing it introduces an arbitrary convention that a later revision cannot reproduce, breaking commensurability (§9.3).

### 3.3 Zone E — MTF and OTF-phase features (slanted edges)

Five edge groups. Each group is a square field containing four straight edges forming a pinwheel: two near-vertical and two near-horizontal, each slanted **5.00 +/- 0.50 deg** from the respective pixel axis, dark-on-white on one side of the group and white-on-dark on the other, so that edge-spread-function skew from illumination asymmetry separates from skew from OTF asymmetry by sign reversal.

```
group      centre (X, Y) mm      size (mm)    purpose
E0         (  0.000,   0.000)    20 x 20      on-axis MTF, on-axis OTF phase
E1         (-46.000, +16.000)    16 x 16      field corner, upper left
E2         (+46.000, +16.000)    16 x 16      field corner, upper right
E3         (-46.000, -16.000)    16 x 16      field corner, lower left
E4         (+46.000, -16.000)    16 x 16      field corner, lower right
```

The corner groups are placed at `|X| = 46.000` rather than nearer the centre so that they do not overlie the two `30 mm` zones at `(+/-32.500, 0.000)` where the irides are imaged; the lattice there must stay dense (N-3.7.a). Each edge in E0 is `18.000 mm` long with `>= 6.000 mm` of clear field on each side; each edge in E1–E4 is `14.000 mm` long with `>= 4.000 mm` of clear field, which is `418 px` of edge — ample for e-SFR. Edge straightness `<= 0.5 µm` peak-to-valley over its length (that is `0.015 px`, one third of A2's `0.041 px`). Edge contrast: dark side is the §4.3 cavity structure or absorber (`R <= 0.02`), light side the §4.2 diffuse white (`R >= 0.90`); contrast ratio therefore `>= 45:1` at 850 nm.

**E0–E4 span the iris field.** The A2 metric is the *variation* of PSF centroid across the field, so the corner groups, not the centre group, carry the measurement; E0 provides the reference.

### 3.4 Zone Q — frequency sweep (band-limited, and it must include `f0` exactly)

A single strip, `60.000 x 12.000 mm`, centred at `(0.000, -33.000)`, containing **13 discrete sinusoidal patches** rather than a continuous sweep, because discrete patches are measurable by single-frequency demodulation with no windowing convention to freeze.

```
patch i, i = 0..12,  centre X = -27.500 + 4.583*i mm,  patch 4.000 x 12.000 mm
frequency nu_i (cycles/mm at the object):
  0.200, 0.350, 0.600, 1.000, 1.449, 2.000, 2.800, 3.600, 4.400, 5.200, 6.000, 6.600, 7.000
```

- **Patch index 4 is `nu = 1.449 cy/mm` = `f0` exactly.** It is the patch that A4 and (C3a) are measured on. It shall be marked on the plate by a notch in its border so it cannot be mis-indexed.
- Patches are oriented with bars **at `+45 deg` to both pixel axes** to avoid coincidence with sensor row/column structure. Patches `0..5` are repeated in the mirrored orientation (`-45 deg`) in Zones Q'a and Q'b (§3.5), so that anamorphism and astigmatism appear as a difference between the `+45` and `-45` readings at the same frequency. Patch 4 (`f0`) is present in both orientations and its two readings shall agree to within `5%`.
- Modulation depth: nominal peak-to-trough reflectance `0.90` to `0.10`. Sinusoids are realised by area-modulated dither (§4.4), so the "sinusoid" is a spatial duty-cycle modulation, not a grey ink.
- Patches at `nu >= 7.0 cy/mm` sit at the diffraction cutoff and are expected to read near zero; they are present to locate the cutoff and hence to detect a wrong aperture.

### 3.5 Zone W — reflectance step wedge

The upper strip band at `Y = +33.000` is shared between the wedge and the mirrored sine patches:

```
Zone W   : 40.000 x 12.000 mm, centred (  0.000, +33.000)   -- 16-step wedge
Zone Q'a : 14.000 x 12.000 mm, centred (-35.000, +33.000)   -- patches 0..2 mirrored
Zone Q'b : 14.000 x 12.000 mm, centred (+35.000, +33.000)   -- patches 3..5 mirrored
```

The wedge has **16 steps**, each `2.500 x 12.000 mm`, indexed `i = 0..15` from `X = -20.000` rightward. The ladder is **geometric in reflectance**, because the failure mode being defended against is ill-conditioning of the transfer-curve fit at the dark end, and the dark end is where the pupil and the iris crypts live:

```
R_i  =  0.9000 * (0.005556)^(i/15)  =  0.9000 * 0.70725^i
```

| i | `R_i` | i | `R_i` | i | `R_i` | i | `R_i` |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0.9000 | 4 | 0.2252 | 8 | 0.0564 | 12 | 0.0141 |
| 1 | 0.6365 | 5 | 0.1593 | 9 | 0.0399 | 13 | 0.00997 |
| 2 | 0.4502 | 6 | 0.1127 | 10 | 0.0282 | 14 | 0.00705 |
| 3 | 0.3184 | 7 | 0.0797 | 11 | 0.0199 | 15 | 0.00499 |

Dynamic range `180:1`. Each step is realised as a dither of the certified white and the certified dark (§4.4) at area fraction

```
a_i = (R_i - R_dark) / (R_white - R_dark)
```

recomputed by the builder from their own measured `R_white` and `R_dark`. **The area fractions, not the reflectances, are the fabrication primitive; the reflectances, not the area fractions, are the canonical quantity.** Neither the absolute values nor their canonicity are load-bearing — by (C2) only the *shape* of the transfer curve matters, and by §6.3 the shape is verifiable by counting.

Step-to-step boundaries must be straight to `20 µm` and each step must present `>= 2.0 x 10.0 mm` of clear interior after excluding a `0.25 mm` border, i.e. `>= 60 x 300 px = 18000 px` per step — enough that per-step mean is noise-free relative to A5.

### 3.6 Zone T — timing fiducial (row-time measurement)

A vertical bar array for measuring `t_row` against the SE clock. Twenty-one dark bars, each `1.000 mm` wide, `50.000 mm` tall, on `4.000 mm` pitch, spanning `X` in `[-40.000, +40.000]` (bar `j` centred at `X = -40.000 + 4.000 j`, `j = 0..20`), `Y` in `[-25.000, +25.000]`, **rendered in a 50% area-fraction dither** (§4.4) so that they are a *low-contrast* structure that does not interfere with Zone F centroiding but is trivially detectable by column-sum. The SE fires its pulse schedule during readout; the resulting illumination bands cross the bar array, and the intersection of a band edge with the known bar geometry locates the band to sub-row precision in both axes. Zone T overlays Zones F and E only; it does not enter Zones W, Q, Q'a or Q'b, whose radiometric and modulation measurements must not be perturbed. Where a bar meets a Zone F mark or a Zone E edge, **Zone T yields** — the bar is interrupted.

### 3.7 Omission windows

Zone F lattice points are omitted where they fall inside:

| window | `X` range (mm) | `Y` range (mm) | occupant |
|---|---|---|---|
| W0 | `[-11.0, +11.0]` | `[-11.0, +11.0]` | E0 |
| W1 | `[-55.0, -37.0]` | `[+7.0, +25.0]` | E1 |
| W2 | `[+37.0, +55.0]` | `[+7.0, +25.0]` | E2 |
| W3 | `[-55.0, -37.0]` | `[-25.0, -7.0]` | E3 |
| W4 | `[+37.0, +55.0]` | `[-25.0, -7.0]` | E4 |
| W5 | `[-43.0, +43.0]` | `[+26.0, +40.0]` | W, Q'a, Q'b |
| W6 | `[-31.0, +31.0]` | `[-40.0, -26.0]` | Q |

Omitted counts: W0 25, W1 16, W2 16, W3 16, W4 16, W5 51, W6 39; the windows are mutually disjoint, so **179 points are omitted and 212 remain** (`391 - 179`). This integer is published in the design table (§9.2) together with the explicit index list, and M3 (§5.2) tests against it. Over-determination `424/13 = 32.6`; map error `0.10 x sqrt(13/424) = 0.018 px` — inside budget. **The lattice, not the edges, is the geometric instrument; the windows are affordable.**

> **(N-3.7.a) Density where it is used.** At least **20 surviving marks shall fall within `15.000 mm` of each of `(-32.500, 0.000)` and `(+32.500, 0.000)`** — the two zones where an iris is actually imaged — so that the correction map is constrained where it matters and not merely on average. The layout above delivers **24** in each zone. Any future relocation of Zone E or of the omission windows shall be re-checked against this count before it is adopted.

### 3.8 Figure — CAL-1A, described precisely enough to draw

```
   Y
   |
+41+-------------------------------------------------------------+
   |  · · · · · · · · · · · · · · · · · · · · · · ·  (Zone F)     |
+33|  [Q'a: 3 sine patches] [ W : 16-step wedge ] [Q'b: 3 patches] |
   |  · · · · · · · · · · · · · · · · · · · · · · ·               |
+16|[E1]· · · · · ·(o L)· · · · · · ·(o R)· · · · · · · ·[E2]     |
   |16x16 · · · · · · · · · · · · · · · · · · · · · · ·  16x16    |
   |  · · · · · · · · · · · · · · · · · · · · · · · · ·           |
  0|  · · · · · · ·  [ E0  20 x 20 ]  · · · · · · · · ·    --- X  |
   |  · · · · · · · · · · · · · · · · · · · · · · · · ·           |
-16|[E3]· · · · · · · · · · · · · · · · · · · · · · · ·  [E4]     |
   |16x16 · · · · · · · · · · · · · · · · · · · · · · ·  16x16    |
   |  · · · · · · · · · · · · · · · · · · · · · · · · ·           |
-33|         [ Q : 13 discrete sine patches, 60x12 ]              |
   |  · · · · · · · · · · · · · · · · · · · · · · · · ·           |
-41+-------------------------------------------------------------+
  -55                            0                            +55

  (o L), (o R) mark the 30 mm-diameter zones at X = -32.500 and +32.500
  where an iris is imaged. They carry NO CAL-1A feature -- only lattice --
  and >= 20 marks must survive in each (N-3.7.a; this layout gives 24).
  On CAL-1B these two zones carry the iris phantoms instead.

  Overlay (Zone T): 21 vertical 50%-dither bars, 1.000 mm wide, 4.000 mm
  pitch, X = -40.000 + 4.000*j (j = 0..20), Y in [-25, +25], interrupted
  wherever they meet a Zone F mark or a Zone E edge. Zone T does not
  enter Zones W, Q, Q'a or Q'b.

  '·' = Zone F fiducial: blind cavity, D = 1.0000 mm, depth >= 10.00 mm,
        on a 5.0000 mm square lattice, X = -55 + 5i, Y = -40 + 5k.

  Each Zone E group is a 20 x 20 mm pinwheel of four 18 mm straight edges,
  slanted 5.00 deg from the pixel axes; the two on the group's left half are
  dark-on-white, the two on the right half white-on-dark.

  Field is diffuse white (Section 4.2). Substrate 160 x 120 x 12 mm.
  Three kinematic seats on the back at 120 deg on a 100.0 mm bolt circle.
```

### 3.9 CAL-1B — the canonical iris phantom plate

Same substrate, same Zone F lattice with its own omission windows, plus **two iris phantoms**:

```
phantom L centre   (-32.500, 0.000)          phantom R centre   (+32.500, 0.000)
inter-phantom centre distance                65.000 mm  (nominal inter-pupil)
sclera field       diameter 30.000 mm, diffuse white, R >= 0.90
limbus             diameter 11.5000 mm       (iris outer boundary)
pupil              diameter  4.6000 mm       -> p/i = 0.40000 exactly, the canonical
                                                dilation, inside the [0.30, 0.50] gate
pupil structure    blind cavity, depth >= 20.0 mm, aspect ratio >= 4, R_eff <= 0.005
iris texture       area-fraction dither pattern (Section 4.4) over the annulus
                   2.300 mm <= radius <= 5.750 mm
```

**Texture definition.** The texture is a published integer raster `P_v1`, `2048 x 2048` samples in canonical polar coordinates `(rho, theta)` with `rho` the pupil-referenced radial coordinate on `[0, 1]` mapping `1.0 -> 2.2 R_p` and `theta` on `[0, 2 pi)`, each sample an 8-bit area-fraction value. It is mapped to the annulus by the inverse of the canonical rubber-sheet transform. Constraints:

- **Band-limited.** `P_v1` shall contain no spatial-frequency content above `3.0 cy/mm` at the object plane (below the `7.02 cy/mm` optical cutoff, so the phantom is fully resolved and the chain is never the band-limiter).
- **Minimum feature** `>= 0.100 mm` at the object, for manufacturability in Class M.
- **Spectrally flat by construction**, because it is a dither of two certified materials and not a pigment gradient — so the phantom's own reflectance does not vary with `lambda` and cannot mask an A3 error.
- **Not derived from any human iris.** `P_v1` is generated by a published deterministic procedure from a published seed, and the procedure and seed are part of the design table (§9.2). A phantom derived from a real iris would place a real person's biometric in a published artifact.

**Published reference outputs, at five taps.** These are the mechanism by which bit-exactness is actually claimed:

| tap | quantity | comparison | threshold |
|---|---|---|---|
| T1 | corrected image raster over the phantom | RMS difference | tolerance, `<= 2.0%` FS |
| T2 | canonical rubber-sheet normalised raster | RMS difference | tolerance, `<= 2.0%` FS |
| T3 | fixed-point Gabor response vector | mean absolute phase error | tolerance, `<= 0.022 rad` (= A1+A2 combined) |
| T4 | gated feature vector `w` (400 coordinates) | fractional Hamming distance | `<= 0.010` |
| T5 | 188-bit codeword `K_ref` | **bit-exact equality** | exact |

The thresholds in this table are the *design* tolerances. The **acceptance** thresholds applied in §5 (metric M13) are half of them, per (N-2.1.a): T1 `<= 1.0%`, T2 `<= 1.0%`, T3 `<= 0.011 rad`, T4 `<= 0.005`. T5 has no half — bit-exact is bit-exact.

> **(N-3.9.a) Bit-exactness is achieved at the codeword, not at the pixel.** Tolerance at T1–T4 is converted into identity at T5 by the error-correcting code. Any implementation that demands bit-exactness at T1 or T2 has misunderstood the architecture and will fail forever on photon noise alone. The taps exist so that a T5 failure **localises**: a failure first appearing at T1 is radiometric or geometric, at T3 is spectral or OTF-phase, at T4 is gating or erasure, at T5 alone is a code or version mismatch.

**Named non-closure.** A flat phantom does not reproduce corneal refraction, the tear-film specular structure, or the three-dimensional relief that A6 depends on. CAL-1B validates the **chain**, not the **eye**. See §10.6 for the experiment that measures the residual and the condition under which a plano-convex NIR-transmitting dome becomes normative.

---

## 4. Materials

Specified as **process and measurable property**. No product name, no supplier, no brand appears in this section, and none may be added. Every acceptance criterion is checkable with a spectrophotometer and a microscope.

### 4.1 The trap that must be stated first

**Visible blackness and 850 nm blackness are nearly uncorrelated.** A builder holding "a black pigment" will silently mis-calibrate. A printed step wedge spanning 3% → 95% in the visible commonly compresses to **40% → 95% at 850 nm** — a dynamic range of `2.4:1` instead of `32:1`. The transfer-curve fit becomes catastrophically ill-conditioned at exactly the end that matters.

> **(N-4.1.a) Verification by eye is forbidden. Every reflectance level on every CAL-1 artifact shall be verified spectrophotometrically at 850 nm and across 800–900 nm. A target whose levels were checked visually is non-conforming regardless of its appearance.**

Disqualified outright, with the measured reason:

| material class | `R` at 550 nm | `R` at 850 nm | verdict |
|---|---:|---:|---|
| Dyed black anodised aluminium | ~0.04 | **0.15–0.40, rising steeply through 700–900** | **disqualified** |
| Non-carbon black inks, toners, azo/aniline dyes | 0.03–0.06 | **0.40–0.60** | **disqualified** |
| Silver film | 0.99 | 0.99 | **disqualified unless hermetic** — tarnishes to Ag2S |
| Aluminium film | 0.92 | 0.86, **not flat: interband dip near 800–830 nm** | **disqualified as a photometric reference** |
| Anodised aluminium, undyed | 0.5–0.7, sloped | humidity-dependent | **mounts only, never photometric** |

### 4.2 Diffuse white — the light end

Three permitted processes. All are binder-free; polyvinyl-alcohol and similar binders introduce C–H and O–H overtone structure inside the band.

**W-1 Pressed barium sulphate (primary; the most thousand-year-robust).**
```
purity            >= 99.9% BaSO4, mean particle size 1-2 µm, binder-free
compaction        >= 10 MPa uniaxial into a recess >= 5.0 mm deep
finish            struck flat with a hard straight edge, not polished
expected R(850)   0.98 - 0.99
```
Fragile, but **regenerable in minutes from any barium salt plus any sulphate**, at any technological level. That is why it is primary: fluoropolymer synthesis is not reproducible after a collapse; precipitating a sulphate is.

**W-2 Sintered polytetrafluoroethylene (working plate; the flattest).**
```
powder            5-50 µm
compaction        ~20 MPa cold press to bulk density 1.40-1.60 g/cm3
                  (vs 2.20 theoretical -> 30-36% void fraction; THE VOID FRACTION
                   IS WHAT SETS THE REFLECTANCE, and it is a physical quantity)
sinter            360-380 degC, 1-2 h
cool              < 1 degC/min through the 327 degC crystallisation point
expected R(850)   0.99 at >= 6 mm thickness, 0.98 at >= 4 mm
restoration       machine off 0.5-1.0 mm
```
Too dense and it goes translucent and `R` drops; too porous and it is friable. **Radiation-sensitive (chain scission) and contamination-prone.** Regenerability by material removal is a first-class property for a two-century artifact and is why W-2 is permitted despite its fragility.

**W-3 Sintered alumina, controlled porosity (permanent; structural; the only bezel-legal white).**
```
purity            >= 99.7% Al2O3, Fe < 50 ppm  (Fe(III) charge-transfer absorption
                  tails into the NIR and is the single dominant contaminant)
grain             1-3 µm
sinter            1500-1600 degC to 92-95% of theoretical density -- DELIBERATELY
                  LEFT POROUS, because the porosity is the diffuser; fully dense
                  alumina is translucent and fails
expected R(850)   0.90 - 0.96
restoration       fire to 600 degC (burns off organics), no material removal
```

**Acceptance, all three (spectrophotometer, 8-degree directional / hemispherical collection):**

| criterion | requirement |
|---|---|
| `R(850 nm)` | `>= 0.90` |
| spectral flatness | `|dR/dlambda| <= 2e-4 per nm` over 800–900 nm, i.e. `<= 2%` total swing |
| thickness asymptote | `R` changes by `< 0.1%` when thickness is increased by 2 mm (proves bulk, not substrate, is being measured) |
| lateral uniformity | `<= 1%` peak-to-peak over the active area |
| specular fraction | `<= 3%` of total at 8-degree incidence |

### 4.3 The dark end — geometry, not pigment

**D-1 Cavity array (recommended and primary).** Blind holes of aspect ratio `AR >= 10`, wall reflectance `rho`. Effective reflectance `R_eff ~ rho^N` where `N ~ AR` bounces; at `rho = 0.5, AR = 10`, `R_eff = 1e-3`.

```
form              blind cylindrical or conical holes
aspect ratio      depth/diameter >= 10
fill factor       >= 0.90 of the dark region's area
wall finish       matte, rho(850) <= 0.6
acceptance        R_eff(850) <= 0.005, measured over an area >= 5 x 5 mm
```

**Its reflectance is pure geometry.** No pigment to fade. Verifiable under a microscope. Refabricable by machining, by lithography, or by ablation. It ages by filling with dust — which is *inspectable* and *reversible*, unlike a dye that has bleached.

**D-2 Carbon black / soot (alternate).** Elemental carbon, no organic binder in the optical path.
```
expected R(850)   0.03 - 0.05, flat 400-2500 nm (pi -> pi* continuum)
acceptance        R(850) <= 0.05, |dR/dlambda| <= 2e-4 per nm over 800-900
```

**D-3 Structured silicon or femtosecond-laser-blackened metal (alternate).** `R(850) <= 0.01` and `<= 0.03` respectively; flat, geometric, but the process is harder to specify in closed form and both are permitted only where D-1 is mechanically impossible.

### 4.4 Greys — area-fraction dither, and this is the key move

**No grey material is specified anywhere in CAL-1, because no grey material can be specified in a way that survives.** Every intermediate reflectance on both plates — the wedge steps, the sine patches, the phantom texture, the Zone T bars — is realised as a fine binary dither of the certified white (§4.2) and the certified dark (§4.3).

```
R(a) = a * R_white + (1 - a) * R_dark
```

Consequences, all load-bearing:

1. **Reflectance becomes a geometric quantity.** `a` is an area fraction, measurable by counting under a microscope with a graticule. It does not fade, bleach, yellow or drift.
2. **Only two materials require photometric certification**, and §6.3 certifies both without a reference sample.
3. **The chain cannot see the dither.** Dither structure is placed above the optical cutoff derived in §2.3.

```
dither cell pitch          <= 25.0 µm at the object plane
spectrum                   blue-noise (void-and-cluster or equivalent);
                           NO periodic component; power below 14.0 cy/mm
                           shall be <= 1e-4 of total (14.0 cy/mm is the
                           sensor Nyquist at the object; the optical cutoff
                           is 7.02 cy/mm, giving 2x margin)
cell placement tolerance   <= 3.0 µm
area-fraction accuracy     |a_measured - a_nominal| <= 0.002 absolute,
                           over any 2.0 x 2.0 mm region
```

4. **Spectral flatness comes free.** A dither of two flat materials is flat. A grey pigment is not.
5. **Verification is counting, not photometry** (§6.3).

At the darkest wedge step, `a_15 ~ 0.00105`: in a `2.5 x 12.0 mm` step at 25 µm cells there are `48000` cells of which `~50` are white. That is countable and therefore certifiable. **Sparse-white is the correct dither polarity at the dark end** (isolated white cells on a cavity field), and dense-white at the light end.

### 4.5 Mounts and structure

Structural members: sintered alumina (W-3 grade, sealed) or any dimensionally stable ceramic or metal with coefficient of thermal expansion `<= 12e-6 /K` and known to `10%`. **Because global scale cancels by (C1), thermal expansion of the plate is nearly free** — a `12e-6 /K` plate over a `30 K` swing changes scale by `3.6e-4`, which contributes zero HD. What is *not* free is a **gradient** in temperature across the plate, which produces low-order figure change:

```
allowed low-order figure change = 0.80 µm over 110 mm = 7.3 ppm
with CTE 12e-6 /K:  permitted temperature GRADIENT across the plate = 0.61 K
```

> **(N-4.5.a) The plate shall be thermally equilibrated to within `0.5 K` across its active area before a calibration capture, verified by a temperature difference measurement between two points `>= 80 mm` apart. Absolute plate temperature is unconstrained.**

### 4.6 Ageing, restoration, and what to publish with the plate

Restoration is not an appendix. **In 2226, restoration is the supply chain.**

| material | dominant ageing vector | restoration | re-verification after restoration |
|---|---|---|---|
| W-1 BaSO4 | mechanical damage, contamination | re-press from powder | full §6.3 |
| W-2 PTFE | UV chain scission, contamination, creep | machine off 0.5–1.0 mm | §6.3 white ladder only |
| W-3 Al2O3 | organic deposition | fire to 600 degC | §6.3 white ladder only |
| D-1 cavity array | **particulate fill** (dominant, arid climates) | clean and inspect under microscope | `R_eff` re-measure |
| dither field | differential wear of white vs dark | not restorable — replace plate | full §6 |

**Quantified drift risk.** A cavity array at `rho = 0.5, AR = 10` gives `R_eff = 1e-3`. A 30% dust fill with `rho_dust ~ 0.15` raises the dark patch to `~0.05`. Against A5's `INL <= 0.63%` this is roughly `4x` over, i.e. **`~0.008 HD` from dust alone — 40% of the entire chain budget.** Hence (N-4.6.a):

> **(N-4.6.a) Every head unit shall carry a permanent white (W-3 sintered alumina) and a permanent dark (D-1 cavity array) reference **in the field of view of every capture**, on the bezel. Alumina and not BaSO4 or PTFE for the bezel: it is the only one of the three that is simultaneously immortal, mechanically robust, and cleanable by firing. This converts dark-end drift from a decadal unknown into a per-frame measurement, and hardens the SE optical challenge for free. BaSO4 is regenerable-but-fragile and is a bench-plate material only.**

**Fairness consequence, stated because no one else will.** The climate vectors above — heat, dust, humidity, high ultraviolet, low maintenance — are geographically correlated. The regions that drift fastest get the worst identity service, in a system whose entire claim is that it has no operator to appeal to. **Calibration drift is a fairness problem before it is a security problem.** §5.7 makes the response an availability policy, never a lockout.

---

## 5. The verification protocol

### 5.1 Captures

All captures are made under **SE-gated illumination with a live SE-issued optical challenge running** (§5.6). Burst length and cadence match the enrolment capture: 15 frames over 3 s.

| id | subject | conditions | purpose |
|---|---|---|---|
| C1 | CAL-1A | `200 mm`, plate at `0 deg` roll | primary geometry, MTF, OTF phase, wedge, timing |
| C2 | CAL-1A | `200 mm`, plate at `90 deg` roll | anamorphism / sensor-axis separation |
| C3 | CAL-1A | `200 mm`, plate at `180 deg` roll | **reversal**: separates plate figure from chain distortion (§6.2) |
| C4 | CAL-1A | `185 mm` and `215 mm` | defocus bracket; confirms `H(f0) > 0` across the working volume |
| C5 | CAL-1A | `200 mm`, 8 further poses: in-plane translations of `+/-1.7 mm` and `+/-2.3 mm` in `X` and `Y` (non-integer fractions of the 5 mm pitch, to break lattice aliasing) | self-calibration bundle (§6.2) |
| C6 | — | illuminators off, shutter as C1 | dark frame: black level, read noise, fixed-pattern |
| C7 | CAL-1A | illuminators on, defocused to `> 3x` blur | flat field: A7 uniformity, pixel response non-uniformity |
| C8 | CAL-1B | `200 mm`, `0 deg` | codeword verification, taps T1–T5 |
| C9 | bezel references | every capture, forever | per-frame spectral and dark-end monitor (N-4.6.a) |

### 5.2 Metrics and thresholds

Thresholds are **half** the Table 2.6 allocation, per (N-2.1.a).

| id | metric | computed from | pass |
|---|---|---|---|
| M1 | `delta_geo` — RMS residual of the 13-parameter fit over the iris field, gauge-removed | C1, C2, C3, C5 | `<= 0.036 px` |
| M2 | fit consistency — `chi^2` per degree of freedom of the 13-parameter fit | C1 | `0.5 <= chi2/dof <= 2.0` |
| M3 | fiducial detection completeness | C1 | `>= 98%` of the published lattice index list detected; `100%` within the iris field |
| M4 | `MTF(f0)` and sign of `H(f0)` | C1 patch 4, C4 | `MTF(f0) >= 0.20` at all of C1 and C4; `H(f0) > 0` at all |
| M5 | PSF centroid variation across the iris field, from ESF skew, sign-reversal-corrected | C1 groups E0–E4 | `<= 0.021 px` |
| M6 | `rho_band` at `f0` | C1 patch 4 with C6 noise | `>= 508` |
| M7 | residual `INL` after inverting the fitted transfer curve | C1 Zone W, 16 steps | `<= 0.32%` FS; dark-end conditioning: fit residual at steps 12–15 `<= 0.5%` FS |
| M8 | `t_row` measured vs declared; line-time constancy across frame | C1 Zone T with SE challenge banding | `|Delta t_row|/t_row <= 0.005`; constancy `<= 0.005` |
| M9 | `centroid(S)` and `FWHM(S)` | C9 bezel spectral monitor | `|centroid - 850.0| <= 2.5 nm`; `|FWHM - FWHM_canonical| <= 7.5 nm` |
| M10 | illumination uniformity, peak-to-peak across the iris field and across the 110 mm field | C7 | `<= 2.5%` and `<= 7.5%` |
| M11 | illuminator ring radius / standoff ratio | mechanical, declared and measured | within `2.5%` of canonical |
| M12 | dark-end reference reflectance drift vs commissioning | C9 bezel dark | `<= 1.0%` FS |
| M13 | **taps T1–T5 on CAL-1B** | C8 | T1 `<= 1.0%`, T2 `<= 1.0%`, T3 `<= 0.011 rad`, T4 HD `<= 0.005`, **T5 bit-exact** |
| M14 | predicted chain residual `HD_chain`, computed by substituting M1, M5, M6, M7, M8, M9, M10, M11 into the Table 2.6 transfer functions and summing arithmetically | all | `<= 0.0100` |

> **M13/T5 is the requirement. M1–M12 and M14 exist so that a T5 failure can be diagnosed and repaired rather than merely observed.**

### 5.3 Order of operations

1. C6, C7 → black level, read noise, PRNU, A7.
2. C1 Zone W → transfer curve; invert; **all subsequent metrics are computed on linearised data.** (Note that by (C2) this inversion changes no key bit; it is done because the *metrics* — MTF, centroid, SNR — are defined on effective exposure, not on delivered code values, exactly as ISO 12233 §4.7 requires.)
3. C1, C2, C3, C5 → 13-parameter map; M1, M2, M3.
4. C1, C4 → M4, M5, M6.
5. C1 Zone T + SE challenge → M8.
6. C9 → M9, M12.
7. Freeze the correction map. C8 → M13.
8. M14.

### 5.4 The correction map

The device stores, and the SE attests, a **canonical resampling map** `M` taking raw sensor coordinates to the canonical virtual camera's grid, together with the fitted radiometric transfer inverse and the declared row model.

```
M = { k1, k2, k3, p1, p2, cx, cy, a, b, transfer_curve[16 knots], t_row, row_order, first_row }
```

Serialised as **integers in a published fixed-point format**, hashed, and versioned with `cal_version`. Floating point anywhere in `M` is a thousand-year bug, for the same reason it is one in the pipeline.

> **(N-5.4.a) `M` is gauge-free: it contains no translation, rotation or isotropic scale term.** See (N-3.2.a).

### 5.5 Failure

**Reject, do not degrade** — the same law as every elective degree of freedom in `canonical-biometric-key.md` §2.2.

| failing metric set | device state | consequence |
|---|---|---|
| M13/T5 fails, M14 passes | `CAL_UNVERIFIED` | **no enrolment.** Re-derivation permitted, flagged. Diagnose from the T1–T4 tap that first exceeded tolerance. |
| M14 `> 0.0100` but `<= 0.0200` | `CAL_MARGINAL` | enrolment permitted with the measured `HD_chain` carried in the attestation; relying parties price it |
| M14 `> 0.0200` | `CAL_FAILED` | **no enrolment, no re-derivation without an explicit degraded-claim acknowledgement by the relying party** |
| M3 `< 98%`, or M4 sign negative | `CAL_INVALID` | the measurement itself is not trustworthy; no state may be claimed |
| no passing calibration within `N` SE monotonic-counter ticks | `CAL_STALE` | **degraded attestation claim, priced by the relying party** |

> **(N-5.5.a) A device shall never be bricked for a calibration failure.** Bricking manufactures exactly the lockout this architecture exists to avoid, and it does so preferentially in the regions that drift fastest (§4.6). Calibration state is a *claim*, carried in the attestation, priced by the relying party. It is never a kill switch.

### 5.6 Binding to the secure element

The mechanism that makes "this device is calibrated" a claim the device cannot forge cheaply.

1. **The calibration capture is not a special operation.** It is a capture of a physical object under SE-owned illumination. The SE fires its nonce-derived rolling-shutter pulse schedule during the CAL captures exactly as it does during an enrolment capture (~8.3 bits per pulse, ~33 bits over 4 pulses). A device fabricating its calibration frames must fabricate them **in real time, against an unpredictable challenge, on a bus the SE owns exclusively.**
2. **The challenge response is inside the attested object.** The SE signs

```
H( M  ||  challenge_nonce  ||  challenge_response_digest  ||  plate_id  ||
   plate_measurement_root  ||  cal_version  ||  se_counter )
```

3. **Zone T is what makes the challenge measurable on the plate.** The band positions are recovered against the known bar geometry, giving both `t_row` (M8) and the challenge response in one measurement.
4. **`plate_id` and `plate_measurement_root` are Log D leaves** (§5.8).

> **(N-5.6.a) Honest statement of what this does not prove.** `open-attested-capture-device.md` §Link 3 already concedes the general form: *no commodity part, open or closed, proves that ADC bytes came from photons rather than from a wire; the SE attests the key, never the sensor.* Calibration is exactly that class of claim. If the application processor computes `M` and the SE signs `H(M)`, **the SE has attested the processor's claim.** Once firmware is compromised, self-certification is free. The floor is therefore the cost of firmware compromise, bounded by reproducible builds plus the seal on the discrete SE, and the attacker's cheap path is an SE emulator at `[E] $50–200/unit`. **The verification loop adds no new break; it rides the worst existing one. Any weakening of the SE-emulator defence weakens calibration integrity by the same factor**, which is why out-of-band chain verification and 1–2% destructive sampling are non-optional rather than nice to have.

### 5.7 Cadence and drift

Because Regime A re-issues the syndrome every 28 days, geometric and radiometric drift **slower than 28 days is tracked out and never accumulates**. Therefore:

> **(N-5.7.a) A drift attack succeeds only if it is faster than the re-issue cadence, or if it is applied at enrolment.** That is the whole security statement about drift, in one line.

Full CAL-1A re-verification cadence: on commissioning; after any optical or mechanical service; and thereafter at the lesser of 24 months or whenever the per-frame bezel monitor (C9, M9, M12) exceeds half its threshold. Bezel monitoring is continuous and per-frame.

### 5.8 Log D and the population detector

A new log alongside the existing A/B/C. Leaf:

```
( plate_design_hash, plate_id, shop_id, fiducial_map_root,
  spectrophotometric_trace_root_850, process_class, date )
```

witness-cosigned like the others. Device attestation carries `H(plate_id || plate_measurement_root)`; relying parties require a Log D inclusion proof.

> **(N-5.8.a) Cross-fabrication attestation.** A plate design becomes acceptable only when **`>= 3` organisationally and geographically disjoint shops, on different processes, fabricate it and their measured maps agree within a published bound**. This is the same threshold, for the same reason, that makes reproducible builds work. Attacker cost: subvert `>= 3` disjoint fabs. Defender cost: one extra plate and one metrology run per shop, `[E] $2k–10k` per design, amortised to about `$0` per device.

> **(N-5.8.b) The document is authoritative; distributed CAD files are not.** The threat with the best economics is not a subverted factory — it is *publishing a convenient, slightly wrong plate file that builders download*, which costs about `$0` and scales perfectly. §9.2 therefore publishes a checksummed canonical numeric table so that any file is checkable against the paper.

> **(N-5.8.c) Population detector, always on, free.** Publish the population HD distribution **binned by `plate_id` and by geographic cell**. A biased batch appears as a `plate_id`-correlated mean shift; a drifting region appears as a cell-correlated mean shift, years before either shows up as lockouts. Alarm when a bin exceeds half its allocation. This detects, it does not prevent — and it runs forever at no cost.

**Why a biased plate is a denial-of-service weapon and not a key-forgery weapon, stated so a future reader does not mis-prioritise.** By (C1) and (C2), a pure-scale geometric bias and any affine radiometric bias are provably worthless to an attacker. What remains is a bias that imprints *fixed spatial structure* inside a retained Gabor band, making a fraction `f` of the `n = 400` bits identical across the whole calibrated population. Impostor HD then follows `Binomial(n(1-f), 1/2)/n` and the duplicate test at `t = 0.30` fires spuriously:

| `f` | `n_eff` | `z` at `k < 120` | per-pair | global false lockouts/yr `[D]` |
|---:|---:|---:|---:|---:|
| 0 | 400 | −8.0 | 4e-15 | **0.09** |
| 0.05 | 380 | −7.18 | 3.5e-13 | **~8** |
| 0.10 | 360 | −6.32 | 1.3e-10 | **~2,900** |
| 0.20 | 320 | −4.47 | 4.0e-6 | **enrolment denied globally** |

Superlinear over one octave. Forcing an actual *key* collision (mean impostor HD below `r = 0.12`) requires `f > 0.76`, which is physically out of reach. **Design limit `f <= 0.05`; acceptance `f <= 0.025`.** Note the asymmetry and remember it: **entropy-destroying bias produces false non-matches, which are loud; structure-injecting bias produces false duplicates, which are quiet and far more damaging.** By contrast, radiometric drift (including dust) is a *point* nonlinearity, which perturbs whichever bits sit near a quadrant boundary — and which bits those are is a property of the individual iris, not of the region. **Drift therefore costs availability, never confidentiality. Imprint costs both.**

---

## 6. Self-verification of the target itself

This is the section that makes the document survive. A builder in 2226 has good machining or lithography, a spectrophotometer, and nothing else — no reference plate, no calibration laboratory, no surviving sample. Everything below is a **self-consistency** method: it certifies the artifact against physics and arithmetic, not against another artifact.

### 6.1 The principle

Each certification below has the same shape: **construct two or more measurements whose ratio or difference is determined by geometry or by algebra, so that the unknown instrument response cancels.** No method here requires a known-good example of the thing being measured.

### 6.2 Geometry — reversal and self-calibration

**(a) Reversal separates plate error from instrument error, exactly.** Measure the plate at `0 deg` (C1) and at `180 deg` in its own plane (C3), using the kinematic seats so the mechanical registration repeats. Let `P(x)` be the plate's true departure from nominal and `I(x)` the instrument's (chain's) distortion. In the `0 deg` measurement the observation is `P(x) + I(x)`. In the `180 deg` measurement, the plate's error is spatially inverted while the instrument's is not, so the observation is `P(-x) + I(x)`. Hence

```
odd part of P(x)  =  [ obs_0(x) - obs_180(x) ] / 2      -- plate, isolated
even-symmetric residual = [ obs_0(x) + obs_180(x) ] / 2 = [P(x)+P(-x)]/2 + I(x)
```

The odd part of the plate error separates with **no reference whatsoever**. This is the classical straightedge- and rotary-table-reversal argument, and it is a theorem, not a technique. Adding the `90 deg` measurement (C2) and a mirror-flip measurement extends the separation to the even part up to a residual that is common to plate and instrument, and that common residual is bounded by (b).

**(b) Plate self-calibration by multiple views, and why its gauge freedom is exactly the pipeline's.** Image the plate in `N >= 9` poses (C1, C2, C3 and the eight translations of C5), with the same intrinsics throughout. Treat *both* the lens distortion parameters *and* the 2D positions of all `>= 240` fiducials as unknowns, and bundle-adjust. The system is identifiable **up to a global similarity transform of the plate** — translation, rotation and isotropic scale.

> **That un-identifiable gauge is precisely the gauge the pipeline is invariant to, by (C1) and (N-3.2.a). A builder therefore obtains absolute-quality distortion correction from a plate whose absolute scale they never measured.** This is the single most important statement in §6, and it is what removes the need for a reference sample.

Translations must be **non-integer fractions of the 5.0000 mm pitch** (`+/-1.7`, `+/-2.3 mm` as specified in C5) or the lattice aliases onto itself and the bundle becomes degenerate. Acceptance: the bundle's per-point position uncertainty `<= 4.0 µm` (§2.7 random allowance) and the low-order (`<= 2nd`-order polynomial) component of the recovered plate figure `<= 0.80 µm` peak-to-valley after gauge removal.

**(c) Independent arithmetic check — lattice closure.** The 23 columns span `110.0000 mm` by construction. Sum the 22 measured inter-column spacings; the sum must equal the directly measured overall span to within `0.80 µm`. Any accumulating pitch error appears here and nowhere else — and, being a pure scale error, is free anyway by (C1). The check is retained because it distinguishes *scale* error (free) from *bow* (not free).

**(d) Angle by closure.** Plane angle is dimensionless and self-realising: `N` nominally equal angular increments must sum to exactly one turn. Divide a full rotation into `N = 24` steps against any index and record the closure error; distribute it. This certifies the `5.00 deg` Zone E slant and the `90 deg` / `180 deg` reversal orientations to arcsecond level with no angle standard.

### 6.3 Radiometry — certify two materials, count everything else

**(a) The dark end certifies itself by a squaring relation.** Fabricate two cavity arrays in the same material with the same wall finish, at aspect ratios `AR = 10` and `AR = 20`. Then

```
R_10 = rho^10        R_20 = rho^20 = (R_10)^2
```

Measure both with the same (uncalibrated, arbitrary-gain) instrument. Form the ratio-of-ratios: the instrument's unknown gain and the unknown wall reflectance `rho` both cancel, and the **measured** `R_20 / (R_10)^2` must equal `1` within the instrument's noise. If it does, the model holds, `rho = (R_10)^(1/10)` is determined, and `R_10` is thereby certified **on an absolute scale with no absolute reference**.

Acceptance: `|R_20/(R_10)^2 - 1| <= 0.10`, and the deduced `R_10 <= 0.005`.

**(b) The white end certifies itself by thickness asymptote.** For a non-absorbing scatterer, `R` rises monotonically with thickness and asymptotes to the bulk value. Measure `R` at 2, 4, 6, 8 and 10 mm thickness. When two successive thicknesses agree within `0.1%`, the bulk value is reached. The *bulk* value of a non-absorbing scatterer is `1 - A` where `A` is the absorptance; combining with (a) — measure the white sample and the certified `R_10` cavity in the same instrument run, take the ratio, and the instrument gain cancels — **gives `R_white` absolutely.**

Acceptance: asymptote reached (`<0.1%` change over the last 2 mm) and `R_white >= 0.90` on the cavity-referenced scale.

**(c) Every grey certifies itself by counting.** Because §4.4 forbids grey materials, every intermediate level is an area fraction. Under a microscope with a graticule, count white cells in a region of known area. `a = N_white / N_total`. This is a *counting* measurement: it has no gain, no offset, no spectral response, and no drift.

Acceptance: `|a_counted - a_nominal| <= 0.002` absolute over any `2.0 x 2.0 mm` region, on `>= 12` regions distributed across each patch.

**(d) The transfer ladder therefore requires no photometric standard at all.** Two materials certified by (a) and (b) plus counting by (c) yields all 16 wedge steps and all 13 sine patches. And by (C2) even the ladder's *absolute* values do not matter — only its *shape*, which counting delivers exactly.

**(e) The spectrophotometer's own wavelength scale is certified by atomic lines** — see §7.4. Its photometric scale is certified by (a).

### 6.4 MTF features

Edge straightness is certified by the §6.2(a) reversal (an edge is a one-dimensional case of the same theorem). Edge contrast is certified by §6.3(a) and (b). The `5.00 deg` slant is certified by §6.2(d). Sine-patch frequency accuracy is certified by counting cycles against the Zone F lattice, which is the plate's own length reference: patch 4 shall contain `1.449 cy/mm x 4.000 mm = 5.796` cycles across its width, and the cycle count against the lattice is a counting measurement.

### 6.5 The published invariant set

§9.2 publishes a table of **dimensionless ratios** — fiducial pitch to phantom limbus diameter, phantom pupil to limbus (`0.40000`), wedge area fractions, sine-patch frequency ratios, edge slant angles, cavity aspect ratios. A builder checks ratios. Ratios are immune to the one thing a builder without a length standard cannot check — absolute scale — and absolute scale is exactly what the pipeline does not care about. **A plate that satisfies every published ratio and fails only in absolute scale is conforming.**

### 6.6 What self-verification cannot catch, stated plainly

An over-determined fit catches sloppy error. It does **not** catch a self-consistent low-order radial-distortion bias deliberately written into a mask, because such a bias is exactly a valid solution of the plate's own geometry. §6.2(a) reversal catches its odd part; §6.2(b) self-calibration catches it only insofar as it is not degenerate with the lens model — and a mask edit can be made nearly degenerate. **The residual defence is organisational, not optical: (N-5.8.a) cross-fabrication by `>= 3` disjoint shops, plus (N-5.8.c) the population detector.** No amount of cleverness inside one plate replaces those.

---

## 7. Traceability to SI

Every quantity in this document reduces to a defining constant of the SI or to a dimensionless count. Nothing reduces to an institution, an artifact held elsewhere, or a company.

### 7.1 Time

The second is defined by the caesium-133 ground-state hyperfine transition frequency, **exactly `9 192 631 770 Hz`**. Any successor optical-clock definition is a redefinition of the same physical quantity and remains commensurable. Used for: `t_row` (A8, M8), exposure, and the SE's monotonic counter cadence.

### 7.2 Length

The metre is defined by the speed of light in vacuum, **exactly `c = 299 792 458 m/s`**, together with the second. Practical realisation, in decreasing order of instrument requirement:

1. **Interferometric.** Measure the optical frequency `f` of a single-mode source against the frequency standard; `lambda_vac = c/f`; correct for the refractive index of air; count fringes over the plate's span. This realises the metre from first principles with a laser and a counter.
2. **Atomic-line interferometry.** Use a low-pressure discharge lamp line (§7.4) in a Michelson or Fizeau interferometer. The line wavelengths are reproducible physical constants of the atom, not artifacts.
3. **Crystal lattice.** The lattice parameter of a silicon single crystal is a reproducible physical length; the `{220}` spacing near `192.0155 pm` serves as a ruler for the highest-precision work. Marked `[E]` in this document only in the sense that its numerical value must be taken from the then-current best measurement, never from this page.

**Zero-instrument fallback.** Because the lattice averages, **a single interferometric measurement of the 110.0000 mm overall span certifies the 5.0000 mm pitch to `7.3 ppm` in the mean**, and per-point random error is covered by §6.2(b) self-calibration. A builder needs one length measurement, not 391.

**And by (C1) even that one is optional for the pipeline's correctness** — it is required only to make the *documented* dimensions mean what they say, so that two plates made two centuries apart are the same plate.

### 7.3 Plane angle

Dimensionless. Realised by closure of a full turn (§6.2(d)). No standard exists or is needed.

### 7.4 Wavelength

The canonical wavelengths `850.0 nm` (iris) and `860.0 nm` (vein) are realised by:

1. **Grating dispersion.** `m·lambda = d·(sin alpha + sin beta)`. The grating pitch `d` is a length (§7.2), the angles are angles (§7.3). This reduces wavelength to length and angle, both of which are already closed.
2. **Atomic lines as an independent check, and the closure is elegant.** The element that defines the second also emits a line 2.3 nm from the canonical iris wavelength: **caesium D2, `852.35 nm` in vacuum, and caesium D1, `894.59 nm` in vacuum** `[E — values to be taken from the then-current best measurement; a builder who has caesium for the second already has the lamp]`. Rubidium D2 `780.2 nm` and D1 `794.8 nm` bracket the band from below. Four lines across 780–895 nm calibrate a spectrometer's wavelength scale with no wavelength standard and no supplier.

> **The same atom that fixes the second fixes the spectrometer. That is not a coincidence worth exploiting for elegance; it is a robustness property, because a civilisation that can keep time can calibrate this chain.**

### 7.5 Reflectance and radiometry

**No absolute radiometric standard is required anywhere in CAL-1.** By (C2), gain and offset have coefficient exactly zero. Reflectance is realised as:

- a **dimensionless ratio** of two measurements in the same instrument (§6.3(a),(b)), and
- an **area fraction**, i.e. a dimensionless count (§6.3(c)).

The dark end is realised from **geometry alone** (aspect ratio and the squaring relation). The light end is realised from the **thickness asymptote** of a non-absorbing scatterer. Both are physics. Neither is an artifact.

> **This is the strongest survivability property of the specification and it should be defended in every future revision: CAL-1 has no photometric traceability chain to break.**

### 7.6 What is deliberately not traceable

Absolute irradiance at the cornea is **not** traceable through this document and must not be. It is governed by the then-current radiation-safety standard, which is an institutional artifact by nature and must be consulted directly. (`open-attested-capture-device.md` line 96 flags this correctly and its `[E]` marking stands.)

---

## 8. Other anchors

Five anchors are specified in `canonical-biometric-key.md`: iris L, iris R, finger vein, dorsal hand vein, retinal vasculature. Iris is fully specified above. The remaining three are outlined here with **what differs**, which is the part that matters.

### 8.1 Finger vein — CAL-1C (outline)

| property | iris | finger vein |
|---|---|---|
| canonical wavelength | `850.0 nm` | **`860.0 nm`** (N-2.4.a) |
| mode | reflection | **transmission** (transillumination through the finger) |
| field | 110 mm | ~30 mm |
| sampling | 29.83 px/mm | `[E] ~15 px/mm`, to be set by the frozen vein feature bank |
| **scale reference** | **pupil, in-frame → (C1) applies, scale is free** | **none — there is no in-frame scale invariant** |

> **The structural difference, and it is the one that costs: a finger has no pupil.** There is no in-frame feature whose ratio to the pattern is anatomically fixed, so **(C1) does not apply and absolute magnification must be calibrated.** The A1-equivalent tolerance therefore includes global scale, not merely distortion, and is correspondingly tighter — by roughly the ratio of achievable magnification stability to achievable distortion residual `[E]`. **This must be closed before the vein anchor is used for key material rather than for liveness.** A candidate remedy, and the preferred one, is to define a scale invariant from the finger channel's own mechanical constraint (a fixed-width channel imaged in the same frame), which restores (C1) at the cost of requiring contact.

**CAL-1C artifact, in outline.** A transmission phantom: a scattering slab of sintered PTFE (W-2 process, thickness `18.0 mm`, chosen so reduced scattering approximates a finger `[E]`) containing absorbing channels — blind or through bores of diameter `0.40, 0.60, 1.00, 1.40, 2.00 mm` at depths `1.0, 2.0, 4.0, 6.0 mm` below the imaged surface, filled with a D-2 carbon absorber. Plus a Zone-F-equivalent lattice on the imaged face at `2.0000 mm` pitch for the geometric map, and a Zone-W-equivalent transmission wedge realised, as always, by area-fraction dither of open and blocked area. Everything in §§4, 6, 7 applies unchanged.

### 8.2 Dorsal hand vein — CAL-1D (outline)

Reflection mode, `850–880 nm` band `[E — the canonical value must be declared and frozen exactly as (N-2.4.a) requires]`, field `~80 mm`, sampling `[E] ~8 px/mm`. Same phantom class as CAL-1C but in reflection: an absorbing-channel pattern beneath a scattering layer, on a Zone-F lattice. **Differs from finger vein in that the illumination is co-axial-ish rather than transillumination, so A6 (directionality) becomes a first-order term rather than a small one, and the ring-radius/standoff tolerance tightens.** As with finger vein, there is no in-frame scale invariant; the hand's own anatomy varies, so a mechanical registration feature in the frame is required.

### 8.3 Retinal vasculature — CAL-1E (outline)

The heaviest artifact, and the one with the best structural news.

- **Illumination is through the pupil**, so the illumination geometry is set by the eye, not by the device; A6 changes character entirely (the shading term largely vanishes because the retina is imaged nearly co-axially through a common aperture, but corneal and lenticular back-reflections become the dominant nuisance).
- **Field `30–45 deg`**, `850 nm`.
- **Scale reference: the optic disc.** The disc's diameter provides an in-frame anatomical scale invariant. **If the frozen retinal feature bank references radial coordinates to the optic disc, (C1) applies unchanged and global scale is free** — exactly as pupil-referencing does for the iris. *This is the recommendation, and it should be made before the retinal bank is frozen, because it cannot be retrofitted afterwards without breaking commensurability (§9.4).*
- **Artifact: a model eye.** A spherical shell of internal radius `12.00 mm` bearing the pattern on its inner surface, closed by a lens of the correct focal length at the anterior pole, with an aperture stop at the nominal pupil plane. The pattern on the inner surface is the same area-fraction dither of the same two certified materials, mapped onto the sphere; a Zone-F-equivalent lattice is placed on the sphere as a **geodesic** array rather than a square one, and the fitted model gains the shell radius as a parameter.
- The `0.80 µm` figure requirement of §2.7 becomes a requirement on the *spherical* form, which is harder; see §10.10.

---

## 9. Versioning and the long record

### 9.1 What a version is

```
cal_version        integer, monotonically increasing; this document is  CAL-1
plate_design_hash  hash of the canonical numeric table (Section 9.2), not of any CAD file
plate_id           per-physical-plate identifier, a Log D leaf (N-5.8.a)
```

Every attestation carries `cal_version`, `plate_design_hash`, `plate_id` and `H(M)`. A capture whose `cal_version` is unknown to a relying party is **unverifiable, not invalid** — the relying party must be able to say "I cannot price this" rather than "this is false."

### 9.2 The canonical numeric table

The **document is authoritative; distributed files are not** (N-5.8.b). This specification shall be accompanied by a single plain-text table containing every numeric constant in §§3, 4 and 6.5 — coordinates, diameters, depths, pitches, frequencies, area fractions, aspect ratios, the omitted-lattice index list, the `P_v1` generator and seed, and the tap reference values T1–T5 — with a checksum printed **in the document text itself**, so that any electronic copy can be verified against the paper, and the paper can be re-typed from a photograph.

### 9.3 The commensurability rule

> **(N-9.3.a) A revision `CAL-(k+1)` is commensurable with `CAL-k` if and only if a chain calibrated under `CAL-(k+1)` reproduces the `CAL-k` published tap values T1–T5 to the `CAL-k` thresholds, including bit-exact T5.**

That is a *test*, not an argument. A revision is accompanied by the measurement that passes it, made on at least three devices built to three different `CAL-k` processes, and its result is a Log D leaf. **A revision that cannot pass this test is not a revision; it is a new anchor, and it requires re-enrolment of the population — which is a governance act, not an engineering one.**

Corollary: a revision may **tighten** any tolerance in Table 2.6 freely, because tightening cannot break the test. A revision may **loosen** a tolerance only with the §9.3 measurement in hand and only if the total remains `<= 0.0200`.

### 9.4 Forbidden to change, ever

Changing any of the following invalidates every capture ever made and is therefore forbidden outright, not merely discouraged. Each is listed with the reason, because a future reader will be tempted by each in turn:

| forbidden | why |
|---|---|
| `lambda_iris = 850.0 nm`, `lambda_vein = 860.0 nm` | the A3 mechanism is differential penetration depth — a different wavelength images a different depth section of the tissue. This is a change of the source pattern, not a change of the instrument. |
| canonical dilation `p/i = 0.40000` and gate `[0.30, 0.50]` | the rubber-sheet normalisation is defined against it |
| annulus `1.0 -> 2.2 R_p`, **pupil-referenced** | the pupil reference is what makes (C1) exact; abandoning it makes every geometric tolerance ~100x tighter and reopens the contact-lens boundary attack |
| the frozen Gabor bank, `N_r`, `N_theta` | every geometric tolerance in §2.4 scales as `1/N` |
| `n = 400`, `r = 0.12`, `t = 0.30` | the budget ceiling in §2.1 is computed from them |
| the correction-map gauge: **translation, rotation and isotropic scale removed** (N-3.2.a, N-5.4.a) | fixing the gauge introduces a convention no later revision can reproduce |
| integer-only fixed point in `M` and in the pipeline | floating point is a thousand-year bug |
| **the definition of the tap set T1–T5 and their comparison rule** (N-3.9.a) | it is the only mechanism by which "bit-exact" is a checkable claim rather than a slogan |

### 9.5 Free to change

Fabrication process (Class L or Class M or a successor), substrate material, plate outline, mount design, metrology instrumentation, the self-verification methods of §6 (additions only — an existing method may be supplemented, never deleted), the SI realisation route of §7 (any route to the same defining constant), and every tolerance in Table 2.6 in the tightening direction.

### 9.6 The long record

Log D (§5.8) is the durable record: plate designs, plate identities, fabricating shops, measured maps, spectrophotometric traces. It shares the one genuine institutional dependency already named in `canonical-biometric-key.md` §7 — the log's ordering and liveness require an ongoing protocol with participants. **CAL-1 adds no new institutional dependency beyond the one already conceded**, and that is a deliberate design constraint on this document, not an accident.

Additionally, and independently of any log: **this document plus §9.2's numeric table is sufficient to rebuild both artifacts and to re-derive every tolerance.** A reader who has lost the log has lost the population's history but not the ability to make a conforming target.

---

## 10. Open items

Each item states what could not be pinned, and the experiment that pins it.

**10.1 — `s`, the shading fraction, `[E] 0.06`. The weakest empirical input in the budget.** A6's entire tolerance rests on it, and crypt slope statistics are unmeasured.
*Experiment:* image `N >= 30` irides spanning the pigmentation range under illuminator ring radii of `10, 25, 50 mm` at fixed standoff; compute HD between ring conditions; fit `HD` against `tan psi`. Cost: one adjustable ring, one afternoon. **This is the cheapest item on the list and it should be run first.**

**10.2 — `d(HD)/d(lambda) = 6e-4 /nm`, `[E]`, specified at 1.5x the observed `4e-4 /nm`.** A3's `+/-5.0 nm` follows directly.
*Experiment:* tunable NIR source or a set of narrow-band emitters at `820, 830, 840, 850, 860, 870, 880 nm`; same subjects, same chain, same session; HD vs `lambda` about 850. Replaces both the coefficient and the FWHM tolerance with measurements.

**10.3 — `kappa ~ 0.5`, the in-band fraction of the quadratic distortion product, `[E]`.** A5's `INL <= 0.63%` follows.
*Experiment:* take recorded frames, inject a known quadratic transfer numerically, run the frozen pipeline, measure HD vs injected `INL`. Requires no hardware and no subjects. **Runnable today against any existing capture set.**

**10.4 — `N_r = 4` and `N_theta = 32` are assumptions about the frozen Gabor bank, not readings from it.** Every geometric tolerance in §2.4 scales as `1/N`.
*Resolution:* publish `N_r` and `N_theta` from the frozen bank alongside the bank itself, and re-issue Table 2.6 if they differ. This is not an experiment; it is a publication obligation, and it blocks fabrication of CAL-1A at final tolerance.

**10.5 — The 8.6x reduction claim (0.62 px → 0.072 px) is derived, not demonstrated.**
*Experiment:* build two devices from independent optical lots; measure cross-device HD before calibration (expect `~0.06`), derive maps from CAL-1A, measure again (expect `<= 0.007`). **This is the single experiment that validates the whole document**, and it also produces the first real value for M14.

**10.6 — Corneal refraction, tear film and three-dimensional relief are not reproduced by a flat phantom.** CAL-1B validates the chain, not the eye, and the residual has **no budget allocation** (§2.1).
*Experiment:* fabricate a plano-convex NIR-transmitting dome of the correct anterior corneal curvature over CAL-1B; measure the HD offset between domed and flat presentation on the same chain. If the offset exceeds `0.005`, **the dome becomes normative** and the budget must be renegotiated per (N-2.1.b) rather than the tolerances tightened.

**10.7 — The live-eye versus phantom offset is entirely unmeasured and unallocated.**
*Experiment:* same device, same session: CAL-1B capture and live capture of `N >= 20` subjects; compare `HD_chain` predicted by M14 against the observed genuine-pair distribution mean shift. A discrepancy is the size of the unenumerated term, and (N-2.1.b) applies.

**10.8 — Typical relative head velocity `v ~ 5 mm/s` `[E]`, and `t_row ~ 19 µs` `[D — measure on bench]`.** A8's `1.0%` tolerance depends on both.
*Experiment:* instrument the burst with the SE challenge and measure inter-frame shear statistics over `N >= 100` real captures; measure `t_row` directly from the challenge banding against the SE clock.

**10.9 — The acceptance test `f <= 0.025` for imprint fraction (§5.8) has no specified measurement method.**
*Experiment:* define `f` operationally as the fraction of the 400 retained coordinates whose across-population bit-value entropy falls below a threshold, estimate it on the calibrated population, and publish the estimator alongside the threshold. Without a published estimator the acceptance criterion is unenforceable and the DoS attack of §5.8 has no detector.

**10.10 — CAL-1E (model eye) form tolerance.** §2.7's `0.80 µm` over a plane becomes a spherical-form requirement whose achievability with Class M processes is unknown, and the retinal feature bank's scale reference (§8.3) is not yet frozen.
*Resolution:* (a) freeze the retinal bank with **optic-disc referencing**, so (C1) applies and the form tolerance relaxes to a differential one; (b) measure achievable sphericity of a `12.00 mm` internal-radius shell in the candidate processes. Item (a) must be decided before the bank is frozen; afterwards it is forbidden by §9.4.

**10.11 — Alumina iron content versus NIR reflectance is specified as `Fe < 50 ppm` on mechanism, not on measurement.**
*Experiment:* sinter a series at `10, 30, 50, 100, 300 ppm` Fe under otherwise identical conditions; measure `R(850)` and `dR/dlambda` over 800–900 nm; replace the threshold with the measured curve.

**10.12 — The bezel spectral monitor's optical form is not designed.** (N-4.6.a) requires a per-frame measurement of `centroid(S)` and `FWHM(S)`, and §7.4 gives the traceable principle (grating dispersion reducing wavelength to length and angle), but the optomechanical realisation inside a head-unit bezel — first-order geometry, stray-light rejection, and the strip of sensor it lands on — is unspecified.
*Resolution:* an optical design task, not an experiment. Preferred primary: a reflection grating of pitch `8.000 µm` projecting first order onto a fiducial-marked sensor strip. Alternate: a dielectric thin film of known thickness on a metal mirror, giving a computable Fabry–Perot reflectance ratio between coated and uncoated regions — thickness is a length, so it remains traceable by §7.2. **Until this is designed, A3 has no per-frame monitor and the LED thermal-drift trap (§2.4 A3 trap 1) remains open at 2–3x over budget.**

---

*End of CAL-1.*
