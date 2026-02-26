/**
 * Normalize ingredient units for consistency (e.g. g -> grams, tbsp -> tablespoon).
 * Used when saving parsed recipes and for future grocery list integration.
 */

const UNIT_MAP = {
  g: 'grams',
  gram: 'grams',
  grams: 'grams',
  kg: 'kilograms',
  kilogram: 'kilograms',
  kilograms: 'kilograms',
  ml: 'milliliters',
  milliliter: 'milliliters',
  milliliters: 'milliliters',
  l: 'liters',
  liter: 'liters',
  liters: 'liters',
  tbsp: 'tablespoon',
  tablespoons: 'tablespoon',
  tablespoon: 'tablespoon',
  tbs: 'tablespoon',
  tsp: 'teaspoon',
  teaspoons: 'teaspoon',
  teaspoon: 'teaspoon',
  tsps: 'teaspoon',
  cup: 'cups',
  cups: 'cups',
  oz: 'ounces',
  ounce: 'ounces',
  ounces: 'ounces',
  lb: 'pounds',
  lbs: 'pounds',
  pound: 'pounds',
  pounds: 'pounds',
  clove: 'cloves',
  cloves: 'cloves',
  pinch: 'pinch',
  dash: 'dash',
  piece: 'pieces',
  pieces: 'pieces',
  slice: 'slices',
  slices: 'slices',
  sprig: 'sprigs',
  sprigs: 'sprigs',
  bunch: 'bunch',
  can: 'can',
  cans: 'can',
  package: 'package',
  packages: 'package',
  bag: 'bag',
  bags: 'bag',
  box: 'box',
  head: 'head',
  stalk: 'stalks',
  stalks: 'stalks',
};

/**
 * @param {string} unit - Raw unit string (e.g. "tbsp", "g")
 * @returns {string} Normalized unit or original if no mapping
 */
export function normalizeIngredientUnit(unit) {
  if (unit == null || typeof unit !== 'string') return '';
  const trimmed = unit.trim().toLowerCase();
  if (!trimmed) return '';
  return UNIT_MAP[trimmed] ?? trimmed;
}
