import { describe, it, expect, vi } from 'vitest';
import { createMoney, isOwnAccountTransfer } from './createMoney.js';

function twoAccounts(overrides = {}) {
  return [
    { id: 'spend-1', name: 'Spending', type: 'spending', balance: 400, ...overrides.spending },
    { id: 'save-1', name: 'Savings', type: 'savings', balance: 5000, ...overrides.savings },
  ];
}

function fakePorts(overrides = {}) {
  return {
    getAccounts: vi.fn(async () => twoAccounts()),
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
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () => [{ id: 'a1', name: 'Checking', type: 'spending', balance: 100 }]),
      }),
    );
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
    expect(overview.accounts.map((a) => a.id)).toEqual(expect.arrayContaining(['spend-1', 'save-1']));
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

  it('getOverview reports buffer progress from savings account balance', async () => {
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () =>
          twoAccounts({ spending: { balance: 400 }, savings: { balance: 4500 } }),
        ),
        getTotalBalance: vi.fn(async () => 4900),
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
    expect(overview.spendingAccount.balance).toBe(400);
    expect(overview.savingsAccount.balance).toBe(4500);
  });

  it('setBufferGoal persists the buffer target (#42)', async () => {
    let goal = 1000;
    const ports = fakePorts({
      getBufferGoal: vi.fn(async () => goal),
      saveBufferGoal: vi.fn(async (next) => {
        goal = next;
        return next;
      }),
      getAccounts: vi.fn(async () =>
        twoAccounts({ spending: { balance: 0 }, savings: { balance: 500 } }),
      ),
      getTotalBalance: vi.fn(async () => 500),
      getTransactions: vi.fn(async () => []),
      getStatementTransactions: vi.fn(async () => []),
      getPlannedExpenses: vi.fn(async () => []),
    });
    const money = createMoney(ports);

    const overview = await money.setBufferGoal(2000);

    expect(ports.saveBufferGoal).toHaveBeenCalledWith(2000);
    expect(overview.buffer.goal).toBe(2000);
    expect(overview.buffer.balance).toBe(500);
    expect(overview.buffer.progress).toBe(0.25);
  });

  it('detects transfers between savings and spending as own-account transfers', () => {
    const accounts = twoAccounts();
    expect(
      isOwnAccountTransfer(
        {
          description: 'Overboeking van Savings naar Spending',
          merchant: null,
          category: 'Uncategorized',
        },
        accounts,
      ),
    ).toBe(true);
    expect(
      isOwnAccountTransfer(
        {
          description: 'Transfer Spending to Savings',
          category: 'Uncategorized',
        },
        accounts,
      ),
    ).toBe(true);
    expect(
      isOwnAccountTransfer(
        { description: 'Albert Heijn', category: 'Groceries' },
        accounts,
      ),
    ).toBe(false);
  });

  it('getOverview excludes savings↔spending transfers from Income and Spent', async () => {
    const accounts = twoAccounts();
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () => accounts),
        getTransactions: vi.fn(async () => [
          { id: 'i1', type: 'income', amount: 2000, date: '2026-11-01', category: 'Income' },
          {
            id: 't1',
            type: 'expense',
            amount: 500,
            date: '2026-11-02',
            category: 'Transfers',
            description: 'Transfer to Spending',
          },
          {
            id: 'e1',
            type: 'expense',
            amount: 80,
            date: '2026-11-03',
            category: 'Groceries',
            description: 'Albert Heijn',
          },
        ]),
        getStatementTransactions: vi.fn(async () => []),
        getPlannedExpenses: vi.fn(async () => []),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });
    expect(overview.income).toBe(2000);
    expect(overview.spent).toBe(80);
  });

  it('suggests a month-start transfer from savings when spending is short of plan', async () => {
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () =>
          twoAccounts({ spending: { balance: 300 }, savings: { balance: 8000 } }),
        ),
        getBufferGoal: vi.fn(async () => 5000),
        getPlannedExpenses: vi.fn(async () => [
          { id: 'p1', item: 'Rent', cost: 1200, target_date: '2026-11-01', category: 'Rent' },
          { id: 'p2', item: 'Groceries plan', cost: 400, target_date: '2026-11-01', category: 'Groceries' },
          {
            id: 'p3',
            item: 'Insurance',
            cost: 600,
            frequency: 'annual',
            category: 'Insurance',
          },
        ]),
        getBudgetCategories: vi.fn(async () => [
          { id: 'b1', name: 'Transit', category_type: 'monthly', budget_amount: 100 },
        ]),
        getTransactions: vi.fn(async () => []),
        getStatementTransactions: vi.fn(async () => []),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });
    // plan = rent 1200 + groceries 400 + annual/12 (50) + monthly budget 100 = 1750
    // transfer = 1750 - 300 = 1450
    expect(overview.transferSuggestion).toEqual({
      needed: true,
      amount: 1450,
      plannedTotal: 1750,
      spendingBalance: 300,
      savingsBalance: 8000,
      savingsAfterTransfer: 6550,
      belowBufferGoal: false,
      bufferGoal: 5000,
      planRunwayMonths: 6550 / 1750,
    });
  });

  it('transfer suggestion is not needed when spending covers the month plan', async () => {
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () =>
          twoAccounts({ spending: { balance: 2000 }, savings: { balance: 3000 } }),
        ),
        getBufferGoal: vi.fn(async () => 4000),
        getPlannedExpenses: vi.fn(async () => [
          { id: 'p1', item: 'Rent', cost: 1200, target_date: '2026-11-01' },
        ]),
        getBudgetCategories: vi.fn(async () => []),
        getTransactions: vi.fn(async () => []),
        getStatementTransactions: vi.fn(async () => []),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });
    expect(overview.transferSuggestion).toEqual({
      needed: false,
      amount: 0,
      plannedTotal: 1200,
      spendingBalance: 2000,
      savingsBalance: 3000,
      savingsAfterTransfer: 3000,
      belowBufferGoal: true,
      bufferGoal: 4000,
      planRunwayMonths: 3000 / 1200,
    });
  });

  it('warns when suggested transfer would drop savings below the buffer goal', async () => {
    const money = createMoney(
      fakePorts({
        getAccounts: vi.fn(async () =>
          twoAccounts({ spending: { balance: 100 }, savings: { balance: 5200 } }),
        ),
        getBufferGoal: vi.fn(async () => 5000),
        getPlannedExpenses: vi.fn(async () => [
          { id: 'p1', item: 'Rent', cost: 1200, target_date: '2026-11-01' },
        ]),
        getBudgetCategories: vi.fn(async () => []),
        getTransactions: vi.fn(async () => []),
        getStatementTransactions: vi.fn(async () => []),
      }),
    );

    const overview = await money.getOverview({ month: '2026-11' });
    expect(overview.transferSuggestion.needed).toBe(true);
    expect(overview.transferSuggestion.amount).toBe(1100);
    expect(overview.transferSuggestion.savingsAfterTransfer).toBe(4100);
    expect(overview.transferSuggestion.belowBufferGoal).toBe(true);
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
