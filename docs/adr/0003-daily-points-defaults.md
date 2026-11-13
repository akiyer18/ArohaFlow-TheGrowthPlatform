# Daily Points defaults

Completion-only scoring needs starting weights so Today stays explainable. **Decision (v1 defaults, tunable without a new architecture):** Habit Check-in = 10, Microaction Completion = 20, Action Completion = 100, **Plan-ready Completion = 10**, Daily Point Target = 100. One score language (Daily Points); legacy Effort / Momentum / Flow Score are not shown in the new UI.

## Amendment — Streak rules (Today execution board — #19)

**Daily Points Streak (the Streak entity):** Keep **one freeze per week**. When the Daily Point Target is not met, one freeze per ISO week may preserve the Streak without counting that day as a break. Do **not** switch the Daily Points Streak to “never miss twice” in v1 — existing facade behaviour and #14 stay aligned.

**Habit consistency (per habit, Calendar View / Analytics):** Days a habit is **not scheduled** never break that habit’s consistency streak and never consume a Daily Points freeze. Only a **missed scheduled** habit day counts against that habit’s consistency. Habit consistency is reviewed on Analytics / Calendar View, not as a Today widget.
