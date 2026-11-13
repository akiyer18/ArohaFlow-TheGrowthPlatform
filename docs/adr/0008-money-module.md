# Money module behind MoneyTracker

MoneyTracker orchestrated many service imports (`loadAllData` Promise.all), so balance invariants and expense side effects lacked locality. **Decision:** deepen a **Money** module with a small interface — `getOverview`, `recordExpense`, `analyzeStatement`. The page is a thin client. Existing `*Service` / statement parsers remain adapters. ADR-0004 keeps Money in primary nav — deepen in place, do not drop from nav.
