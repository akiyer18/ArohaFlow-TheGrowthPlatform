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
    getStatementTransactions: vi.fn(async () => []),
    saveStatementTransactions: vi.fn(async (rows) => rows),
    getBucketTargets: vi.fn(async () => null),
    saveBucketTargets: vi.fn(async (targets) => targets),
    getBufferGoal: vi.fn(async () => 0),
    saveBufferGoal: vi.fn(async (goal) => goal),
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

  it('getOverview returns Income, Spent, Planned, and Saved for a selected month (#37)', async () => {
    const money = createMoney(
      fakePorts({
        getTransactions: vi.fn(async () => [
          { id: 'i1', type: 'income', amount: 3000, date: '2026-11-01' },
          { id: 'e1', type: 'expense', amount: 800, date: '2026-11-05' },
          { id: 'e2', type: 'expense', amount: 200, date: '2026-11-20' },
          { id: 'other', type: 'income', amount: 500, date: '2026-10-15' },
        ]),
        getPlannedExpenses: vi.fn(async () => [
          { id: 'p1', item: 'Rent', cost: 1200, target_date: '2026-11-01' },
          { id: 'p2', item: 'Gym', cost: 40, target_date: '2026-11-10' },
          { id: 'p3', item: 'Old', cost: 99, target_date: '2026-10-01' },
        ]),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });

    expect(overview.month).toBe('2026-11');
    expect(overview.income).toBe(3000);
    expect(overview.spent).toBe(1000);
    expect(overview.planned).toBe(1240);
    expect(overview.saved).toBe(2000);
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

  it('importStatement skips already-imported rows on re-import (#38)', async () => {
    const existing = [
      {
        date: '2026-11-03',
        description: 'Albert Heijn',
        amount: 42.5,
        type: 'expense',
        merchant: 'Albert Heijn',
        category: 'Groceries',
      },
    ];
    const ports = fakePorts({
      getStatementTransactions: vi.fn(async () => existing),
      parseStatementFile: vi.fn(async () => ({
        error: null,
        sourceBank: 'ING',
        transactions: [
          {
            date: '2026-11-03',
            description: 'Albert Heijn',
            amount: -42.5,
            type: 'expense',
            merchant: 'Albert Heijn',
            category: 'Groceries',
          },
          {
            date: '2026-11-04',
            description: 'Salary',
            amount: 2500,
            type: 'income',
            merchant: null,
            category: 'Income',
          },
        ],
      })),
    });
    const money = createMoney(ports);

    const result = await money.importStatement({ name: 'ing-nov.csv' }, { sourceBank: 'ING' });

    expect(result.imported).toBe(1);
    expect(result.skippedDuplicate).toBe(1);
    expect(result.excludedTransfers).toBe(0);
    expect(ports.saveStatementTransactions).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          date: '2026-11-04',
          type: 'income',
          amount: 2500,
        }),
      ],
      'ING',
    );
  });

  it('importStatement excludes own-account transfers from Income and Spent (#38)', async () => {
    const ports = fakePorts({
      getAccounts: vi.fn(async () => [
        { id: 'a1', name: 'Betaalrekening' },
        { id: 'a2', name: 'Spaarrekening' },
      ]),
      parseStatementFile: vi.fn(async () => ({
        error: null,
        sourceBank: 'ABN',
        transactions: [
          {
            date: '2026-11-10',
            description: 'Overboeking naar Spaarrekening',
            amount: -200,
            type: 'expense',
            merchant: 'Spaarrekening',
            category: 'Transfers',
          },
          {
            date: '2026-11-11',
            description: 'Albert Heijn',
            amount: -35,
            type: 'expense',
            merchant: 'Albert Heijn',
            category: 'Groceries',
          },
          {
            date: '2026-11-01',
            description: 'Salaris',
            amount: 3000,
            type: 'income',
            merchant: null,
            category: 'Income',
          },
        ],
      })),
    });
    const money = createMoney(ports);

    const result = await money.importStatement({ name: 'abn.csv' }, { sourceBank: 'ABN' });

    expect(result.excludedTransfers).toBe(1);
    expect(result.imported).toBe(3);
    expect(result.income).toBe(3000);
    expect(result.spent).toBe(35);
    expect(result.saved).toBe(2965);
    expect(ports.saveStatementTransactions.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ description: 'Overboeking naar Spaarrekening', isOwnTransfer: true }),
        expect.objectContaining({ description: 'Albert Heijn', isOwnTransfer: false }),
      ]),
    );
  });

  it('getOverview maps month spend into Needs / Wants / Future with 10% Future default (#40)', async () => {
    const money = createMoney(
      fakePorts({
        getTransactions: vi.fn(async () => [
          { id: 'i1', type: 'income', amount: 2000, date: '2026-11-01', category: 'Income' },
          { id: 'e1', type: 'expense', amount: 900, date: '2026-11-02', category: 'Bills' },
          { id: 'e2', type: 'expense', amount: 300, date: '2026-11-03', category: 'Entertainment' },
          { id: 'e3', type: 'expense', amount: 200, date: '2026-11-04', category: 'Transfers' },
        ]),
        getStatementTransactions: vi.fn(async () => []),
        getPlannedExpenses: vi.fn(async () => []),
        getBucketTargets: vi.fn(async () => null),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });

    expect(overview.bucketTargets).toEqual({ needs: 50, wants: 40, future: 10 });
    expect(overview.buckets.needs.actual).toBe(900);
    expect(overview.buckets.wants.actual).toBe(300);
    expect(overview.buckets.future.actual).toBe(200);
    expect(overview.buckets.future.targetAmount).toBe(200);
    expect(overview.buckets.needs.targetAmount).toBe(1000);
    expect(overview.buckets.wants.targetAmount).toBe(800);
  });

  it('getOverview reports buffer progress and months-of-expenses runway (#42)', async () => {
    const money = createMoney(
      fakePorts({
        getTotalBalance: vi.fn(async () => 4500),
        getBufferGoal: vi.fn(async () => 6000),
        getTransactions: vi.fn(async () => [
          { id: 'i1', type: 'income', amount: 3000, date: '2026-11-01', category: 'Income' },
          { id: 'e1', type: 'expense', amount: 1500, date: '2026-11-05', category: 'Bills' },
        ]),
        getStatementTransactions: vi.fn(async () => []),
        getPlannedExpenses: vi.fn(async () => []),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });

    expect(overview.buffer).toEqual({
      goal: 6000,
      balance: 4500,
      progress: 0.75,
    });
    expect(overview.runwayMonths).toBe(3);
  });

  it('setBufferGoal persists the buffer target (#42)', async () => {
    let goal = 1000;
    const ports = fakePorts({
      getBufferGoal: vi.fn(async () => goal),
      saveBufferGoal: vi.fn(async (next) => {
        goal = next;
        return next;
      }),
      getTotalBalance: vi.fn(async () => 500),
      getTransactions: vi.fn(async () => []),
      getStatementTransactions: vi.fn(async () => []),
      getPlannedExpenses: vi.fn(async () => []),
    });
    const money = createMoney(ports);

    const overview = await money.setBufferGoal(2000);

    expect(ports.saveBufferGoal).toHaveBeenCalledWith(2000);
    expect(overview.buffer.goal).toBe(2000);
    expect(overview.buffer.progress).toBe(0.25);
  });

  it('setBucketTargets persists editable split percentages (#40)', async () => {
    let stored = null;
    const ports = fakePorts({
      getBucketTargets: vi.fn(async () => stored),
      saveBucketTargets: vi.fn(async (next) => {
        stored = next;
        return next;
      }),
      getTransactions: vi.fn(async () => [
        { id: 'i1', type: 'income', amount: 1000, date: '2026-11-01', category: 'Income' },
      ]),
      getStatementTransactions: vi.fn(async () => []),
      getPlannedExpenses: vi.fn(async () => []),
    });
    const money = createMoney(ports);

    const overview = await money.setBucketTargets({ needs: 60, wants: 30, future: 10 });

    expect(ports.saveBucketTargets).toHaveBeenCalledWith({ needs: 60, wants: 30, future: 10 });
    expect(overview.bucketTargets).toEqual({ needs: 60, wants: 30, future: 10 });
    expect(overview.buckets.needs.targetAmount).toBe(600);
  });

  it('getOverview excludes statement own-account transfers from monthly glance (#38)', async () => {
    const money = createMoney(
      fakePorts({
        getTransactions: vi.fn(async () => []),
        getPlannedExpenses: vi.fn(async () => []),
        getStatementTransactions: vi.fn(async () => [
          {
            date: '2026-11-01',
            type: 'income',
            amount: 2000,
            description: 'Pay',
            category: 'Income',
            isOwnTransfer: false,
          },
          {
            date: '2026-11-02',
            type: 'expense',
            amount: 50,
            description: 'Groceries',
            category: 'Groceries',
            isOwnTransfer: false,
          },
          {
            date: '2026-11-03',
            type: 'expense',
            amount: 400,
            description: 'Overboeking',
            category: 'Transfers',
            isOwnTransfer: true,
          },
        ]),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });
    expect(overview.income).toBe(2000);
    expect(overview.spent).toBe(50);
    expect(overview.saved).toBe(1950);
  });
});
