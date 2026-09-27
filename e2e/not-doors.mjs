/* not-doors.mjs — THE PAGES IN surfaces/doors/ THAT ARE NOT DOORS.

   Hive pages: no section.d, no count to state, no "one thing to do". Named,
   so that a door losing its section fails instead of vanishing — exemption by
   name, never by absence (see door-counts.mjs).

   ONE LIST, TWO READERS: e2e/door-counts.mjs (the three numbers) and
   e2e/doors.mjs (the rendered doors) both import it. It is its own module
   and not an export of door-counts.mjs because importing that file would run
   its gate; an is-main guard to stop that was measured silencing BOTH CI
   steps (gate and selftest, rc=0, no output) the moment it misfires. */
export const NOT_DOORS = new Set(['beehivenature-buzz.html', 'skaists-buzz.html']);
