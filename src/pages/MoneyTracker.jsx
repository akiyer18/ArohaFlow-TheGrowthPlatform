import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, CreditCard, LineChart, PiggyBank, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  calculateTransactionTotals,
  createAccount,
  createBudgetCategory,
  createExpenseTransaction,
  createIncomeIdea,
  createIncomeTransaction,
  createPlannedExpense,
  deleteIncomeIdea,
  deletePlannedExpense,
  getAccounts,
  getBudgetCategories,
  getIncomeIdeas,
  getPlannedExpenses,
  getTransactions,
  getTotalBalance,
  updateIncomeIdea,
  updatePlannedExpense,
} from '../services';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Button, Card, Input, Modal, PageContainer, SectionHeader, Select } from '../components/ui';
import StatementAnalyzerTab from '../components/bank-statement/StatementAnalyzerTab';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'budget', label: 'Budget' },
  { id: 'planning', label: 'Planning' },
  { id: 'statement', label: 'Statement Analyzer' },
];

const expenseCategories = [
  'rent',
  'groceries',
  'dining-out',
  'transport',
  'utilities',
  'subscriptions',
  'education',
  'entertainment',
  'shopping',
  'health',
  'other',
];

const MoneyTracker = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [plannedExpenses, setPlannedExpenses] = useState([]);
  const [incomeIdeas, setIncomeIdeas] = useState([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, netSavings: 0 });
  const [totalBalance, setTotalBalance] = useState(0);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const [editingExpense, setEditingExpense] = useState(null);
  const [editingExpenseDraft, setEditingExpenseDraft] = useState({ item: '', cost: '', date: '', category: '' });
  const [editingIdea, setEditingIdea] = useState(null);
  const [editingIdeaDraft, setEditingIdeaDraft] = useState({ idea: '', amount: '', date: '', confidence: '' });

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError('');
      const [accountsData, transactionsData, budgetData, plannedData, ideasData, totalsData, balanceData] =
        await Promise.all([
          getAccounts(),
          getTransactions(),
          getBudgetCategories(),
          getPlannedExpenses(),
          getIncomeIdeas(),
          calculateTransactionTotals(),
          getTotalBalance(),
        ]);
      setAccounts(accountsData);
      setTransactions(transactionsData);
      setBudgetCategories(budgetData);
      setPlannedExpenses(plannedData);
      setIncomeIdeas(ideasData);
      setTotals(totalsData);
      setTotalBalance(balanceData);
    } catch (err) {
      setError(err.message || 'Failed to load money tracker data.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value = 0, currency = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));

  const filteredRecentTransactions = useMemo(() => transactions.slice(0, 12), [transactions]);

  const onAddIncome = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await createIncomeTransaction({
      source: formData.get('source'),
      amount: formData.get('amount'),
      date: formData.get('date'),
      accountId: formData.get('accountId'),
      notes: formData.get('notes'),
    });
    event.currentTarget.reset();
    loadAllData();
  };

  const onAddExpense = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await createExpenseTransaction({
      category: formData.get('category'),
      item: formData.get('item'),
      amount: formData.get('amount'),
      date: formData.get('date'),
      paymentMethod: formData.get('paymentMethod'),
      accountId: formData.get('paymentMethod') === 'online' ? formData.get('accountId') : null,
    });
    event.currentTarget.reset();
    loadAllData();
  };

  const onAddAccount = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await createAccount({
      name: formData.get('name'),
      type: formData.get('type'),
      balance: formData.get('balance'),
      currency: formData.get('currency'),
    });
    setShowAccountModal(false);
    event.currentTarget.reset();
    loadAllData();
  };

  const onAddBudget = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await createBudgetCategory({
      name: formData.get('name'),
      categoryType: formData.get('categoryType'),
      budget: formData.get('budget'),
    });
    setShowBudgetModal(false);
    event.currentTarget.reset();
    loadAllData();
  };

  const onAddPlannedExpense = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      setError('');
      await createPlannedExpense({
        item: formData.get('item'),
        cost: formData.get('cost'),
        date: formData.get('date') || null,
        category: formData.get('category'),
        currency: 'USD',
      });
      if (form && typeof form.reset === 'function') form.reset();
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to save possible expense.');
    }
  };

  const onAddIncomeIdea = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      setError('');
      await createIncomeIdea({
        idea: formData.get('idea'),
        amount: formData.get('amount'),
        date: formData.get('date') || null,
        confidence: formData.get('confidence'),
        currency: 'USD',
      });
      if (form && typeof form.reset === 'function') form.reset();
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to save planned income.');
    }
  };

  const startEditExpense = (expense) => {
    setEditingExpense(expense);
    setEditingExpenseDraft({
      item: expense?.item || '',
      cost: expense?.cost != null ? String(expense.cost) : '',
      date: expense?.target_date || '',
      category: expense?.category || '',
    });
  };

  const startEditIdea = (idea) => {
    setEditingIdea(idea);
    setEditingIdeaDraft({
      idea: idea?.idea || '',
      amount: idea?.expected_amount != null ? String(idea.expected_amount) : '',
      date: idea?.target_date || '',
      confidence: idea?.confidence_level != null ? String(idea.confidence_level) : '',
    });
  };

  const toggleExpenseCompleted = async (expense) => {
    try {
      setError('');
      await updatePlannedExpense(expense.id, {
        item: expense.item,
        cost: expense.cost,
        date: expense.target_date || null,
        category: expense.category,
        currency: expense.currency || 'USD',
        isCompleted: !expense.is_completed,
      });
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to update possible expense.');
    }
  };

  const toggleIdeaCompleted = async (idea) => {
    try {
      setError('');
      await updateIncomeIdea(idea.id, {
        idea: idea.idea,
        amount: idea.expected_amount,
        date: idea.target_date || null,
        confidence: idea.confidence_level ?? 0,
        currency: idea.currency || 'USD',
        isRecurring: idea.is_recurring || false,
        frequency: idea.frequency || null,
        isCompleted: !idea.is_completed,
      });
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to update planned income.');
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm('Delete this possible expense?')) return;
    try {
      setError('');
      await deletePlannedExpense(expense.id);
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to delete possible expense.');
    }
  };

  const handleDeleteIdea = async (idea) => {
    if (!window.confirm('Delete this planned income item?')) return;
    try {
      setError('');
      await deleteIncomeIdea(idea.id);
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to delete planned income.');
    }
  };

  const handleSaveExpenseEdit = async (event) => {
    event.preventDefault();
    if (!editingExpense) return;
    try {
      setError('');
      await updatePlannedExpense(editingExpense.id, {
        item: editingExpenseDraft.item,
        cost: editingExpenseDraft.cost,
        date: editingExpenseDraft.date || null,
        category: editingExpenseDraft.category,
        currency: editingExpense.currency || 'USD',
        isCompleted: !!editingExpense.is_completed,
      });
      setEditingExpense(null);
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    }
  };

  const handleSaveIdeaEdit = async (event) => {
    event.preventDefault();
    if (!editingIdea) return;
    try {
      setError('');
      await updateIncomeIdea(editingIdea.id, {
        idea: editingIdeaDraft.idea,
        amount: editingIdeaDraft.amount,
        date: editingIdeaDraft.date || null,
        confidence: editingIdeaDraft.confidence,
        currency: editingIdea.currency || 'USD',
        isRecurring: editingIdea.is_recurring || false,
        frequency: editingIdea.frequency || null,
        isCompleted: !!editingIdea.is_completed,
      });
      setEditingIdea(null);
      loadAllData();
    } catch (err) {
      setError(err.message || 'Failed to save changes.');
    }
  };

  if (loading) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <AppHeader title="Money Tracker" subtitle="Finance operations" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
      <PageContainer>
        <SectionHeader title="Financial Workspace" subtitle="Track cash flow, budgets, and future plans." />
        {error ? (
          <Card className="mb-6 border-rose-900 bg-rose-900/20 text-rose-300">{error}</Card>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="app-grid grid-cols-1 md:grid-cols-3">
              <Card>
                <p className="app-muted mb-1 text-xs">Income</p>
                <div className="flex items-center justify-between">
                  <h3>{formatCurrency(totals.income)}</h3>
                  <LineChart className="h-4 w-4 text-app-success" />
                </div>
              </Card>
              <Card>
                <p className="app-muted mb-1 text-xs">Expenses</p>
                <div className="flex items-center justify-between">
                  <h3>{formatCurrency(totals.expenses)}</h3>
                  <BarChart3 className="h-4 w-4 text-app-danger" />
                </div>
              </Card>
              <Card>
                <p className="app-muted mb-1 text-xs">Balance</p>
                <div className="flex items-center justify-between">
                  <h3>{formatCurrency(totalBalance)}</h3>
                  <Wallet className="h-4 w-4 text-app-accent" />
                </div>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h3 className="mb-4">Add Income</h3>
                <form className="space-y-3" onSubmit={onAddIncome}>
                  <Input name="source" placeholder="Source" required />
                  <Input type="number" name="amount" placeholder="Amount" required />
                  <Input type="date" name="date" required />
                  <Select name="accountId" required>
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </Select>
                  <Button type="submit" className="w-full">Save Income</Button>
                </form>
              </Card>
              <Card>
                <h3 className="mb-4">Add Expense</h3>
                <form className="space-y-3" onSubmit={onAddExpense}>
                  <Select name="category" required>
                    <option value="">Select category</option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </Select>
                  <Input name="item" placeholder="Description" required />
                  <Input type="number" name="amount" placeholder="Amount" required />
                  <Input type="date" name="date" required />
                  <Select name="paymentMethod" required>
                    <option value="">Payment method</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </Select>
                  <Select name="accountId">
                    <option value="">Account (online only)</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </Select>
                  <Button type="submit" className="w-full">Save Expense</Button>
                </form>
              </Card>
            </div>

            <Card>
              <h3 className="mb-4">Recent Transactions</h3>
              <div className="space-y-2">
                {filteredRecentTransactions.length === 0 ? (
                  <p className="app-muted">No transactions yet.</p>
                ) : (
                  filteredRecentTransactions.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-app-text-primary">{item.type === 'income' ? item.source : item.item}</p>
                        <p className="text-xs app-muted">{item.date}</p>
                      </div>
                      <p className={item.type === 'income' ? 'text-app-success' : 'text-app-danger'}>
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <SectionHeader
              title="Accounts"
              subtitle="Manage account balances"
              actions={<Button onClick={() => setShowAccountModal(true)}><Plus className="h-4 w-4" />Add Account</Button>}
            />
            <div className="app-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3>{account.name}</h3>
                    <CreditCard className="h-4 w-4 app-muted" />
                  </div>
                  <p className="app-muted text-xs capitalize">{account.type}</p>
                  <p className="mt-3 text-lg font-semibold text-app-text-primary">
                    {formatCurrency(account.balance, account.currency)}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6">
            <SectionHeader
              title="Budget"
              subtitle="Category-level budget tracking"
              actions={<Button onClick={() => setShowBudgetModal(true)}><Plus className="h-4 w-4" />Add Budget</Button>}
            />
            <div className="app-grid grid-cols-1 md:grid-cols-2">
              {budgetCategories.map((category) => {
                const spent = transactions
                  .filter((item) => item.type === 'expense' && item.category === category.category_type)
                  .reduce((sum, item) => sum + Number(item.amount), 0);
                const budget = Number(category.budget_amount || 0);
                const ratio = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                return (
                  <Card key={category.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3>{category.name}</h3>
                      <Badge tone={ratio > 90 ? 'danger' : ratio > 70 ? 'warning' : 'success'}>
                        {ratio.toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="app-muted text-xs">{formatCurrency(spent)} of {formatCurrency(budget)}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-app-accent" style={{ width: `${ratio}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'planning' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4">Possible Expenses</h3>
              <form className="space-y-3" onSubmit={onAddPlannedExpense}>
                <Input name="item" placeholder="Item" required />
                <Input type="number" name="cost" placeholder="Cost" required />
                <Input type="date" name="date" />
                <Input name="category" placeholder="Category" required />
                <Button type="submit" className="w-full">Add Possible Expense</Button>
              </form>
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {plannedExpenses.length === 0 ? (
                  <p className="text-sm app-muted">No possible expenses yet.</p>
                ) : (
                  plannedExpenses.map((expense) => (
                    <div key={expense.id} className="rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-app-accent"
                            checked={!!expense.is_completed}
                            onChange={() => toggleExpenseCompleted(expense)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${expense.is_completed ? 'line-through text-app-text-muted' : ''}`}>
                              {expense.item}
                            </p>
                            <p className="text-xs app-muted">
                              {(expense.category || 'Uncategorized')}
                              {' · '}
                              {expense.target_date || 'No date'}
                            </p>
                          </div>
                        </label>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`text-sm ${expense.is_completed ? 'text-app-text-muted line-through' : ''}`}>
                            {formatCurrency(expense.cost, expense.currency || 'USD')}
                          </p>
                          <Button variant="secondary" size="sm" onClick={() => startEditExpense(expense)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteExpense(expense)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
            <Card>
              <h3 className="mb-4">Planned Income</h3>
              <form className="space-y-3" onSubmit={onAddIncomeIdea}>
                <Input name="idea" placeholder="Idea" required />
                <Input type="number" name="amount" placeholder="Expected amount" required />
                <Input type="date" name="date" />
                <Input type="number" name="confidence" placeholder="Confidence %" required />
                <Button type="submit" className="w-full">Add Planned Income</Button>
              </form>
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {incomeIdeas.length === 0 ? (
                  <p className="text-sm app-muted">No planned income yet.</p>
                ) : (
                  incomeIdeas.map((idea) => (
                    <div key={idea.id} className="rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-app-accent"
                            checked={!!idea.is_completed}
                            onChange={() => toggleIdeaCompleted(idea)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium truncate ${idea.is_completed ? 'line-through text-app-text-muted' : ''}`}>
                              {idea.idea}
                            </p>
                            <p className="text-xs app-muted">
                              Confidence {idea.confidence_level ?? 0}% · {idea.target_date || 'No date'}
                            </p>
                          </div>
                        </label>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`text-sm ${idea.is_completed ? 'text-app-text-muted line-through' : ''}`}>
                            {formatCurrency(idea.expected_amount, idea.currency || 'USD')}
                          </p>
                          <Button variant="secondary" size="sm" onClick={() => startEditIdea(idea)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDeleteIdea(idea)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'statement' && (
          <StatementAnalyzerTab />
        )}
      </PageContainer>

      <Modal open={showAccountModal} onClose={() => setShowAccountModal(false)} title="Create account">
        <form className="space-y-3" onSubmit={onAddAccount}>
          <Input name="name" placeholder="Account name" required />
          <Select name="type" required>
            <option value="">Type</option>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit</option>
            <option value="investment">Investment</option>
            <option value="cash">Cash</option>
          </Select>
          <Input name="balance" type="number" placeholder="Initial balance" required />
          <Select name="currency" required>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="INR">INR</option>
          </Select>
          <Button type="submit" className="w-full">Create Account</Button>
        </form>
      </Modal>

      <Modal open={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Create budget category">
        <form className="space-y-3" onSubmit={onAddBudget}>
          <Input name="name" placeholder="Budget name" required />
          <Select name="categoryType" required>
            <option value="">Category</option>
            {expenseCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Select>
          <Input name="budget" type="number" placeholder="Monthly budget" required />
          <Button type="submit" className="w-full">Create Budget</Button>
        </form>
      </Modal>

      <Modal open={!!editingExpense} onClose={() => setEditingExpense(null)} title="Edit possible expense">
        <form className="space-y-3" onSubmit={handleSaveExpenseEdit}>
          <Input
            name="item"
            placeholder="Item"
            value={editingExpenseDraft.item}
            onChange={(e) => setEditingExpenseDraft((s) => ({ ...s, item: e.target.value }))}
            required
          />
          <Input
            type="number"
            name="cost"
            placeholder="Cost"
            value={editingExpenseDraft.cost}
            onChange={(e) => setEditingExpenseDraft((s) => ({ ...s, cost: e.target.value }))}
            required
          />
          <Input
            type="date"
            name="date"
            value={editingExpenseDraft.date}
            onChange={(e) => setEditingExpenseDraft((s) => ({ ...s, date: e.target.value }))}
          />
          <Input
            name="category"
            placeholder="Category"
            value={editingExpenseDraft.category}
            onChange={(e) => setEditingExpenseDraft((s) => ({ ...s, category: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingExpense(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editingIdea} onClose={() => setEditingIdea(null)} title="Edit planned income">
        <form className="space-y-3" onSubmit={handleSaveIdeaEdit}>
          <Input
            name="idea"
            placeholder="Idea"
            value={editingIdeaDraft.idea}
            onChange={(e) => setEditingIdeaDraft((s) => ({ ...s, idea: e.target.value }))}
            required
          />
          <Input
            type="number"
            name="amount"
            placeholder="Expected amount"
            value={editingIdeaDraft.amount}
            onChange={(e) => setEditingIdeaDraft((s) => ({ ...s, amount: e.target.value }))}
            required
          />
          <Input
            type="date"
            name="date"
            value={editingIdeaDraft.date}
            onChange={(e) => setEditingIdeaDraft((s) => ({ ...s, date: e.target.value }))}
          />
          <Input
            type="number"
            name="confidence"
            placeholder="Confidence %"
            value={editingIdeaDraft.confidence}
            onChange={(e) => setEditingIdeaDraft((s) => ({ ...s, confidence: e.target.value }))}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingIdea(null)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MoneyTracker;