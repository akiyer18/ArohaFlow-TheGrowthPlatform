const VALID_DATA_SOURCES = ['production', 'local'];

const rawDataSource = (import.meta.env.VITE_DATA_SOURCE || 'production').toLowerCase();

if (!VALID_DATA_SOURCES.includes(rawDataSource)) {
  throw new Error(
    `Invalid VITE_DATA_SOURCE value "${rawDataSource}". Use one of: ${VALID_DATA_SOURCES.join(', ')}.`
  );
}

export const APP_CONFIG = {
  DATA_SOURCE: rawDataSource,
};

/** Single fixed user id for local dev so all data persists under one user regardless of login. */
export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001';

export const isProductionDataSource = APP_CONFIG.DATA_SOURCE === 'production';
export const isLocalDataSource = APP_CONFIG.DATA_SOURCE === 'local';

/** In dev (local data source), use DEV_USER_ID for all DB operations. */
export const getEffectiveUserId = (sessionUserId) =>
  isLocalDataSource ? DEV_USER_ID : sessionUserId;
