// SPDX-License-Identifier: AGPL-3.0-only
//
// Third fixture, same law (seat rule 2): sole data source for the
// Browse view. One import point per fixture — T-1 pattern; third pin
// authorized by the T-5 dispatch (R1-class, pre-accepted).
import browse from '../../fixtures/browse-fixtures.json'

// Commit pin from the T-5 dispatch — display-only provenance stamp,
// not a fixture datum. The fixture's own generator commit is
// `generated_from`.
export const BROWSE_PIN = 'f356a13'

export default browse
