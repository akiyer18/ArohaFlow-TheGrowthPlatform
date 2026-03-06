import React from 'react';
import { detectRecurringIncome } from '../../utils/bankStatement/analysis';

export default function StatementInsights({ transactions, monthly }) {
  const income = detectRecurringIncome(transactions);
  const month = monthly ? { totalIncome: monthly.totalIncome, totalExpenses: monthly.totalExpenses, netSavings: monthly.netSavings, savingsRate: monthly.savingsRate } : null;

  const lines = [];
  if (month) {
    if (month.savingsRate > 20) lines.push(`You saved ${month.savingsRate.toFixed(0)}% of income this month.`);
    else if (month.savingsRate < 0) lines.push('Spending exceeded income this month.');
    if (month.totalExpenses > 0 && month.totalIncome > 0) {
      const pct = (month.totalExpenses / month.totalIncome) * 100;
      lines.push(`Expenses were ${pct.toFixed(0)}% of income.`);
    }
  }
  if (income.largestSource) {
    lines.push(`Largest income source: ${income.largestSource.name} (${income.recurringSources.length} source(s) total).`);
  }
  if (lines.length === 0) lines.push('Upload a statement to see insights.');

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-2 text-sm font-medium text-app-text-primary">Smart insights</h4>
      <ul className="space-y-1 text-sm text-app-text-muted">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
