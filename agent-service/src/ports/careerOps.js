/**
 * Career-ops Discovery port — refresh (scan + liveness) / search / CV suggestions.
 * Implementations: fake for tests, file/CLI adapter for local career-ops.
 */

/**
 * @typedef {{
 *   id: string,
 *   company: string,
 *   roleTitle: string,
 *   link: string,
 *   description: string,
 *   score: number,
 *   postedAt: string | null,
 *   discoveredAt: string,
 *   liveness: 'open' | 'expired' | 'uncertain',
 * }} CareerOpsListing
 *
 * @typedef {{
 *   listingId: string,
 *   sections: Array<{ section: string, suggestion: string }>,
 *   keywords: Array<{ keyword: string, experienceHint: string }>,
 * }} CareerOpsCvSuggestions
 */

/**
 * @param {object} careerOps
 */
export function assertCareerOpsPort(careerOps) {
  if (!careerOps || typeof careerOps !== 'object') {
    throw new Error('careerOps port is required');
  }
  for (const name of ['refreshListings', 'searchListings', 'getListing', 'suggestCv']) {
    if (typeof careerOps[name] !== 'function') {
      throw new Error(`careerOps port missing method: ${name}`);
    }
  }
}
