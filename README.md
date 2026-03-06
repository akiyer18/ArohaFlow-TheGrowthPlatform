# Aroha Flow: The Growth Platform

A modern growth and productivity platform that unifies tasks, habits, meals, events, finances, journal, and knowledge expansion in one place. Built with React, Vite, Tailwind CSS, and optional Supabase or local storage.

---

## Table of contents
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Clone and run locally](#clone-and-run-locally)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Project structure](#project-structure)
- [Forking and attribution](#forking-and-attribution)
- [Maintaining this repository](#maintaining-this-repository)
- [License](#license)

---

## Screenshots
<img width="1500" height="978" alt="Screenshot 2026-02-26 at 17 49 52" src="https://github.com/user-attachments/assets/70197984-d9ad-4de1-ac52-f463662884b4" />
<img width="1362" height="815" alt="Screenshot 2026-02-26 at 17 50 23" src="https://github.com/user-attachments/assets/e45841dc-7593-48c7-8d73-4b8fd9412cd9" />
<img width="1339" height="714" alt="Screenshot 2026-02-26 at 17 50 57" src="https://github.com/user-attachments/assets/b022a63c-911b-49f2-9983-ebd3fb27cf4d" />
<img width="1337" height="785" alt="Screenshot 2026-02-26 at 17 51 18" src="https://github.com/user-attachments/assets/780cf7b6-94b3-4242-9f2b-52dad31dedfc" />
<img width="1327" height="959" alt="Screenshot 2026-02-26 at 17 51 43" src="https://github.com/user-attachments/assets/db9cc08b-c20c-468f-9064-9870b91e00cd" />



## Features

- **Authentication** — Login and registration (Supabase Auth in production; local session in dev)
- **Protected routes** — All app modules require sign-in
- **Dark theme** — Consistent SaaS-style UI with glass cards and clear hierarchy
- **Responsive layout** — Usable on desktop and mobile
- **Data source switching** — Use Supabase (production) or browser local storage (local) via one env variable

## Applications (functional)

| Application            | Route                 | Description |
|------------------------|-----------------------|-------------|
| **Dashboard**          | `/dashboard`          | Hub to open all modules. |
| **Money Mastery**      | `/money-tracker`     | Track expenses, accounts, budgets, planned expenses, and income ideas. |
| **Meal Planning**      | `/meal-planning`     | Create and edit recipes, star favorites, add recipes to meal plans by date/meal type, generate grocery list from planned meals. Supports “Add Recipe with AI” (parse from URL). |
| **Smart Calendar**     | `/smart-calendar`     | Unified calendar: month/week view, day detail panel with habits, tasks, meals, events, and knowledge entries. |
| **Task Manager**      | `/task-manager`      | Create, edit, complete, and delete tasks with due date, priority, category, and status. |
| **Grocery List**      | `/grocery-list`      | Manage grocery items and inventory; generate list from meal plans. |
| **Habit Tracker**     | `/habit-tracker`     | Create habits (daily, specific days, or weekly count), log completions, view streaks and contribution grid. |
| **Journal**           | `/journal`           | Daily reflection and mood tracking. |
| **Knowledge Expansion**| `/knowledge-expansion` | Structured learning journal: capture what you learn, tag it, and build a second brain. |

---

## Tech stack

- **Frontend:** React 18, Vite  
- **Styling:** Tailwind CSS (design tokens: `app-*` for colors, radius, shadows)  
- **Routing:** React Router DOM v6  
- **Auth & data:** Supabase (production) or local adapter (dev) — switch via `VITE_DATA_SOURCE`  
- **Icons:** Lucide React  
- **Animations:** Framer Motion  

**Optional (Python):** Jupyter notebook in `calendar lofic/` uses Google Calendar API; see [requirements.txt](#python-optional) for Python deps.

---

## Clone and run locally

### Prerequisites

- **Node.js** 18+ and **npm**
- (Optional) **Python 3.8+** and **pip** if you use the calendar notebook

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Productive_Calander.git
   cd Productive_Calander
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```
   All JavaScript/React dependencies are listed in **`package.json`**. This is the single source of truth for the web app.

   **Optional (Python):** If you use the Jupyter notebook in `calendar lofic/`, install Python deps:
   ```bash
   pip install -r requirements.txt
   ```

3. **Create your environment file**
   - Copy the example below into a new file named **`.env`** in the project root (see [Environment variables](#environment-variables)).
   - **Do not commit `.env`** — it is listed in `.gitignore`. Use `.env.example` in the repo only as a template (no real keys).

4. **Choose data source**
   - **Local (no backend):** Set `VITE_DATA_SOURCE=local`. No database or Supabase needed; data lives in browser localStorage under a fixed dev user.
   - **Supabase:** Set `VITE_DATA_SOURCE=production` and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Then run the [database setup](#database-setup) in Supabase.

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. `http://localhost:5173`).

6. **Build for production**
   ```bash
   npm run build
   ```
   Output is in `dist/`. Use `npm run preview` to test the production build locally.

---

## Environment variables

Create a **`.env`** file in the project root. These variables are used by the Vite app (prefix `VITE_` is required for client-side access).

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_DATA_SOURCE` | Yes | `local` = no backend, localStorage only. `production` = Supabase auth and database. |
| `VITE_SUPABASE_URL` | If production | Your Supabase project URL (e.g. `https://xxxxx.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | If production | Supabase anonymous (public) key from Project Settings → API. |
| `OPENAI_API_KEY` | Optional | Used for “Add Recipe with AI” (URL parsing). Get from OpenAI. |

**Example `.env` (local development, no Supabase):**
```env
VITE_DATA_SOURCE=local
```

**Example `.env` (production / Supabase):**
```env
VITE_DATA_SOURCE=production
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-...   # optional, for recipe parsing
```

- Never commit real keys. Add `.env` to `.gitignore` (already done).
- You can add a **`.env.example`** in the repo with placeholder values and no secrets, so others know which variables to set.

---

## Database setup

What you need depends on **`VITE_DATA_SOURCE`**.

### Local (`VITE_DATA_SOURCE=local`)

- **No SQL or database required.**
- Data is stored in the browser **localStorage** under one fixed dev user.
- Tables are created automatically in the local adapter; you can start the app and use it immediately.

### Supabase (`VITE_DATA_SOURCE=production`)

1. Create a project at [supabase.com](https://supabase.com) and copy **Project URL** and **anon key** into `.env`.

2. **Run the main schema** in the Supabase **SQL Editor** (New query):
   - Paste and run **`database/init-all.sql`**.
   - This creates core tables (accounts, transactions, tasks, habits, habit_logs, recipes, meal_plans, grocery_items, calendar_events, etc.), indexes, and RLS policies. Safe to run once (idempotent).

3. **Optional module schemas** (run if you use these features):
   - **Journal:** `database/journal-schema.sql`
   - **Knowledge Expansion:** `database/knowledge-expansion-schema.sql`
   - **Momentum / flow:** `database/momentum-engine-schema.sql` (or `phase1-momentum-schema.sql`, `recipe-parse-schema.sql` as needed)
   - **Tasks (alternate):** `src/database/tasks-schema.sql`
   - **Meal/grocery (alternate):** `src/database/meal-grocery-schema.sql`

4. **Order:** Run `init-all.sql` first; then run any of the optional SQL files above in any order. Each uses `CREATE TABLE IF NOT EXISTS` and idempotent policies where applicable.

More detail: **`database/README-init.md`**.

---

## Project structure

```
Productive_Calander/
├── src/
│   ├── components/     # layout, ui, habit-tracker, meal-planning, flow
│   ├── contexts/      # AuthContext, TimeThemeContext
│   ├── pages/         # Login, Register, Dashboard, *Tracker, *Calendar, Journal, KnowledgeExpansion
│   ├── modules/       # smart-calendar, knowledge-expansion
│   ├── services/      # API layer; data layer in services/data/
│   ├── config/        # supabase client, appConfig
│   ├── lib/            # db logger, initDatabase
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── database/           # SQL schemas and migrations (init-all.sql, journal, knowledge-expansion, etc.)
├── package.json        # Node dependencies (single source of truth for the app)
├── requirements.txt    # Python dependencies (optional; for Jupyter notebook)
├── .env                # Your local env (not committed; copy from .env.example)
└── .env.example        # Template for env vars (no secrets)
```

---

## Forking and attribution

- You are welcome to **fork** this repository and use or modify it for your own projects.
- If you distribute your fork or build something public on top of it, we ask that you:
  - **Credit the original project** (e.g. in your README or “About” section):
    - *“Based on [Aroha Flow](https://github.com/YOUR_ORG/Productive_Calander).”*
  - Keep the **license** (MIT) and any existing copyright notices in the repo.
- This helps others trace the origin of the code and supports open source.

---

## Maintaining this repository

How developers typically keep a repo like this in good shape:

1. **Dependencies**
   - **Node:** All app libraries are in **`package.json`**. Run `npm install` after pull. Use `npm update` (or Dependabot) to refresh versions; test before merging.
   - **Python:** If you use the calendar notebook or scripts, keep **`requirements.txt`** in sync and run `pip install -r requirements.txt` in the right environment.

2. **Database**
   - Schema changes go in **`database/`** (or `src/database/`) as new or updated `.sql` files. Prefer **idempotent** scripts (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` then `CREATE POLICY`).
   - Document new tables and env vars in this README and in `database/README-init.md`.

3. **Environment**
   - Keep **`.env.example`** updated with every variable the app expects (no real keys). New contributors copy it to `.env` and fill in values.

4. **Version control**
   - Use **branches** for features/fixes; merge via PRs when possible. Tag **releases** (e.g. `v1.0.0`) for clarity.
   - Keep **.gitignore** strict: `.env`, `node_modules`, `dist`, and any secrets or local config.

5. **Docs**
   - Update this README when you add env vars, new modules, or database steps. A short changelog or “Recent changes” section helps.

6. **CI (optional)**
   - Add a small CI job (e.g. GitHub Actions) to run `npm run lint` and `npm run build` on push/PR so the main branch stays buildable.

---

## License

MIT License.
