import React, { useEffect, useMemo, useState } from 'react';
import {
  getCalendarMonth,
  getCalendarWeek,
  WEEKDAYS,
  monthLabel,
  buildMonthCells,
  buildWeekCells,
  indexByDate,
} from '../modules/calendar-view';

function statusClass(status) {
  if (status === 'done') return 'os-heat-done';
  if (status === 'missed') return 'os-heat-missed';
  if (status === 'planned') return 'os-heat-planned';
  return 'os-heat-off';
}

export default function CalendarViewPage() {
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [habitFilter, setHabitFilter] = useState('gym');
  const [viewMode, setViewMode] = useState('month');
  const [weekData, setWeekData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getCalendarMonth();
        if (cancelled) return;
        setData(payload);
        setHabitFilter(payload.habits[0]?.id ?? 'gym');
        setStatus('full');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'week' || !data?.month) return undefined;
    let cancelled = false;
    (async () => {
      const week = await getCalendarWeek({ date: `${data.month}-13` });
      if (!cancelled) setWeekData(week);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewMode, data?.month]);

  const calendarCells = useMemo(() => {
    if (!data) return [];
    if (viewMode === 'week') {
      return weekData?.weekDates ?? buildWeekCells(`${data.month}-13`);
    }
    return buildMonthCells(data.month);
  }, [data, viewMode, weekData]);

  const surface = viewMode === 'week' && weekData ? weekData : data;

  const heatByDate = useMemo(() => {
    const map = new Map();
    if (!surface) return map;
    for (const cell of surface.habitDays ?? []) {
      if (cell.habitId !== habitFilter) continue;
      map.set(cell.date, cell);
    }
    return map;
  }, [surface, habitFilter]);

  const eventsByDate = useMemo(
    () => indexByDate(surface?.events, (event) => event.startAt?.slice(0, 10)),
    [surface],
  );

  const blocksByDate = useMemo(() => {
    const map = new Map();
    if (!surface) return map;
    for (const plan of surface.dayPlans ?? []) {
      map.set(plan.date, plan.blocks ?? []);
    }
    return map;
  }, [surface]);

  const activeHabit = data?.habits.find((h) => h.id === habitFilter);
  const consistency = data?.habitConsistency.find((h) => h.habitId === habitFilter);

  return (
    <div className="os-stack">
      <div className="os-toolbar">
        <div>
          <h1 className="os-panel-title" style={{ fontSize: 'var(--text-xl)' }}>
            Calendar
          </h1>
          <p className="os-meta">
            Month surface · habit anchors · heatmap (unscheduled days never break consistency)
          </p>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="os-state os-skeleton" aria-busy="true">
          <span style={{ width: '40%' }} />
          <span style={{ width: '70%' }} />
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="os-state" role="alert">
          Could not load Calendar View.
        </div>
      ) : null}

      {status === 'full' && data ? (
        <>
          <section className="os-panel" aria-labelledby="habit-anchors-heading">
            <h2 id="habit-anchors-heading" className="os-panel-title">
              Habit anchors
            </h2>
            <ul className="os-list">
              {data.habits.map((habit) => (
                <li key={habit.id}>
                  <button
                    type="button"
                    className={`os-block-btn${habitFilter === habit.id ? ' os-block-btn-active' : ''}`}
                    onClick={() => setHabitFilter(habit.id)}
                    aria-pressed={habitFilter === habit.id}
                  >
                    <span className="os-list-title">{habit.label}</span>
                    <span className="os-list-meta">
                      {habit.timeAnchor} ·{' '}
                      {habit.scheduledDays.map((d) => WEEKDAYS[d]).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {consistency ? (
              <p className="os-meta" style={{ marginTop: 'var(--space-sm)' }}>
                {activeHabit?.label}: consistency streak {consistency.consistencyStreak} ·{' '}
                {consistency.checkInsInMonth}/{consistency.scheduledDaysInMonth} scheduled days
                this month
              </p>
            ) : null}
          </section>

          <section className="os-panel" aria-labelledby="month-heading">
            <div className="os-toolbar" style={{ marginBottom: 'var(--space-sm)' }}>
              <h2 id="month-heading" className="os-panel-title">
                {viewMode === 'week' && weekData
                  ? `Week of ${weekData.weekStart}`
                  : monthLabel(data.month)}
              </h2>
              <div className="os-nav" role="group" aria-label="Calendar range">
                <button
                  type="button"
                  className={`os-btn${viewMode === 'month' ? ' os-block-btn-active' : ''}`}
                  onClick={() => setViewMode('month')}
                  aria-pressed={viewMode === 'month'}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`os-btn${viewMode === 'week' ? ' os-block-btn-active' : ''}`}
                  onClick={() => setViewMode('week')}
                  aria-pressed={viewMode === 'week'}
                >
                  Week
                </button>
              </div>
            </div>
            <div className="os-cal-weekdays" aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div
              className="os-cal-grid"
              role="grid"
              aria-label={`${viewMode === 'week' ? 'Week' : monthLabel(data.month)} heatmap`}
            >
              {calendarCells.map((date, idx) => {
                if (!date) {
                  return <div key={`pad-${idx}`} className="os-cal-cell os-cal-pad" />;
                }
                const heat = heatByDate.get(date);
                const dayNum = Number(date.slice(-2));
                const events = eventsByDate.get(date) ?? [];
                const blocks = blocksByDate.get(date) ?? [];
                return (
                  <div
                    key={date}
                    className={`os-cal-cell ${statusClass(heat?.status)}`}
                    role="gridcell"
                    aria-label={`${date}: ${heat?.status ?? 'off'}`}
                  >
                    <span className="os-cal-day">{dayNum}</span>
                    {activeHabit && heat?.scheduled ? (
                      <span className="os-cal-anchor">{activeHabit.timeAnchor}</span>
                    ) : null}
                    {events[0] ? <span className="os-cal-chip">{events[0].title}</span> : null}
                    {blocks[0] ? (
                      <span className="os-cal-chip os-cal-chip-plan">{blocks[0].title}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="os-meta" style={{ marginTop: 'var(--space-sm)' }}>
              Heatmap: done · missed · off (unscheduled) · planned. Off days do not break the
              habit streak.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
