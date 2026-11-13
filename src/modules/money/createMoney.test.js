import { describe, it, expect, vi } from 'vitest';
import { createMoney } from './createMoney.js';

function fakePorts(overrides = {}) {
  return {
    getAccounts: vi.fn(async () => [{ id: 'a1', name: 'Checking', balance: 100 }]),
    getTransactions: vi.fn(async () => [{ id: 't1', amount: 12 }]),
    getBudgetCategories: vi.fn(async () => []),
    getPlannedExpenses: vi.fn(async () => []),
    getIncomeIdeas: vi.fn(async () => []),
    calculateTransactionTotals: vi.fn(async () => ({
      income: 0,
      expenses: 12,
      netSavings: -12,
    })),
    getTotalBalance: vi.fn(async () => 100),
    createExpenseTransaction: vi.fn(async () => ({ id: 't2' })),
    parseStatementFile: vi.fn(async () => ({
      transactions: [{ amount: -5, date: '2026-11-01' }],
      error: null,
    })),
    computeMonthlyAnalysis: vi.fn(() => ({ months: 1 })),
    ...overrides,
  };
}

describe('Money module (#2)', () => {
  it('getOverview aggregates accounts, transactions, and balances behind one call', async () => {
    const money = createMoney(fakePorts());
    const overview = await money.getOverview();

    expect(overview.accounts).toHaveLength(1);
    expect(overview.totalBalance).toBe(100);
    expect(overview.totals.expenses).toBe(12);
  });

  it('recordExpense writes then returns a refreshed overview', async () => {
    const ports = fakePorts();
    const money = createMoney(ports);

    const overview = await money.recordExpense({
      category: 'groceries',
      item: 'Milk',
      amount: 4,
      date: '2026-11-13',
      paymentMethod: 'cash',
      accountId: null,
    });

    expect(ports.createExpenseTransaction).toHaveBeenCalledOnce();
    expect(overview.accounts[0].id).toBe('a1');
  });

  it('analyzeStatement parses a file and returns analysis', async () => {
    const ports = fakePorts();
    const money = createMoney(ports);
    const result = await money.analyzeStatement({ name: 'stmt.csv' });

    expect(result.error).toBeNull();
    expect(result.transactions).toHaveLength(1);
    expect(result.analysis).toEqual({ months: 1 });
    expect(ports.parseStatementFile).toHaveBeenCalledOnce();
  });
});
