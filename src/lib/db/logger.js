/**
 * Central DB error logging. Never fail silently.
 */
export function logDbError(context, error) {
  const message = error?.message ?? String(error);
  console.error('[DB ERROR]', context, message);
  if (error?.details) console.error('[DB ERROR] details:', error.details);
  if (error?.hint) console.error('[DB ERROR] hint:', error.hint);
}
