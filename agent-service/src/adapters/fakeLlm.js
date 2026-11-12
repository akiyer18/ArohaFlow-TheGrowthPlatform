/**
 * @param {{ rank: (candidates: object[]) => Array<{ messageId: string, score: number, reason: string }> }} impl
 */
export function createFakeLlm(impl) {
  return {
    async rankEmailCandidates(candidates) {
      return impl.rank(candidates);
    },
  };
}
