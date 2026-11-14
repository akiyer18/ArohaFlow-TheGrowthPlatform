import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createDefaultMoney } from '../modules/money';

const money = createDefaultMoney();

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function MoneyPage() {
  const [month, setMonth] = useState(currentMonthKey);
  const [status, setStatus] = useState('loading');
  const [glance, setGlance] = useState(null);
  const [importMessage, setImportMessage] = useState(null);
  const [importing, setImporting] = useState(false);
  const [targetsDraft, setTargetsDraft] = useState({ needs: 50, wants: 40, future: 10 });
  const [bucketMessage, setBucketMessage] = useState(null);
  const [bufferGoalDraft, setBufferGoalDraft] = useState('');
  const [bufferMessage, setBufferMessage] = useState(null);

  const refresh = async (monthKey = month) => {
    const overview = await money.getOverview({ month: monthKey });
    applyOverview(overview);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        await refresh(month);
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const applyOverview = (overview) => {
    setGlance({
      month: overview.month,
      income: overview.income,
      spent: overview.spent,
      planned: overview.planned,
      saved: overview.saved,
      buckets: overview.buckets,
      bucketTargets: overview.bucketTargets,
      buffer: overview.buffer,
      runwayMonths: overview.runwayMonths,
    });
    if (overview.bucketTargets) setTargetsDraft(overview.bucketTargets);
    if (overview.buffer) setBufferGoalDraft(String(overview.buffer.goal || ''));
    setStatus('full');
  };

  const onSaveBufferGoal = async (event) => {
    event.preventDefault();
    setBufferMessage(null);
    try {
      const overview = await money.setBufferGoal(Number(bufferGoalDraft));
      applyOverview(overview);
      setBufferMessage('Buffer goal saved');
    } catch (err) {
      setBufferMessage(err.message || 'Could not save buffer goal');
    }
  };

  const onSaveTargets = async (event) => {
    event.preventDefault();
    setBucketMessage(null);
    try {
      const overview = await money.setBucketTargets({
        needs: Number(targetsDraft.needs),
        wants: Number(targetsDraft.wants),
        future: Number(targetsDraft.future),
      });
      applyOverview(overview);
      setBucketMessage('Bucket targets saved');
    } catch (err) {
      setBucketMessage(err.message || 'Could not save targets');
    }
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportMessage(null);
    try {
      const bankGuess = /ing/i.test(file.name)
        ? 'ING'
        : /abn/i.test(file.name)
          ? 'ABN'
          : /rabo/i.test(file.name)
            ? 'Rabo'
            : null;
      const result = await money.importStatement(file, { sourceBank: bankGuess });
      if (result.error) {
        setImportMessage(result.error);
        return;
      }
      setImportMessage(
        `Imported ${result.imported} · skipped ${result.skippedDuplicate} duplicates · excluded ${result.excludedTransfers} transfers` +
          (result.sourceBank ? ` · ${result.sourceBank}` : ''),
      );
      await refresh(month);
    } catch (err) {
      setImportMessage(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Money
          </h1>
          <p className="os-meta">Monthly glance · Income, Spent, Planned, Saved</p>
        </div>
        <div className="os-toolbar-actions">
          <button
            type="button"
            className="os-btn os-btn-secondary"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            Previous
          </button>
          <span className="os-meta" aria-live="polite">
            {formatMonthLabel(month)}
          </span>
          <button
            type="button"
            className="os-btn os-btn-secondary"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            Next
          </button>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '40%' }} />
          <span style={{ width: '65%' }} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="os-state" role="alert">
          Could not load Money overview.
        </div>
      ) : null}

      {status === 'full' && glance ? (
        <section className="os-panel" aria-labelledby="money-glance-heading">
          <h2 id="money-glance-heading" className="os-panel-title">
            This month
          </h2>
          <div className="os-figures" aria-label="Monthly Income Spent Planned Saved">
            <div className="os-figure">
              <strong>{formatMoney(glance.income)}</strong>
              <span>Income</span>
            </div>
            <div className="os-figure">
              <strong>{formatMoney(glance.spent)}</strong>
              <span>Spent</span>
            </div>
            <div className="os-figure">
              <strong>{formatMoney(glance.planned)}</strong>
              <span>Planned</span>
            </div>
            <div className="os-figure">
              <strong>{formatMoney(glance.saved)}</strong>
              <span>Saved</span>
            </div>
          </div>
        </section>
      ) : null}

      {status === 'full' && glance?.buffer ? (
        <section className="os-panel" aria-labelledby="money-buffer-heading">
          <h2 id="money-buffer-heading" className="os-panel-title">
            Buffer and runway
          </h2>
          <p className="os-meta">
            Buffer progress toward your emergency goal · months of expenses covered separately
          </p>
          <div className="os-figures" aria-label="Buffer and runway">
            <div className="os-figure">
              <strong>
                {Math.round((glance.buffer.progress || 0) * 100)}%
              </strong>
              <span>
                Buffer · {formatMoney(glance.buffer.balance)} / {formatMoney(glance.buffer.goal)}
              </span>
            </div>
            <div className="os-figure">
              <strong>
                {glance.runwayMonths == null ? '—' : `${glance.runwayMonths.toFixed(1)} mo`}
              </strong>
              <span>Runway</span>
            </div>
          </div>
          <div
            className="os-buffer-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((glance.buffer.progress || 0) * 100)}
            style={{
              marginTop: 'var(--space-sm)',
              height: 8,
              background: 'var(--color-paper-3)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.round((glance.buffer.progress || 0) * 100)}%`,
                height: '100%',
                background: 'var(--color-accent)',
              }}
            />
          </div>
          <form className="os-toolbar-actions" style={{ marginTop: 'var(--space-md)' }} onSubmit={onSaveBufferGoal}>
            <label className="os-meta">
              Buffer goal (EUR)
              <input
                type="number"
                min="0"
                step="100"
                value={bufferGoalDraft}
                onChange={(e) => setBufferGoalDraft(e.target.value)}
              />
            </label>
            <button type="submit" className="os-btn os-btn-secondary">
              Save buffer goal
            </button>
          </form>
          {bufferMessage ? (
            <p className="os-meta" role="status" style={{ marginTop: 'var(--space-sm)' }}>
              {bufferMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {status === 'full' && glance?.buckets ? (
        <section className="os-panel" aria-labelledby="money-buckets-heading">
          <h2 id="money-buckets-heading" className="os-panel-title">
            Needs · Wants · Future
          </h2>
          <p className="os-meta">Actual vs target · Future defaults to 10% of Income</p>
          <div className="os-figures" aria-label="Bucket actual versus target">
            {['needs', 'wants', 'future'].map((key) => {
              const row = glance.buckets[key];
              const label = key === 'needs' ? 'Needs' : key === 'wants' ? 'Wants' : 'Future';
              return (
                <div className="os-figure" key={key}>
                  <strong>
                    {formatMoney(row.actual)}
                    <span className="os-meta"> / {formatMoney(row.targetAmount)}</span>
                  </strong>
                  <span>
                    {label} · {Math.round(row.targetPct)}%
                  </span>
                </div>
              );
            })}
          </div>
          <form className="os-toolbar-actions" style={{ marginTop: 'var(--space-md)' }} onSubmit={onSaveTargets}>
            <label className="os-meta">
              Needs %
              <input
                type="number"
                min="0"
                max="100"
                value={targetsDraft.needs}
                onChange={(e) => setTargetsDraft((t) => ({ ...t, needs: e.target.value }))}
              />
            </label>
            <label className="os-meta">
              Wants %
              <input
                type="number"
                min="0"
                max="100"
                value={targetsDraft.wants}
                onChange={(e) => setTargetsDraft((t) => ({ ...t, wants: e.target.value }))}
              />
            </label>
            <label className="os-meta">
              Future %
              <input
                type="number"
                min="0"
                max="100"
                value={targetsDraft.future}
                onChange={(e) => setTargetsDraft((t) => ({ ...t, future: e.target.value }))}
              />
            </label>
            <button type="submit" className="os-btn os-btn-secondary">
              Save split
            </button>
          </form>
          {bucketMessage ? (
            <p className="os-meta" role="status" style={{ marginTop: 'var(--space-sm)' }}>
              {bucketMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="os-panel" aria-labelledby="money-import-heading">
        <h2 id="money-import-heading" className="os-panel-title">
          Import CSV
        </h2>
        <p className="os-meta">
          ING, ABN AMRO, or Rabobank. Duplicates are skipped; own-account transfers stay out of Income
          and Spent.
        </p>
        <div className="os-toolbar-actions" style={{ marginTop: 'var(--space-sm)' }}>
          <label className="os-btn os-btn-secondary">
            {importing ? 'Importing…' : 'Choose CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={importing}
              onChange={onImportFile}
            />
          </label>
          <Link to="/money-tracker" className="os-btn os-btn-secondary">
            Legacy tracker
          </Link>
        </div>
        {importMessage ? (
          <p className="os-meta" role="status" style={{ marginTop: 'var(--space-sm)' }}>
            {importMessage}
          </p>
        ) : null}
      </section>

      <nav className="os-panel" aria-label="Money next steps">
        <h2 className="os-panel-title">Next steps</h2>
        <ul className="os-list">
          <li>
            <p className="os-list-title">Category plan vs actual</p>
            <p className="os-list-meta">Monthly planned amounts and annual costs spread — coming next.</p>
          </li>
        </ul>
      </nav>
    </div>
  );
}
