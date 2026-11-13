/**
 * Money module — deep interface for MoneyTracker (issue #2).
 *
 * Small surface: overview, recordExpense, analyzeStatement.
 * Balance/expense locality lives here; the page is a thin client.
 * ADR-0004 keeps Money in primary nav.
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
 * }} ports
 */
export function createMoney(ports) {
  async function getOverview() {
    const [
      accounts,
      transactions,
      budgetCategories,
      plannedExpenses,
      incomeIdeas,
      totals,
      totalBalance,
    ] = await Promise.all([
      ports.getAccounts(),
      ports.getTransactions(),
      ports.getBudgetCategories(),
      ports.getPlannedExpenses(),
      ports.getIncomeIdeas(),
      ports.calculateTransactionTotals(),
      ports.getTotalBalance(),
    ]);

    return {
      accounts,
      transactions,
      budgetCategories,
      plannedExpenses,
      incomeIdeas,
      totals,
      totalBalance,
    };
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

  return { getOverview, recordExpense, analyzeStatement };
}
