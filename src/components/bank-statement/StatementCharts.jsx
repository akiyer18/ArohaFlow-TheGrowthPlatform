import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { computeMonthlyAnalysis, getDailySpending } from '../../utils/bankStatement/analysis';

const EMERALD = '#10b981';
const EMERALD_LIGHT = '#34d399';
const ROSE = '#f43f5e';
const SLATE = '#64748b';
const PIE_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#059669', '#047857', '#064e3b', '#a78bfa', '#64748b', '#94a3b8', '#cbd5e1'];

export function CategoryDonut({ transactions, monthKey }) {
  const data = useMemo(() => {
    const list = (transactions || []).filter((t) => t.type === 'expense');
    if (!monthKey) {
      const totals = {};
      list.forEach((t) => {
        const c = t.category || 'Uncategorized';
        totals[c] = (totals[c] || 0) + Math.abs(Number(t.amount)) || 0;
      });
      return Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }
    const byMonth = computeMonthlyAnalysis(list);
    const m = byMonth[monthKey];
    if (!m) return [];
    return Object.entries(m.categoryTotals || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions, monthKey]);

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-app-text-muted">
        No spending data
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-3 text-sm font-medium text-app-text-primary">Category spending</h4>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => (percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : '')}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeVsExpenseBar({ transactions, monthKey }) {
  const data = useMemo(() => {
    const byMonth = computeMonthlyAnalysis(transactions || []);
    const keys = Object.keys(byMonth).sort();
    const use = monthKey ? (byMonth[monthKey] ? [monthKey] : keys.slice(-1)) : keys.slice(-6);
    return use.map((k) => {
      const m = byMonth[k];
      return {
        month: k,
        income: m?.totalIncome ?? 0,
        expenses: m?.totalExpenses ?? 0,
      };
    });
  }, [transactions, monthKey]);

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-app-text-muted">
        No data
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-3 text-sm font-medium text-app-text-primary">Income vs expenses</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="month" tick={{ fill: SLATE, fontSize: 11 }} />
          <YAxis tick={{ fill: SLATE, fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, '']} />
          <Legend />
          <Bar dataKey="income" fill={EMERALD} name="Income" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill={ROSE} name="Expenses" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailySpendingLine({ transactions, monthKey }) {
  const data = useMemo(() => {
    const byMonth = computeMonthlyAnalysis(transactions || []);
    const key = monthKey || Object.keys(byMonth).sort().pop();
    return getDailySpending(transactions || [], key).map(([date, amount]) => ({ date, amount }));
  }, [transactions, monthKey]);

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-app-text-muted">
        No daily data
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-3 text-sm font-medium text-app-text-primary">Daily spending</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fill: SLATE, fontSize: 10 }} />
          <YAxis tick={{ fill: SLATE, fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, '']} />
          <Line type="monotone" dataKey="amount" stroke={EMERALD_LIGHT} strokeWidth={2} dot={false} name="Spent" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopMerchantsBar({ transactions, monthKey }) {
  const data = useMemo(() => {
    const byMonth = computeMonthlyAnalysis(transactions || []);
    const m = monthKey ? byMonth[monthKey] : Object.values(byMonth).pop();
    const list = m?.topMerchants || [];
    return list.slice(0, 8).map(({ name, total }) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, total }));
  }, [transactions, monthKey]);

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-app-text-muted">
        No merchant data
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h4 className="mb-3 text-sm font-medium text-app-text-primary">Top merchants</h4>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <XAxis type="number" tick={{ fill: SLATE, fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="name" tick={{ fill: SLATE, fontSize: 10 }} width={90} />
          <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, '']} />
          <Bar dataKey="total" fill={EMERALD} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SavingsSummaryCard({ monthly }) {
  if (!monthly) {
    return (
      <div className="rounded-2xl border border-white/10 bg-emerald-500/10 p-5">
        <p className="text-sm text-app-text-muted">Savings summary</p>
        <p className="mt-1 text-app-text-muted">Upload a statement to see totals.</p>
      </div>
    );
  }
  const { totalIncome, totalExpenses, netSavings, savingsRate } = monthly;
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
      <p className="text-sm text-app-text-muted">Savings summary</p>
      <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-app-text-muted">Income</p>
          <p className="font-semibold text-emerald-400">${Number(totalIncome).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-app-text-muted">Expenses</p>
          <p className="font-semibold text-rose-400">${Number(totalExpenses).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-app-text-muted">Net</p>
          <p className={`font-semibold ${netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ${Number(netSavings).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-app-text-muted">Savings rate</p>
          <p className="font-semibold text-app-text-primary">{Number(savingsRate).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
