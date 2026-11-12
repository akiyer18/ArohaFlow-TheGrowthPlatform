/**
 * @param {Array<{ id: string, from: string, subject: string, snippet: string, listUnsubscribe?: boolean }>} messages
 */
export function createFakeGmail(messages = []) {
  const byId = new Map(messages.map((m) => [m.id, m]));

  return {
    async listMessageSummaries() {
      return messages.map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        snippet: m.snippet,
        listUnsubscribe: Boolean(m.listUnsubscribe),
      }));
    },
    async getMessage(id) {
      const m = byId.get(id);
      if (!m) return null;
      return { ...m };
    },
  };
}
