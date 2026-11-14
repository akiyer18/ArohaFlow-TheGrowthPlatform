import { describe, it, expect } from 'vitest';
import { parseStatementFile } from '../../utils/bankStatement/parseStatement.js';
import {
  FIXTURE_ABN_CSV,
  FIXTURE_ING_CSV,
  FIXTURE_RABO_CSV,
  fixtureFile,
} from './moneyCsvFixtures.js';
import { createMoney, isOwnAccountTransfer } from './createMoney.js';

describe('Money CSV fixtures (#38)', () => {
  it('parses synthetic ING CSV shape', async () => {
    const { transactions, error } = await parseStatementFile(
      fixtureFile(FIXTURE_ING_CSV, 'ing-nov.csv'),
      'ING',
    );
    expect(error).toBeFalsy();
    expect(transactions.length).toBeGreaterThanOrEqual(3);
    expect(transactions.some((t) => t.type === 'income' && Math.abs(t.amount) === 2500)).toBe(true);
    expect(transactions.some((t) => t.type === 'expense' && Math.abs(t.amount) === 12.5)).toBe(true);
  });

  it('parses synthetic ABN CSV shape', async () => {
    const { transactions, error } = await parseStatementFile(
      fixtureFile(FIXTURE_ABN_CSV, 'abn-nov.csv'),
      'ABN',
    );
    expect(error).toBeFalsy();
    expect(transactions.length).toBeGreaterThanOrEqual(3);
    expect(transactions.some((t) => t.date === '2026-11-06')).toBe(true);
  });

  it('parses synthetic Rabo CSV shape', async () => {
    const { transactions, error } = await parseStatementFile(
      fixtureFile(FIXTURE_RABO_CSV, 'rabo-nov.csv'),
      'Rabo',
    );
    expect(error).toBeFalsy();
    expect(transactions.length).toBeGreaterThanOrEqual(3);
    expect(
      transactions.some((t) => /albert heijn/i.test(`${t.description || ''} ${t.merchant || ''}`)),
    ).toBe(true);
  });

  it('importStatement through Money seam uses fixtures and excludes transfers', async () => {
    const saved = [];
    const money = createMoney({
      getAccounts: async () => [{ id: '1', name: 'Spaarrekening' }],
      getTransactions: async () => [],
      getBudgetCategories: async () => [],
      getPlannedExpenses: async () => [],
      getIncomeIdeas: async () => [],
      calculateTransactionTotals: async () => ({ income: 0, expenses: 0, netSavings: 0 }),
      getTotalBalance: async () => 0,
      createExpenseTransaction: async () => ({}),
      parseStatementFile,
      computeMonthlyAnalysis: () => null,
      getStatementTransactions: async () => saved,
      saveStatementTransactions: async (rows) => {
        saved.push(...rows);
        return rows;
      },
    });

    const result = await money.importStatement(fixtureFile(FIXTURE_ING_CSV, 'ing-nov.csv'), {
      sourceBank: 'ING',
    });

    expect(result.error).toBeNull();
    expect(result.imported).toBeGreaterThanOrEqual(2);
    expect(result.excludedTransfers).toBeGreaterThanOrEqual(1);
    expect(result.spent).toBe(12.5);
    expect(result.income).toBe(2500);
    expect(saved.some((row) => isOwnAccountTransfer(row))).toBe(true);
  });
});
