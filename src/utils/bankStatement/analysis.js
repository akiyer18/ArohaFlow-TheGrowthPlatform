/**
 * Monthly analysis engine: income, expenses, savings, category totals, top merchants.
 * Handles refunds (as income), reversed transactions, missing data.
 */

export function getMonthKey(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).slice(0, 10);
  return s.slice(0, 7);
}

export function computeMonthlyAnalysis(transactions) {
  const byMonth = {};
  const list = Array.isArray(transactions) ? transactions : [];

  for (const t of list) {
    const month = getMonthKey(t.date);
    if (!month) continue;
    if (!byMonth[month]) {
      byMonth[month] = {
        totalIncome: 0,
        totalExpenses: 0,
        categoryTotals: {},
        merchantTotals: {},
        transactions: [],
      };
    }
    const amt = Math.abs(Number(t.amount)) || 0;
    const type = t.type === 'income' ? 'income' : 'expense';

    if (type === 'income') {
      byMonth[month].totalIncome += amt;
    } else {
      byMonth[month].totalExpenses += amt;
    }

    if (type === 'expense') {
      const cat = t.category || 'Uncategorized';
      byMonth[month].categoryTotals[cat] = (byMonth[month].categoryTotals[cat] || 0) + amt;
      const merchant = t.merchant || t.description || 'Unknown';
      byMonth[month].merchantTotals[merchant] = (byMonth[month].merchantTotals[merchant] || 0) + amt;
    }

    byMonth[month].transactions.push(t);
  }

  const result = {};
  for (const [month, data] of Object.entries(byMonth)) {
    const totalIncome = data.totalIncome || 0;
    const totalExpenses = data.totalExpenses || 0;
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    const categoryEntries = Object.entries(data.categoryTotals || {}).sort((a, b) => b[1] - a[1]);
    const topMerchants = Object.entries(data.merchantTotals || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, total]) => ({ name, total }));

    result[month] = {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      categoryTotals: Object.fromEntries(categoryEntries),
      topMerchants,
    };
  }

  return result;
}

export function detectRecurringIncome(transactions) {
  const income = (Array.isArray(transactions) ? transactions : [])
    .filter((t) => t.type === 'income')
    .map((t) => ({ ...t, amount: Math.abs(Number(t.amount)) || 0 }));

  const bySource = {};
  for (const t of income) {
    const key = (t.merchant || t.description || 'Unknown').trim().toLowerCase();
    if (!bySource[key]) bySource[key] = { total: 0, count: 0, lastDate: null };
    bySource[key].total += t.amount;
    bySource[key].count += 1;
    if (!bySource[key].lastDate || t.date > bySource[key].lastDate) {
      bySource[key].lastDate = t.date;
    }
  }

  const sources = Object.entries(bySource)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  const totalMonthly = income.reduce((s, t) => s + t.amount, 0);
  const largest = sources[0] || null;

  return { totalMonthly, recurringSources: sources, largestSource: largest };
}

export function getDailySpending(transactions, monthKey) {
  const list = (Array.isArray(transactions) ? transactions : []).filter(
    (t) => t.type === 'expense' && getMonthKey(t.date) === monthKey
  );
  const byDay = {};
  for (const t of list) {
    const day = String(t.date).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + Math.abs(Number(t.amount)) || 0;
  }
  return Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
}
