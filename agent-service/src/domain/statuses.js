/** Day Plan lifecycle */
export const DayPlanStatus = Object.freeze({
  EMPTY: 'empty',
  PROPOSED: 'proposed',
  LOCKED: 'locked',
});

/** Action WIP state */
export const ActionStatus = Object.freeze({
  ACTIVE: 'active',
  PARKED: 'parked',
  COMPLETED: 'completed',
});

/** Microaction lifecycle */
export const MicroactionStatus = Object.freeze({
  OPEN: 'open',
  COMPLETED: 'completed',
});

/** Day Plan Block kind */
export const BlockKind = Object.freeze({
  FIXED: 'fixed',
  FLEXIBLE: 'flexible',
});
