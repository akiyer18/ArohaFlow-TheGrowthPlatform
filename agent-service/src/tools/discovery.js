import { assertApplicationStatus } from '../domain/applicationStatuses.js';
import { upsertApplication } from './applications.js';

function normalizeLink(link) {
  return typeof link === 'string' ? link.trim() : '';
}

function recencyDate(listing) {
  return listing.postedAt || listing.discoveredAt || null;
}

function toDiscoveryHit(listing, trackerLinks) {
  const link = normalizeLink(listing.link);
  return {
    id: listing.id,
    company: listing.company,
    roleTitle: listing.roleTitle,
    link,
    description: listing.description ?? '',
    score: listing.score,
    postedAt: listing.postedAt ?? null,
    discoveredAt: listing.discoveredAt,
    liveness: listing.liveness,
    alreadyInTracker: link !== '' && trackerLinks.has(link),
    recencyDate: recencyDate(listing),
  };
}

/**
 * Run Discovery search via career-ops; filter expired by default; mark Tracker dupes.
 */
export async function runDiscoverySearch(deps, input = {}) {
  const { store, careerOps, clock } = deps;
  if (!careerOps) throw new Error('careerOps port required for Discovery search');

  const includeExpired = Boolean(input.includeExpired);
  const listings = await careerOps.searchListings({
    profileId: input.profileId ?? null,
  });

  const applications = await store.listApplications();
  const trackerLinks = new Set(
    applications.map((a) => normalizeLink(a.link)).filter(Boolean),
  );

  const results = listings
    .filter((l) => includeExpired || l.liveness !== 'expired')
    .map((l) => toDiscoveryHit(l, trackerLinks))
    .sort((a, b) => {
      const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return String(b.recencyDate || '').localeCompare(String(a.recencyDate || ''));
    });

  return {
    searchedAt: clock.now().toISOString(),
    results,
  };
}

/**
 * CV section + keyword suggestions for a Discovery listing (guidance only).
 */
export async function getDiscoveryCvSuggestions(deps, input = {}) {
  const { careerOps } = deps;
  if (!careerOps) throw new Error('careerOps port required for CV suggestions');

  const listingId = input.listingId;
  if (!listingId || typeof listingId !== 'string') {
    throw new Error('listingId is required');
  }

  return careerOps.suggestCv(listingId);
}

/**
 * Promote a Discovery hit into the Applications Tracker (idempotent by link).
 */
export async function promoteDiscoveryToApplication(deps, input = {}) {
  const { store, careerOps } = deps;
  if (!careerOps) throw new Error('careerOps port required to promote Discovery');

  const listingId = input.listingId;
  if (!listingId || typeof listingId !== 'string') {
    throw new Error('listingId is required');
  }

  const listing = await careerOps.getListing(listingId);
  if (!listing) {
    throw new Error(`Discovery listing not found: ${listingId}`);
  }

  const link = normalizeLink(listing.link);
  const status = input.status ?? 'to_apply';
  assertApplicationStatus(status);

  const discoveryId = `app-discovery-${listingId}`;
  const existing = (await store.listApplications()).find(
    (a) =>
      a.id === discoveryId || (link !== '' && normalizeLink(a.link) === link),
  );

  const id = existing?.id ?? discoveryId;

  return upsertApplication(
    { store },
    {
      id,
      company: listing.company,
      roleTitle: listing.roleTitle,
      link,
      notes: existing?.notes ?? '',
      status,
    },
  );
}
