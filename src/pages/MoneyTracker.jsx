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
  getAccounts,
  getBudgetCategories,
  getIncomeIdeas,
  getPlannedExpenses,
  getTransactions,
  getTotalBalance,
} from '../services';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Button, Card, Input, Modal, PageContainer, SectionHeader, Select } from '../components/ui';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'budget', label: 'Budget' },
  { id: 'planning', label: 'Planning' },
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
    const formData = new FormData(event.currentTarget);
    await createPlannedExpense({
      item: formData.get('item'),
      cost: formData.get('cost'),
      date: formData.get('date'),
      category: formData.get('category'),
      currency: 'USD',
    });
    event.currentTarget.reset();
    loadAllData();
  };

  const onAddIncomeIdea = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await createIncomeIdea({
      idea: formData.get('idea'),
      amount: formData.get('amount'),
      date: formData.get('date'),
      confidence: formData.get('confidence'),
      currency: 'USD',
    });
    event.currentTarget.reset();
    loadAllData();
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
              <h3 className="mb-4">Planned Expenses</h3>
              <form className="space-y-3" onSubmit={onAddPlannedExpense}>
                <Input name="item" placeholder="Item" required />
                <Input type="number" name="cost" placeholder="Cost" required />
                <Input type="date" name="date" required />
                <Input name="category" placeholder="Category" required />
                <Button type="submit" className="w-full">Add Planned Expense</Button>
              </form>
              <div className="mt-4 space-y-2">
                {plannedExpenses.slice(0, 8).map((expense) => (
                  <div key={expense.id} className="rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                    <p className="text-sm">{expense.item}</p>
                    <p className="text-xs app-muted">{expense.target_date}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h3 className="mb-4">Income Ideas</h3>
              <form className="space-y-3" onSubmit={onAddIncomeIdea}>
                <Input name="idea" placeholder="Idea" required />
                <Input type="number" name="amount" placeholder="Expected amount" required />
                <Input type="date" name="date" required />
                <Input type="number" name="confidence" placeholder="Confidence %" required />
                <Button type="submit" className="w-full">Add Income Idea</Button>
              </form>
              <div className="mt-4 space-y-2">
                {incomeIdeas.slice(0, 8).map((idea) => (
                  <div key={idea.id} className="rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                    <p className="text-sm">{idea.idea}</p>
                    <p className="text-xs app-muted">{idea.target_date}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
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
    </div>
  );
};

export default MoneyTracker;