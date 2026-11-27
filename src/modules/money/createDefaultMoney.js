import {
  calculateTransactionTotals,
  createExpenseTransaction,
  getAccounts,
  getBudgetCategories,
  getIncomeIdeas,
  getPlannedExpenses,
  getTotalBalance,
  getTransactions,
} from '../../services';
import {
  getBankStatementTransactions,
  saveBankStatementTransactions,
} from '../../services/bankStatementService.js';
import { parseStatementFile } from '../../utils/bankStatement/parseStatement.js';
import { computeMonthlyAnalysis } from '../../utils/bankStatement/analysis.js';
import { createMoney, DEFAULT_BUCKET_TARGETS } from './createMoney.js';

const BUCKET_TARGETS_KEY = 'arohaflow.money.bucketTargets';
const BUFFER_GOAL_KEY = 'arohaflow.money.bufferGoal';

function readBucketTargets() {
  try {
    const raw = localStorage.getItem(BUCKET_TARGETS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeBucketTargets(targets) {
  localStorage.setItem(BUCKET_TARGETS_KEY, JSON.stringify(targets ?? DEFAULT_BUCKET_TARGETS));
  return targets;
}

function readBufferGoal() {
  try {
    const raw = localStorage.getItem(BUFFER_GOAL_KEY);
    if (raw == null || raw === '') return 0;
    return Number(raw) || 0;
  } catch {
    return 0;
  }
}

function writeBufferGoal(goal) {
  localStorage.setItem(BUFFER_GOAL_KEY, String(goal ?? 0));
  return goal;
}

/** Production Money module wired to existing service adapters. */
export function createDefaultMoney() {
  return createMoney({
    getAccounts,
    getTransactions,
    getBudgetCategories,
    getPlannedExpenses,
    getIncomeIdeas,
    calculateTransactionTotals,
    getTotalBalance,
    createExpenseTransaction,
    parseStatementFile,
    computeMonthlyAnalysis,
    getStatementTransactions: getBankStatementTransactions,
    saveStatementTransactions: saveBankStatementTransactions,
    getBucketTargets: async () => readBucketTargets(),
    saveBucketTargets: async (targets) => writeBucketTargets(targets),
    getBufferGoal: async () => readBufferGoal(),
    saveBufferGoal: async (goal) => writeBufferGoal(goal),
  });
}
