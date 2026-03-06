import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from '../components/layout/AppHeader';
import { PageContainer } from '../components/ui';
import {
  getJournalEntryByDate,
  getJournalDatesWithEntries,
  upsertJournalEntry,
  getPromptForDate,
} from '../services';
import { getTimeTheme, TIME_PERIODS } from '../utils/timeTheme';
import { toDateKey } from '../utils/date';

const AUTOSAVE_DELAY_MS = 1800;

/** Compact 1–5 slider with label and value. Unset shows – and slider at middle. */
function ScaleSlider({ label, low, high, value, onChange }) {
  const v = value ?? null;
  const inputValue = v ?? 3;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-app-text-muted">{label}</span>
        <span className="text-sm font-medium tabular-nums text-app-text-primary w-6 text-right">
          {v ?? '–'}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={inputValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-white/10 accent-indigo-500"
        style={{ color: 'inherit' }}
      />
      <div className="flex justify-between text-[10px] text-app-text-muted">
        <span>1 {low}</span>
        <span>5 {high}</span>
      </div>
    </div>
  );
}

function getRangeForHistory() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
}

export default function Journal() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const today = toDateKey(new Date());
  const openedAtRef = useRef(Date.now());
  const saveTimeoutRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historyDates, setHistoryDates] = useState([]);
  const [entry, setEntry] = useState({
    mood: null,
    energy: null,
    focus: null,
    stress: null,
    reflectionText: '',
    smallWin: '',
    tomorrowIntention: '',
    confidenceTomorrow: null,
  });
  const [prompt, setPrompt] = useState({ key: '', text: '' });
  const [reflectionExpanded, setReflectionExpanded] = useState(false);

  const loadEntryForDate = useCallback(async (dateStr) => {
    setLoading(true);
    try {
      const [existing, promptForDay] = await Promise.all([
        getJournalEntryByDate(dateStr),
        Promise.resolve(getPromptForDate(dateStr)),
      ]);
      setPrompt(promptForDay);
      if (existing) {
        setEntry({
          mood: existing.mood ?? null,
          energy: existing.energy ?? null,
          focus: existing.focus ?? null,
          stress: existing.stress ?? null,
          reflectionText: existing.reflection_text ?? '',
          smallWin: existing.small_win ?? '',
          tomorrowIntention: existing.tomorrow_intention ?? '',
          confidenceTomorrow: existing.confidence_tomorrow ?? null,
        });
        setReflectionExpanded((existing.reflection_text || '').length > 0);
      } else {
        setEntry({
          mood: null,
          energy: null,
          focus: null,
          stress: null,
          reflectionText: '',
          smallWin: '',
          tomorrowIntention: '',
          confidenceTomorrow: null,
        });
        setReflectionExpanded(false);
      }
    } catch (err) {
      console.error('Journal load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntryForDate(selectedDate);
  }, [selectedDate, loadEntryForDate]);

  useEffect(() => {
    const { startDate, endDate } = getRangeForHistory();
    getJournalDatesWithEntries(startDate, endDate).then(setHistoryDates);
  }, [selectedDate, saving]);

  const save = useCallback(
    async (payload) => {
      if (saving) return;
      setSaving(true);
      try {
        const sessionLength = Math.round((Date.now() - openedAtRef.current) / 1000);
        await upsertJournalEntry(
          {
            date: selectedDate,
            prompt_key: prompt.key,
            ...payload,
          },
          sessionLength
        );
        const { startDate, endDate } = getRangeForHistory();
        getJournalDatesWithEntries(startDate, endDate).then(setHistoryDates);
      } catch (err) {
        console.error('Journal save', err);
      } finally {
        setSaving(false);
      }
    },
    [selectedDate, prompt.key, saving]
  );

  const scheduleSave = useCallback(
    (next) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        save(next);
        saveTimeoutRef.current = null;
      }, AUTOSAVE_DELAY_MS);
    },
    [save]
  );

  const update = useCallback(
    (updates) => {
      setEntry((prev) => {
        const next = { ...prev, ...updates };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const timeTheme = getTimeTheme();
  const hint =
    timeTheme.period === TIME_PERIODS.MORNING
      ? 'Set a gentle intention for the day.'
      : timeTheme.period === TIME_PERIODS.EVENING || timeTheme.period === TIME_PERIODS.NIGHT
        ? 'A moment to reflect.'
        : null;

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Journal" subtitle="Daily check-in" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
        <PageContainer>
          <div className="py-12 text-center text-app-text-muted">Loading…</div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader
        title="Journal"
        subtitle="Daily check-in"
        onLogout={() => { logout(); navigate('/login'); }}
        backTo="/dashboard"
      />
      <PageContainer className="max-w-xl">
        <header className="flow-section text-center">
          <h1 className="text-xl font-semibold text-app-text-primary tracking-tight">
            Reflect for a moment.
          </h1>
          {hint && selectedDate === today && (
            <p className="mt-1 text-sm text-app-text-muted">{hint}</p>
          )}
        </header>

        {/* Date selector + Save */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-app-text-muted">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-app-text-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => save(entry)}
              disabled={saving}
              className="rounded-lg border border-violet-500/40 bg-violet-500/20 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-500/30 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </div>
        </section>

        {/* Past entries */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-4">
          <h2 className="text-sm font-medium text-app-text-muted mb-2">Past entries</h2>
          <p className="text-xs text-app-text-muted mb-2">Click a date to view or edit that day’s log.</p>
          {historyDates.length === 0 ? (
            <p className="text-xs text-app-text-muted">No saved logs in the last 90 days.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {historyDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    selectedDate === d
                      ? 'bg-violet-500/30 text-violet-200 border border-violet-500/40'
                      : 'bg-white/5 text-app-text-muted hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 1. Daily state */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-6">
          <h2 className="text-sm font-medium text-app-text-muted mb-4">How you feel</h2>
          <div className="grid grid-cols-2 gap-6">
            <ScaleSlider
              label="Mood"
              low="very low"
              high="excellent"
              value={entry.mood}
              onChange={(v) => update({ mood: v })}
            />
            <ScaleSlider
              label="Energy"
              low="exhausted"
              high="energized"
              value={entry.energy}
              onChange={(v) => update({ energy: v })}
            />
            <ScaleSlider
              label="Focus"
              low="scattered"
              high="focused"
              value={entry.focus}
              onChange={(v) => update({ focus: v })}
            />
            <ScaleSlider
              label="Stress"
              low="calm"
              high="overwhelmed"
              value={entry.stress}
              onChange={(v) => update({ stress: v })}
            />
          </div>
        </section>

        {/* 2. Reflection */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-6">
          <h2 className="text-sm font-medium text-app-text-muted mb-2">{prompt.text}</h2>
          {reflectionExpanded ? (
            <textarea
              value={entry.reflectionText}
              onChange={(e) => update({ reflectionText: e.target.value })}
              onBlur={() => { if (!entry.reflectionText.trim()) setReflectionExpanded(false); }}
              placeholder="Optional…"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-app-text-primary placeholder:text-app-text-muted focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent/30 resize-y min-h-[100px]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setReflectionExpanded(true)}
              className="w-full rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-3 text-left text-sm text-app-text-muted hover:bg-white/10 hover:border-white/20 transition-colors"
            >
              Add a thought…
            </button>
          )}
        </section>

        {/* 3. Small win or gratitude */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-6">
          <h2 className="text-sm font-medium text-app-text-muted mb-3">A small win or gratitude</h2>
          <input
            type="text"
            value={entry.smallWin}
            onChange={(e) => update({ smallWin: e.target.value })}
            placeholder="A small win, gratitude, or positive moment"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-app-text-primary placeholder:text-app-text-muted focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent/30"
          />
        </section>

        {/* 4. Tomorrow intention */}
        <section className="flow-section rounded-2xl border border-white/5 bg-white/[0.06] backdrop-blur-md p-6">
          <h2 className="text-sm font-medium text-app-text-muted mb-3">Tomorrow</h2>
          <input
            type="text"
            value={entry.tomorrowIntention}
            onChange={(e) => update({ tomorrowIntention: e.target.value })}
            placeholder="One intention for tomorrow"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-app-text-primary placeholder:text-app-text-muted focus:border-app-accent focus:outline-none focus:ring-1 focus:ring-app-accent/30 mb-4"
          />
          <ScaleSlider
            label="Confidence for tomorrow"
            low="uncertain"
            high="confident"
            value={entry.confidenceTomorrow}
            onChange={(v) => update({ confidenceTomorrow: v })}
          />
        </section>

        {saving && (
          <p className="flow-section text-center text-xs text-app-text-muted">Saving…</p>
        )}
      </PageContainer>
    </div>
  );
}
