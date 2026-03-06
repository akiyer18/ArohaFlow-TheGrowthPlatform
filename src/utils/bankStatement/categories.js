import { getLearnedCategory } from './merchantCategories';

export const STATEMENT_CATEGORIES = [
  'Groceries', 'Food and Dining', 'Transport', 'Shopping', 'Subscriptions',
  'Bills', 'Entertainment', 'Transfers', 'Income', 'Uncategorized',
];

const DEFAULT_CATEGORY = 'Uncategorized';

const MERCHANT_RULES = [
  ['walmart', 'Groceries'], ['kroger', 'Groceries'], ['safeway', 'Groceries'],
  ['whole foods', 'Groceries'], ['trader joe', 'Groceries'], ['aldi', 'Groceries'],
  ['costco', 'Groceries'], ['albert heijn', 'Groceries'], ['vomar', 'Groceries'],
  ['spar', 'Groceries'], ['lidl', 'Groceries'], ['amazon', 'Shopping'],
  ['action', 'Shopping'], ['tk maxx', 'Shopping'], ['uber', 'Transport'],
  ['lyft', 'Transport'], ['gas', 'Transport'], ['shell', 'Transport'],
  ['spotify', 'Subscriptions'], ['netflix', 'Subscriptions'], ['apple.com/bill', 'Subscriptions'],
  ['electric', 'Bills'], ['water', 'Bills'], ['internet', 'Bills'], ['rent', 'Bills'],
  ['starbucks', 'Food and Dining'], ['doordash', 'Food and Dining'],
  ['transfer', 'Transfers'], ['salary', 'Income'], ['payroll', 'Income'], ['refund', 'Income'],
  ['ideal top-up', 'Income'], ['top-up', 'Income'], ['top up', 'Income'],
];

const KEYWORD_RULES = [
  ['grocery', 'Groceries'], ['food', 'Food and Dining'], ['fuel', 'Transport'],
  ['subscription', 'Subscriptions'], ['bill', 'Bills'], ['salary', 'Income'],
  ['income', 'Income'], ['refund', 'Income'], ['transfer', 'Transfers'],
];

export function categorizeTransaction(description, merchant, amount, type) {
  if (type === 'income') return 'Income';
  const learned = getLearnedCategory(merchant, description);
  if (learned) return learned;
  const desc = String(description || '').toLowerCase();
  const merch = String(merchant || '').toLowerCase();
  const combined = desc + ' ' + merch;
  for (const [term, category] of MERCHANT_RULES) {
    if (combined.includes(term)) return category;
  }
  for (const [term, category] of KEYWORD_RULES) {
    if (combined.includes(term)) return category;
  }
  return DEFAULT_CATEGORY;
}
