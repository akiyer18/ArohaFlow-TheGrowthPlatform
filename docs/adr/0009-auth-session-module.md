# Auth session module

Auth callers learned dual paths (`dataService.login/register` plus `supabase.auth` listeners) with Local-mode branches in pages. **Decision:** thin **Auth** session module — `login` / `logout` / `subscribeSession` (plus `getCurrentUser` for bootstrap). Local vs Supabase remain adapters behind `dataService` / `supabase.auth`. Google OAuth tokens for Gmail/Calendar stay on the Agent Service, not the client session.
