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
import { parseStatementFile } from '../../utils/bankStatement/parseStatement.js';
import { computeMonthlyAnalysis } from '../../utils/bankStatement/analysis.js';
import { createMoney } from './createMoney.js';

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
  });
}
