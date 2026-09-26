// lifespan.mjs — THE one year reader for the whole genealogy stack, in the
// genealogy core (the model is pure and depends on no surface; surfaces
// import this). Consumers: the model, the person panel, and the mirrored byr() in blood.html, held equal by
// tools/genealogy/lifespan.test.mjs). Before 2026-09-22 the panel and
// blood.html each carried an unsigned /^(\d{3,4})/ copy that ignored BC and
// 1-2 digit years: 1,462 of the panel's 1,543 "impossible chronology" chips
// were that reader, not the tree.
// A lifespan reads "<birth>–<death>"; either end may be absent
// ("–1187BC", "1931–Deceased") and a year is 1-4 digits with an optional
// BC suffix. BC is carried as a negative integer: sign only, with no
// astronomical year zero, so -1 is 1 BC and the next year is +1. 123
// lifespans in the public bloodline cross that boundary (6 are born
// 0001BC); none of the three consumers subtracts the two years - they
// compare (evidenceClass, the spine reduce) and export (gedcom). A future
// caller that measures a duration across the boundary must add one.
const signed = (m) => (m[2] ? -parseInt(m[1], 10) : parseInt(m[1], 10));
export function birthYear(lifespan) {
  const m = String(lifespan || "").match(/^(\d{1,4})(BC)?/);
  return m ? signed(m) : null;
}
export function deathYear(lifespan) {
  const m = String(lifespan || "").match(/–\s*(\d{1,4})(BC)?/);
  return m ? signed(m) : null;
}

