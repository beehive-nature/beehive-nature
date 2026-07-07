// SPDX-License-Identifier: AGPL-3.0-only
//
// Sole data source (seat law, rule 2). Every rendered datum in this app is a
// property access on this import. If a view needs a datum this file cannot
// provide, that is a FOUNDER QUESTION — never an invention.
import fixtures from '../../fixtures/demo-fixtures.json'

// Commit pin from the T-1 dispatch — display-only provenance stamp, not a
// fixture datum. The fixture's own generator commit is `generated_from`.
export const FIXTURE_PIN = '520f154'

export default fixtures
