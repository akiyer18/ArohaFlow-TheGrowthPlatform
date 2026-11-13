/** Application CRM status codes (#13). */
export const APPLICATION_STATUSES = [
  'to_apply',
  'applied',
  'interviewing',
  'offer',
  'rejected',
];

export function assertApplicationStatus(status) {
  if (!APPLICATION_STATUSES.includes(status)) {
    throw new Error(
      `Invalid Application status: ${status}. Expected one of ${APPLICATION_STATUSES.join(', ')}`,
    );
  }
}
