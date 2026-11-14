/**
 * Money module — deep interface for OS Money / MoneyTracker (ADR-0008).
 *
 * Small surface: overview (monthly Income/Spent/Planned/Saved),
 * recordExpense, analyzeStatement, importStatement (CSV with dedupe +
 * own-account transfer exclusion). Legacy *Service / parsers are adapters.
 *
 * @param {{
 *   getAccounts: Function,
 *   getTransactions: Function,
 *   getBudgetCategories: Function,
 *   getPlannedExpenses: Function,
 *   getIncomeIdeas: Function,
 *   calculateTransactionTotals: Function,
 *   getTotalBalance: Function,
 *   createExpenseTransaction: Function,
 *   parseStatementFile: Function,
 *   computeMonthlyAnalysis: Function,
 *   getStatementTransactions?: Function,
 *   saveStatementTransactions?: Function,
 *   getBucketTargets?: Function,
 *   saveBucketTargets?: Function,
 *   getBufferGoal?: Function,
 *   saveBufferGoal?: Function,
 *   now?: Function,
 * }} ports
 */

/** Nibud-informed defaults: Future/savings 10%; Needs/Wants share the rest (50/40 guide). */
export const DEFAULT_BUCKET_TARGETS = { needs: 50, wants: 40, future: 10 };

const NEEDS_CATEGORIES = new Set([
  'bills',
  'groceries',
  'transport',
  'rent',
  'insurance',
  'utilities',
  'health',
]);
const WANTS_CATEGORIES = new Set([
  'entertainment',
  'shopping',
  'subscriptions',
  'food and dining',
  'dining',
]);
const FUTURE_CATEGORIES = new Set(['transfers', 'savings', 'investing', 'buffer']);

const TRANSFER_PATTERN =
  /overboeking|eigen rekening|own account|interne overboeking|spaarrekening|van rekening|naar rekening|\btransfer\b/i;

function currentMonthKey(ports) {
  const now = ports.now ? ports.now() : new Date();
  const d = now instanceof Date ? now : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function inMonth(dateValue, monthKey) {
  if (!dateValue || !monthKey) return false;
  return String(dateValue).slice(0, 7) === monthKey;
}

function sumAmounts(rows, amountKey) {
  return rows.reduce((sum, row) => sum + (Number(row[amountKey]) || 0), 0);
}

function normalizeDesc(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function absAmount(value) {
  return Math.abs(Number(value) || 0);
}

/** Stable identity for statement-row dedupe across re-imports. */
export function statementDedupeKey(row) {
  const amount = absAmount(row.amount).toFixed(2);
  const type = row.type || (Number(row.amount) < 0 ? 'expense' : 'income');
  return `${row.date}|${type}|${amount}|${normalizeDesc(row.description)}`;
}

export function isOwnAccountTransfer(row, accounts = []) {
  if (row?.isOwnTransfer === true) return true;
  if (row?.category === 'Transfers') return true;
  const text = `${row?.description || ''} ${row?.merchant || ''}`;
  if (TRANSFER_PATTERN.test(text)) return true;
  const hints = (accounts || [])
    .map((a) => normalizeDesc(a.name))
    .filter((name) => name.length > 2);
  const hay = normalizeDesc(text);
  return hints.some((name) => hay.includes(name));
}

function detectSourceBank(file, explicit, parsedBank) {
  if (explicit) return explicit;
  if (parsedBank) return parsedBank;
  const name = String(file?.name || '').toUpperCase();
  if (name.includes('ING')) return 'ING';
  if (name.includes('ABN')) return 'ABN';
  if (name.includes('RABO') || name.includes('RABOBANK')) return 'Rabo';
  return null;
}

export function categoryToBucket(category) {
  const key = String(category || '').toLowerCase().trim();
  if (FUTURE_CATEGORIES.has(key)) return 'future';
  if (WANTS_CATEGORIES.has(key)) return 'wants';
  if (NEEDS_CATEGORIES.has(key)) return 'needs';
  if (key === 'income') return null;
  return 'needs';
}

function normalizeBucketTargets(raw) {
  const needs = Number(raw?.needs);
  const wants = Number(raw?.wants);
  const future = Number(raw?.future);
  if (![needs, wants, future].every((n) => Number.isFinite(n) && n >= 0)) {
    return { ...DEFAULT_BUCKET_TARGETS };
  }
  const sum = needs + wants + future;
  if (sum <= 0) return { ...DEFAULT_BUCKET_TARGETS };
  if (Math.abs(sum - 100) > 0.01) {
    return {
      needs: (needs / sum) * 100,
      wants: (wants / sum) * 100,
      future: (future / sum) * 100,
    };
  }
  return { needs, wants, future };
}

function buildBuckets(expenseRows, income, targets) {
  const actual = { needs: 0, wants: 0, future: 0 };
  for (const row of expenseRows) {
    const bucket = categoryToBucket(row.category);
    if (!bucket) continue;
    actual[bucket] += absAmount(row.amount);
  }
  return {
    needs: {
      actual: actual.needs,
      targetPct: targets.needs,
      targetAmount: (income * targets.needs) / 100,
    },
    wants: {
      actual: actual.wants,
      targetPct: targets.wants,
      targetAmount: (income * targets.wants) / 100,
    },
    future: {
      actual: actual.future,
      targetPct: targets.future,
      targetAmount: (income * targets.future) / 100,
    },
  };
}

export function createMoney(ports) {
  async function loadBucketTargets() {
    if (!ports.getBucketTargets) return { ...DEFAULT_BUCKET_TARGETS };
    const stored = await ports.getBucketTargets();
    return normalizeBucketTargets(stored ?? DEFAULT_BUCKET_TARGETS);
  }

  async function getOverview(input = {}) {
    const month = input.month ?? currentMonthKey(ports);
    const [
      accounts,
      transactions,
      budgetCategories,
      plannedExpenses,
      incomeIdeas,
      totals,
      totalBalance,
      statementTransactions,
      bucketTargets,
      bufferGoal,
    ] = await Promise.all([
      ports.getAccounts(),
      ports.getTransactions(),
      ports.getBudgetCategories(),
      ports.getPlannedExpenses(),
      ports.getIncomeIdeas(),
      ports.calculateTransactionTotals(),
      ports.getTotalBalance(),
      ports.getStatementTransactions ? ports.getStatementTransactions() : Promise.resolve([]),
      loadBucketTargets(),
      ports.getBufferGoal ? ports.getBufferGoal() : Promise.resolve(0),
    ]);

    const monthLedger = (transactions ?? []).filter((t) => inMonth(t.date, month));
    const monthStatements = (statementTransactions ?? []).filter((t) => inMonth(t.date, month));

    const countableStatements = monthStatements.filter((t) => !isOwnAccountTransfer(t, accounts));
    const countableLedger = monthLedger.filter((t) => !isOwnAccountTransfer(t, accounts));

    const income =
      sumAmounts(
        countableLedger.filter((t) => t.type === 'income'),
        'amount',
      ) +
      sumAmounts(
        countableStatements.filter((t) => t.type === 'income'),
        'amount',
      );
    const spent =
      sumAmounts(
        countableLedger.filter((t) => t.type === 'expense'),
        'amount',
      ) +
      sumAmounts(
        countableStatements.filter((t) => t.type === 'expense'),
        'amount',
      );
    const planned = sumAmounts(
      (plannedExpenses ?? []).filter((p) => inMonth(p.target_date ?? p.targetDate, month)),
      'cost',
    );
    const saved = income - spent;

    const expenseRows = [
      ...monthLedger.filter((t) => t.type === 'expense'),
      ...monthStatements.filter((t) => t.type === 'expense'),
    ];
    const buckets = buildBuckets(expenseRows, income, bucketTargets);
    const goal = Math.max(0, Number(bufferGoal) || 0);
    const balance = Number(totalBalance) || 0;
    const buffer = {
      goal,
      balance,
      progress: goal > 0 ? Math.min(1, balance / goal) : 0,
    };
    const runwayMonths = spent > 0 ? balance / spent : null;

    return {
      month,
      income,
      spent,
      planned,
      saved,
      bucketTargets,
      buckets,
      buffer,
      runwayMonths,
      accounts,
      transactions,
      budgetCategories,
      plannedExpenses,
      incomeIdeas,
      totals,
      totalBalance,
      statementTransactions,
    };
  }

  async function setBucketTargets(input) {
    const next = normalizeBucketTargets(input);
    if (!ports.saveBucketTargets) {
      throw new Error('Bucket target ports are not configured');
    }
    await ports.saveBucketTargets(next);
    return getOverview();
  }

  async function setBufferGoal(amount) {
    if (!ports.saveBufferGoal) {
      throw new Error('Buffer goal ports are not configured');
    }
    const goal = Math.max(0, Number(amount) || 0);
    await ports.saveBufferGoal(goal);
    return getOverview();
  }

  async function recordExpense(input) {
    await ports.createExpenseTransaction(input);
    return getOverview();
  }

  /**
   * Parse a bank statement file and return monthly analysis.
   * @param {File|Blob} file
   * @param {string|null} [sourceBank]
   */
  async function analyzeStatement(file, sourceBank = null) {
    const parsed = await ports.parseStatementFile(file, sourceBank);
    if (parsed.error) {
      return { error: parsed.error, transactions: [], analysis: null };
    }
    const transactions = parsed.transactions ?? [];
    const analysis = ports.computeMonthlyAnalysis
      ? ports.computeMonthlyAnalysis(transactions)
      : null;
    return { error: null, transactions, analysis };
  }

  /**
   * Import a bank CSV/statement: parse, skip duplicates, mark own-account
   * transfers, persist, and return Income/Spent excluding transfers.
   * @param {File|Blob} file
   * @param {{ sourceBank?: string|null }} [options]
   */
  async function importStatement(file, options = {}) {
    if (!ports.saveStatementTransactions || !ports.getStatementTransactions) {
      throw new Error('Statement import ports are not configured');
    }

    const parsed = await ports.parseStatementFile(file, options.sourceBank ?? null);
    if (parsed.error) {
      return {
        error: parsed.error,
        imported: 0,
        skippedDuplicate: 0,
        excludedTransfers: 0,
        income: 0,
        spent: 0,
        saved: 0,
        sourceBank: null,
      };
    }

    const sourceBank = detectSourceBank(file, options.sourceBank, parsed.sourceBank);
    const accounts = await ports.getAccounts();
    const existing = await ports.getStatementTransactions();
    const existingKeys = new Set((existing ?? []).map(statementDedupeKey));

    let skippedDuplicate = 0;
    let excludedTransfers = 0;
    const toSave = [];

    for (const raw of parsed.transactions ?? []) {
      const type = raw.type || (Number(raw.amount) < 0 ? 'expense' : 'income');
      const amount = absAmount(raw.amount);
      const row = {
        date: raw.date,
        description: raw.description || '',
        amount,
        type,
        merchant: raw.merchant || null,
        category: raw.category || (type === 'income' ? 'Income' : 'Uncategorized'),
        sourceBank: sourceBank || raw.sourceBank || null,
      };
      if (existingKeys.has(statementDedupeKey(row))) {
        skippedDuplicate += 1;
        continue;
      }
      const ownTransfer = isOwnAccountTransfer(row, accounts);
      if (ownTransfer) {
        excludedTransfers += 1;
        row.category = 'Transfers';
      }
      row.isOwnTransfer = ownTransfer;
      toSave.push(row);
      existingKeys.add(statementDedupeKey(row));
    }

    if (toSave.length > 0) {
      await ports.saveStatementTransactions(toSave, sourceBank);
    }

    const countable = toSave.filter((t) => !t.isOwnTransfer);
    const income = sumAmounts(
      countable.filter((t) => t.type === 'income'),
      'amount',
    );
    const spent = sumAmounts(
      countable.filter((t) => t.type === 'expense'),
      'amount',
    );

    return {
      error: null,
      imported: toSave.length,
      skippedDuplicate,
      excludedTransfers,
      income,
      spent,
      saved: income - spent,
      sourceBank,
      transactions: toSave,
    };
  }

  return {
    getOverview,
    recordExpense,
    analyzeStatement,
    importStatement,
    setBucketTargets,
    setBufferGoal,
  };
}
