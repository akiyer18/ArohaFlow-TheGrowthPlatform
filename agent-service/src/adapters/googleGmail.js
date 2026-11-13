function headerMap(payload) {
  const map = Object.create(null);
  for (const h of payload?.headers || []) {
    map[String(h.name || '').toLowerCase()] = h.value || '';
  }
  return map;
}

function toSummary(message) {
  const headers = headerMap(message.payload);
  return {
    id: message.id,
    from: headers.from || '',
    subject: headers.subject || '',
    snippet: message.snippet || '',
    listUnsubscribe: Boolean(headers['list-unsubscribe']),
  };
}

/**
 * Live Gmail adapter — read-only port over googleapis gmail client.
 * @param {object} gmailApi google.gmail({ version: 'v1', auth })
 */
export function createGmailFromGoogleClient(gmailApi) {
  return {
    async listMessageSummaries({ maxResults = 50 } = {}) {
      const listed = await gmailApi.users.messages.list({
        userId: 'me',
        maxResults,
      });
      const ids = (listed.data.messages || []).map((m) => m.id);
      const summaries = [];
      for (const id of ids) {
        const full = await gmailApi.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'List-Unsubscribe'],
        });
        summaries.push(toSummary(full.data));
      }
      return summaries;
    },

    async getMessage(id) {
      const full = await gmailApi.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'List-Unsubscribe'],
      });
      if (!full?.data) return null;
      return toSummary(full.data);
    },
  };
}
