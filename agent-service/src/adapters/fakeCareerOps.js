/**
 * In-memory career-ops port for facade / CI tests (#46).
 *
 * @param {{
 *   listings?: import('../ports/careerOps.js').CareerOpsListing[],
 *   suggestions?: Record<string, import('../ports/careerOps.js').CareerOpsCvSuggestions>,
 * }} [options]
 */
export function createFakeCareerOps(options = {}) {
  const listings = [...(options.listings ?? [])];
  const suggestions = { ...(options.suggestions ?? {}) };
  const byId = new Map(listings.map((l) => [l.id, l]));

  return {
    async searchListings(_input = {}) {
      return listings.map((l) => ({ ...l }));
    },

    async getListing(listingId) {
      const hit = byId.get(listingId);
      return hit ? { ...hit } : null;
    },

    async suggestCv(listingId) {
      const tip = suggestions[listingId];
      if (!tip) {
        return {
          listingId,
          sections: [],
          keywords: [],
        };
      }
      return {
        listingId: tip.listingId,
        sections: tip.sections.map((s) => ({ ...s })),
        keywords: tip.keywords.map((k) => ({ ...k })),
      };
    },
  };
}
