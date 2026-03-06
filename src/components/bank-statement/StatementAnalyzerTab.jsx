import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import {
  getBankStatementTransactions,
  saveBankStatementTransactions,
  deleteAllBankStatementTransactions,
  updateBankStatementTransactionCategory,
} from '../../services';
import { computeMonthlyAnalysis } from '../../utils/bankStatement/analysis';
import StatementUpload from './StatementUpload';
import StatementInsights from './StatementInsights';
import {
  CategoryDonut,
  IncomeVsExpenseBar,
  DailySpendingLine,
  TopMerchantsBar,
  SavingsSummaryCard,
} from './StatementCharts';
import { Button, Card, Select } from '../ui';
import { STATEMENT_CATEGORIES } from '../../utils/bankStatement/categories';
import { saveLearnedCategory, clearLearnedCategories } from '../../utils/bankStatement/merchantCategories';

const formatCurrency = (v) => `$${Number(v).toFixed(2)}`;

export default function StatementAnalyzerTab() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [monthKey, setMonthKey] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getBankStatementTransactions();
      setTransactions(data || []);
    } catch (e) {
      setError(e.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const monthlyAnalysis = useMemo(() => computeMonthlyAnalysis(transactions), [transactions]);
  const monthKeys = useMemo(() => Object.keys(monthlyAnalysis).sort().reverse(), [monthlyAnalysis]);
  const selectedMonthly = monthKey && monthlyAnalysis[monthKey] ? monthlyAnalysis[monthKey] : monthKeys[0] ? monthlyAnalysis[monthKeys[0]] : null;

  const handleParsed = async (parsedList, fileName) => {
    setError('');
    setSaving(true);
    try {
      await saveBankStatementTransactions(parsedList, fileName || null);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all imported statement data? Charts will clear. Learned categories are kept for future imports.')) return;
    setSaving(true);
    setError('');
    try {
      await deleteAllBankStatementTransactions();
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearLearnedCategories = () => {
    if (!window.confirm('Clear saved merchant categories? Future imports will use default rules again.')) return;
    clearLearnedCategories();
  };

  const handleCategoryChange = async (t, newCategory) => {
    const value = newCategory == null || newCategory === '' ? 'Uncategorized' : String(newCategory);
    const key = (t.merchant || t.description || '').trim();
    if (key) saveLearnedCategory(key, value);
    try {
      await updateBankStatementTransactionCategory(t.id, value);
      await load();
    } catch (_) {
      setError('Failed to update category.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-app-text-muted">
        Loading…
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text-primary">Smart Bank Statement Analyzer</h3>
        <div className="flex items-center gap-2">
          {transactions.length > 0 && (
            <Button variant="secondary" size="sm" onClick={handleClearAll} disabled={saving}>
              <Trash2 className="h-4 w-4" />
              Clear all data
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleClearLearnedCategories} title="Reset saved categories for merchants">
            Reset categories
          </Button>
        </div>
      </div>

      <StatementUpload onParsed={handleParsed} onError={setError} saving={saving} />

      {error && (
        <Card className="border-rose-500/30 bg-rose-500/10 text-rose-300">{error}</Card>
      )}

      {transactions.length > 0 && (
        <>
          {monthKeys.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-app-text-muted">Month</label>
              <Select
                value={monthKey || monthKeys[0]}
                onChange={(e) => setMonthKey(e.target.value)}
                className="w-40"
              >
                {monthKeys.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            </div>
          )}

          <SavingsSummaryCard monthly={selectedMonthly} />

          <div className="grid gap-6 lg:grid-cols-2">
            <CategoryDonut transactions={transactions} monthKey={monthKey || monthKeys[0]} />
            <IncomeVsExpenseBar transactions={transactions} monthKey={monthKey || monthKeys[0]} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <DailySpendingLine transactions={transactions} monthKey={monthKey || monthKeys[0]} />
            <TopMerchantsBar transactions={transactions} monthKey={monthKey || monthKeys[0]} />
          </div>

          <StatementInsights transactions={transactions} monthly={selectedMonthly} />

          <Card className="border-white/10 bg-white/5">
            <h4 className="mb-2 text-sm font-medium text-app-text-primary">Data & options</h4>
            <p className="mb-3 text-xs text-app-text-muted">
              Clear imported transactions or reset learned categories. Category changes above are saved and used for future imports.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleClearAll} disabled={saving}>
                <Trash2 className="h-4 w-4" />
                Clear all imported data
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearLearnedCategories}>
                Reset learned categories
              </Button>
            </div>
          </Card>

          <Card>
            <h4 className="mb-3 text-sm font-medium text-app-text-primary">Recent transactions (fix category to improve future imports)</h4>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {transactions.slice(0, 30).map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-app-text-primary truncate">{t.description || t.merchant || '—'}</p>
                    <p className="text-xs text-app-text-muted">{t.date}</p>
                  </div>
                  <Select
                    value={t.category ?? 'Uncategorized'}
                    onChange={(e) => handleCategoryChange(t, e.target.value)}
                    className="w-36 shrink-0 text-xs"
                  >
                    {STATEMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  <p className={`w-20 shrink-0 text-right ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {transactions.length === 0 && !error && (
        <p className="text-center text-app-text-muted">
          Upload a PDF, CSV, or Excel bank statement to see analysis and charts.
        </p>
      )}
    </motion.div>
  );
}
