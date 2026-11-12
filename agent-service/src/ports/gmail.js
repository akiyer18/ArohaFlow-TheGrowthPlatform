export const GMAIL_READ_ONLY_METHODS = ['listMessageSummaries', 'getMessage'];

const FORBIDDEN_METHOD_PATTERN =
  /^(send|delete|modify|trash|addLabels|removeLabels|insert|update|patch)/i;

/**
 * Guard: Gmail port must only expose read operations.
 * @param {object} gmail
 */
export function assertGmailPortIsReadOnly(gmail) {
  if (!gmail || typeof gmail !== 'object') {
    throw new Error('Gmail port is required');
  }
  for (const name of GMAIL_READ_ONLY_METHODS) {
    if (typeof gmail[name] !== 'function') {
      throw new Error(`Gmail port missing read method: ${name}`);
    }
  }
  for (const key of Object.keys(gmail)) {
    if (FORBIDDEN_METHOD_PATTERN.test(key)) {
      throw new Error(`Gmail port must not expose write method: ${key}`);
    }
  }
}
