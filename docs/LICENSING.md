# Licensing

## Why AGPL-3.0-only for the kernel (anti-capture)

The kernel is the coordination substrate of a commons. AGPL-3.0 closes
the loophole that lets an operator take the code, run it as a hosted
service with proprietary modifications, and give nothing back: anyone
who runs a modified kernel for users over a network must offer those
users the modified source. A permissive core would invite exactly the
capture this project exists to prevent — a well-funded operator forking
the kernel into a closed, better-resourced network that outcompetes the
commons with its own code. "-only" (not "-or-later") means no future
license steward — including the FSF — can move the goalposts.

## Why DCO instead of a CLA (anti-steward-coup)

A CLA concentrates relicensing power in the steward: whoever collects
copyright assignments can take the project proprietary later. The DCO
does the opposite — every contributor certifies their right to submit
and **keeps their copyright**. The license can therefore never change
without the consent of every copyright holder, which after enough
contributors is a practical impossibility. The protection is
structural, not promissory: no future board vote, acquisition, or
steward coup can undo it.

## Standing intent: permissive SDK edges

Client SDK crates — the thin libraries applications embed to *talk to*
the network (wallet adapters, event-bus clients, type bindings) — will
ship **MIT OR Apache-2.0** when they are split out. Copyleft at the
kernel protects the commons; permissive at the edges lets anyone build
on it without license anxiety. The boundary is deliberate: the network
itself is a commons, an app talking to the network is the builder's own.

## Documents

`CONSTITUTION.md` and the contents of `docs/` are licensed
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) — share and
adapt with attribution.
