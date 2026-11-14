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

/** Classify an account as savings, spending, or unknown. */
export function accountRole(account) {
  if (!account) return null;
  const type = normalizeDesc(account.type);
  const name = normalizeDesc(account.name);
  if (
    type === 'savings' ||
    type === 'saving' ||
    name.includes('savings') ||
    name.includes('spaar')
  ) {
    return 'savings';
  }
  if (
    type === 'spending' ||
    type === 'checking' ||
    type === 'current' ||
    type === 'betaal' ||
    name.includes('spending') ||
    name.includes('checking') ||
    name.includes('betaal')
  ) {
    return 'spending';
  }
  return null;
}

export function findAccountByRole(accounts, role) {
  return (accounts || []).find((a) => accountRole(a) === role) || null;
}

export function isOwnAccountTransfer(row, accounts = []) {
  if (row?.isOwnTransfer === true) return true;
  if (row?.category === 'Transfers') return true;
  const text = `${row?.description || ''} ${row?.merchant || ''}`;
  if (TRANSFER_PATTERN.test(text)) return true;
  const hay = normalizeDesc(text);
  const named = (accounts || [])
    .map((a) => normalizeDesc(a.name))
    .filter((name) => name.length > 2);
  if (named.some((name) => hay.includes(name))) return true;

  // Explicit savings ↔ spending pair (either account name present with transfer cues,
  // or both roles named in the description).
  const savings = findAccountByRole(accounts, 'savings');
  const spending = findAccountByRole(accounts, 'spending');
  if (savings && spending) {
    const savingsName = normalizeDesc(savings.name);
    const spendingName = normalizeDesc(spending.name);
    const mentionsSavings = savingsName.length > 2 && hay.includes(savingsName);
    const mentionsSpending = spendingName.length > 2 && hay.includes(spendingName);
    if (mentionsSavings && mentionsSpending) return true;
    if (
      (mentionsSavings || mentionsSpending) &&
      /\b(to|from|naar|van|transfer|overboeking)\b/i.test(text)
    ) {
      return true;
    }
  }
  return false;
}

function isAnnualPlanned(item) {
  const freq = normalizeDesc(item?.frequency || item?.period || item?.cadence);
  return freq === 'annual' || freq === 'yearly' || item?.is_annual === true || item?.isAnnual === true;
}

function isAnnualBudget(category) {
  const kind = normalizeDesc(category?.category_type || category?.period || category?.frequency);
  return kind === 'annual' || kind === 'yearly';
}

function isMonthlyBudget(category) {
  const kind = normalizeDesc(category?.category_type || category?.period || category?.frequency);
  return kind === 'monthly' || kind === 'month' || kind === '';
}

/** Month funding need: in-month planned + annual/12 + monthly budget categories. */
export function computeMonthPlanTotal(plannedExpenses, budgetCategories, monthKey) {
  let total = 0;
  for (const item of plannedExpenses || []) {
    if (isAnnualPlanned(item)) {
      total += absAmount(item.cost || item.annualCost || item.annual_cost) / 12;
      continue;
    }
    if (inMonth(item.target_date ?? item.targetDate, monthKey)) {
      total += absAmount(item.cost);
    }
  }
  for (const cat of budgetCategories || []) {
    const amount = absAmount(cat.budget_amount ?? cat.budgetAmount);
    if (isAnnualBudget(cat)) total += amount / 12;
    else if (isMonthlyBudget(cat)) total += amount;
  }
  return total;
}

export function buildTransferSuggestion({
  plannedTotal,
  spendingBalance,
  savingsBalance,
  bufferGoal,
}) {
  const planned = Math.max(0, Number(plannedTotal) || 0);
  const spending = Number(spendingBalance) || 0;
  const savings = Number(savingsBalance) || 0;
  const goal = Math.max(0, Number(bufferGoal) || 0);
  const rawNeed = planned - spending;
  const amount = rawNeed > 0 ? rawNeed : 0;
  const savingsAfterTransfer = savings - amount;
  return {
    needed: amount > 0,
    amount,
    plannedTotal: planned,
    spendingBalance: spending,
    savingsBalance: savings,
    savingsAfterTransfer,
    belowBufferGoal: goal > 0 && savingsAfterTransfer < goal,
    bufferGoal: goal,
    planRunwayMonths: planned > 0 ? savingsAfterTransfer / planned : null,
  };
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
    const plannedMonthRows = (plannedExpenses ?? []).filter(
      (p) => !isAnnualPlanned(p) && inMonth(p.target_date ?? p.targetDate, month),
    );
    const planned = sumAmounts(plannedMonthRows, 'cost');
    const saved = income - spent;

    const expenseRows = [
      ...monthLedger.filter((t) => t.type === 'expense'),
      ...monthStatements.filter((t) => t.type === 'expense'),
    ];
    const buckets = buildBuckets(expenseRows, income, bucketTargets);

    const spendingAccount = findAccountByRole(accounts, 'spending');
    const savingsAccount = findAccountByRole(accounts, 'savings');
    const goal = Math.max(0, Number(bufferGoal) || 0);
    const savingsBalance = Number(savingsAccount?.balance) || 0;
    const spendingBalance = Number(spendingAccount?.balance) || 0;
    const buffer = {
      goal,
      balance: savingsBalance,
      progress: goal > 0 ? Math.min(1, savingsBalance / goal) : 0,
    };
    const runwayMonths = spent > 0 ? savingsBalance / spent : null;

    const plannedTotal = computeMonthPlanTotal(plannedExpenses, budgetCategories, month);
    const transferSuggestion = buildTransferSuggestion({
      plannedTotal,
      spendingBalance,
      savingsBalance,
      bufferGoal: goal,
    });

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
      spendingAccount,
      savingsAccount,
      transferSuggestion,
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
