/** Dedicated ArohaFlow Google Calendar id for Calendar Publish. */
export const AROHAFLOW_CALENDAR_ID = 'ArohaFlow';

/** Stable upsert/delete key for a published Day Plan Block. */
export function publishExternalKey(dateKey, blockId) {
  return `${dateKey}:${blockId}`;
}
