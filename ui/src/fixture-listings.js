// SPDX-License-Identifier: AGPL-3.0-only
//
// Second fixture, same law (seat rule 2): sole data source for the
// Listings view. One import point per fixture — T-1 pattern.
import listings from '../../fixtures/listings-fixtures.json'

// Commit pin from the T-2 dispatch — provenance literal, R1 class
// (pre-accepted). The fixture's own generator commit is `generated_from`.
export const LISTINGS_PIN = 'b42c25b'

export default listings
