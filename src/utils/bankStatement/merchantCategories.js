/**
 * Persisted merchant/description → category for learned categorizations.
 * Used so updates reflect in charts and future imports use the same category.
 */

const STORAGE_KEY = 'productive-calendar.bank-merchant-categories';

function normalizeKey(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

export function getLearnedCategoryMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function getLearnedCategory(merchant, description) {
  const map = getLearnedCategoryMap();
  const a = normalizeKey(merchant);
  const b = normalizeKey(description);
  if (a && map[a]) return map[a];
  if (b && map[b]) return map[b];
  const combined = (a + ' ' + b).trim();
  if (combined && map[combined]) return map[combined];
  return null;
}

export function saveLearnedCategory(merchantOrDescription, category) {
  const key = normalizeKey(merchantOrDescription);
  if (!key || !category) return;
  const map = getLearnedCategoryMap();
  map[key] = category;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

export function clearLearnedCategories() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
