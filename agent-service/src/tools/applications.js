import { assertApplicationStatus } from '../domain/applicationStatuses.js';

function normalizeApplication(input) {
  if (!input?.id || typeof input.id !== 'string') {
    throw new Error('Application id is required');
  }
  if (!input.company || typeof input.company !== 'string') {
    throw new Error('Application company is required');
  }
  if (!input.roleTitle || typeof input.roleTitle !== 'string') {
    throw new Error('Application roleTitle is required');
  }
  assertApplicationStatus(input.status);

  return {
    id: input.id,
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    link: typeof input.link === 'string' ? input.link.trim() : '',
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
    status: input.status,
  };
}

export async function listApplications(deps) {
  return deps.store.listApplications();
}

export async function upsertApplication(deps, input) {
  const application = normalizeApplication(input);
  return deps.store.upsertApplication(application);
}

export async function deleteApplication(deps, input) {
  const id = input?.id;
  if (!id || typeof id !== 'string') {
    throw new Error('Application id is required');
  }
  await deps.store.deleteApplication(id);
  return { id, deleted: true };
}
