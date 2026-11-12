import { describe, it, expect } from 'vitest';
import { createFakeGmail } from '../src/adapters/fakeGmail.js';
import { GMAIL_READ_ONLY_METHODS, assertGmailPortIsReadOnly } from '../src/ports/gmail.js';

describe('Gmail read-only port', () => {
  it('exposes only read methods — no send, delete, or modify', () => {
    const gmail = createFakeGmail();
    assertGmailPortIsReadOnly(gmail);
    expect(GMAIL_READ_ONLY_METHODS).toEqual(['listMessageSummaries', 'getMessage']);
    for (const forbidden of ['send', 'delete', 'modify', 'trash', 'addLabels', 'removeLabels']) {
      expect(gmail[forbidden]).toBeUndefined();
    }
  });
});
