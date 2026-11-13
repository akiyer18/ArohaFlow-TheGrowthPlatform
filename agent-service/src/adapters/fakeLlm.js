/**
 * @param {{
 *   rank?: (candidates: object[]) => Array<{ messageId: string, score: number, reason: string }>,
 *   proposeWeeklyPlan?: (input: { goal: object, wipRemaining: number }) => Promise<object> | object
 * }} impl
 */
export function createFakeLlm(impl) {
  return {
    async rankEmailCandidates(candidates) {
      return (impl.rank ?? (() => []))(candidates);
    },
    async proposeWeeklyPlan(input) {
      if (!impl.proposeWeeklyPlan) {
        throw new Error('Fake LLM proposeWeeklyPlan not configured');
      }
      return impl.proposeWeeklyPlan(input);
    },
  };
}
