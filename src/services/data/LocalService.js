import { isLocalDataSource, DEV_USER_ID } from '../../config/appConfig';

const DB_STORAGE_KEY = 'productive-calendar.local-db.v1';
const SESSION_STORAGE_KEY = 'productive-calendar.local-session.v1';

const USER_SCOPED_TABLES = new Set([
  'accounts',
  'transactions',
  'budget_categories',
  'planned_expenses',
  'income_ideas',
  'reminders',
  'tasks',
  'recipes',
  'meal_plans',
  'grocery_items',
  'user_inventory',
  'shopping_lists',
  'habits',
  'habit_logs',
  'calendar_events',
  'daily_flow_scores',
  'momentum_snapshots',
  'daily_reflection',
  'flow_sessions',
  'weekly_summaries',
  'daily_effort_scores',
  'momentum_history',
  'weekly_reflections',
  'mood_logs',
  'journal_entries',
  'knowledge_entries',
]);

const DEFAULT_TABLES = {
  accounts: [],
  transactions: [],
  budget_categories: [],
  planned_expenses: [],
  income_ideas: [],
  reminders: [],
  tasks: [],
  recipes: [],
  meal_plans: [],
  grocery_items: [],
  user_inventory: [],
  shopping_lists: [],
  recipe_categories: [],
  habits: [],
  habit_logs: [],
  recipe_ingredients: [],
  calendar_events: [],
  daily_flow_scores: [],
  momentum_snapshots: [],
  daily_reflection: [],
  flow_sessions: [],
  weekly_summaries: [],
  daily_effort_scores: [],
  momentum_history: [],
  weekly_reflections: [],
  mood_logs: [],
  journal_entries: [],
  knowledge_entries: [],
};

const nowIso = () => new Date().toISOString();

const safeClone = (value) => JSON.parse(JSON.stringify(value));

const normalizeRecord = (record) => {
  const cloned = { ...record };
  if (!cloned.created_at) cloned.created_at = nowIso();
  if (!cloned.updated_at) cloned.updated_at = nowIso();
  return cloned;
};

const buildLikeMatcher = (value, token) =>
  String(value ?? '').toLowerCase().includes(String(token ?? '').toLowerCase());

const parseOrCondition = (orExpression) =>
  String(orExpression)
    .split(',')
    .map((part) => {
      const [field, operator, value] = part.split('.');
      return { field, operator, value };
    })
    .filter((part) => part.field && part.operator);

class LocalQuery {
  constructor(service, tableName) {
    this.service = service;
    this.tableName = tableName;
    this.mode = 'select';
    this.selectExpression = '*';
    this.filters = [];
    this.orders = [];
    this.limitValue = null;
    this.rangeFrom = null;
    this.rangeTo = null;
    this.orConditions = [];
    this.payload = null;
    this.options = {};
    this.expectSingle = false;
    this.expectMaybeSingle = false;
  }

  select(expression = '*', options = {}) {
    this.selectExpression = expression;
    if (options && typeof options === 'object') this.options = { ...this.options, ...options };
    // Don't overwrite mode when chaining .insert().select().single() — we must stay in insert mode
    if (this.mode !== 'insert' && this.mode !== 'upsert') {
      this.mode = 'select';
    }
    return this;
  }

  insert(rows) {
    this.mode = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values) {
    this.mode = 'update';
    this.payload = values || {};
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  upsert(rows, options = {}) {
    this.mode = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.options = options;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  gte(field, value) {
    this.filters.push({ type: 'gte', field, value });
    return this;
  }

  lte(field, value) {
    this.filters.push({ type: 'lte', field, value });
    return this;
  }

  lt(field, value) {
    this.filters.push({ type: 'lt', field, value });
    return this;
  }

  neq(field, value) {
    this.filters.push({ type: 'neq', field, value });
    return this;
  }

  in(field, values) {
    const arr = Array.isArray(values) ? values : [values];
    this.filters.push({ type: 'in', field, value: arr });
    return this;
  }

  contains(field, value) {
    const arr = Array.isArray(value) ? value : [value];
    this.filters.push({ type: 'contains', field, value: arr });
    return this;
  }

  or(expression) {
    this.orConditions = parseOrCondition(expression);
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orders.push({ field, ascending });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  range(from, to) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    this.expectSingle = true;
    this.expectMaybeSingle = false;
    return this;
  }

  maybeSingle() {
    this.expectMaybeSingle = true;
    this.expectSingle = false;
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    try {
      if (this.mode === 'select') {
        let rows = this.service.resolveTableData(this.tableName);
        rows = this.applyScopedAccess(rows);
        rows = this.applyFilters(rows);
        rows = this.applyOrFilters(rows);
        rows = this.applyOrders(rows);
        const totalCount = this.options?.count === 'exact' ? rows.length : undefined;
        rows = this.applyRange(rows);
        rows = this.applyLimit(rows);
        rows = this.applySelectExpression(rows);
        const result = this.finalize(rows);
        if (result && totalCount !== undefined) result.count = totalCount;
        return result;
      }

      if (this.mode === 'insert') {
        const inserted = this.service.insertRows(this.tableName, this.payload || []);
        // Return inserted rows as-is for .select().single(); they were just created with correct user_id
        const rows = this.applySelectExpression(inserted);
        return this.finalize(rows);
      }

      if (this.mode === 'update') {
        let rows = this.service.resolveTableData(this.tableName);
        rows = this.applyScopedAccess(rows);
        rows = this.applyFilters(rows);
        rows = this.applyOrFilters(rows);
        const updated = this.service.updateRows(this.tableName, rows, this.payload || {});
        let selected = this.applySelectExpression(updated);
        selected = this.applyLimit(selected);
        return this.finalize(selected);
      }

      if (this.mode === 'delete') {
        let rows = this.service.resolveTableData(this.tableName);
        rows = this.applyScopedAccess(rows);
        rows = this.applyFilters(rows);
        rows = this.applyOrFilters(rows);
        this.service.deleteRows(this.tableName, rows);
        return { data: this.expectSingle ? null : [], error: null };
      }

      if (this.mode === 'upsert') {
        const rows = this.service.upsertRows(this.tableName, this.payload || [], this.options);
        const selected = this.applySelectExpression(this.applyScopedAccess(rows));
        return this.finalize(selected);
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  applyScopedAccess(rows) {
    if (!USER_SCOPED_TABLES.has(this.tableName)) {
      return rows;
    }

    const session = this.service.getCurrentSession();
    const userId = session?.user?.id;

    if (!userId) return [];
    return rows.filter((row) => row.user_id === userId);
  }

  applyFilters(rows) {
    return this.filters.reduce((result, filter) => {
      if (filter.type === 'eq') {
        return result.filter((row) => {
          const rowVal = row[filter.field];
          if (filter.field === 'archived' && filter.value === false) {
            return rowVal === false || rowVal === undefined;
          }
          return rowVal === filter.value;
        });
      }
      if (filter.type === 'gte') {
        return result.filter((row) => row[filter.field] >= filter.value);
      }
      if (filter.type === 'lte') {
        return result.filter((row) => row[filter.field] <= filter.value);
      }
      if (filter.type === 'lt') {
        return result.filter((row) => row[filter.field] < filter.value);
      }
      if (filter.type === 'neq') {
        return result.filter((row) => row[filter.field] !== filter.value);
      }
      if (filter.type === 'in') {
        const set = new Set(filter.value);
        return result.filter((row) => set.has(row[filter.field]));
      }
      if (filter.type === 'contains') {
        const arr = filter.value || [];
        return result.filter((row) => {
          const rowArr = row[filter.field];
          if (!Array.isArray(rowArr)) return false;
          return arr.every((v) => rowArr.includes(v));
        });
      }
      return result;
    }, rows);
  }

  applyOrFilters(rows) {
    if (this.orConditions.length === 0) return rows;

    return rows.filter((row) =>
      this.orConditions.some((condition) => {
        if (condition.operator === 'ilike') {
          const token = condition.value.replace(/^%|%$/g, '');
          return buildLikeMatcher(row[condition.field], token);
        }
        return false;
      })
    );
  }

  applyOrders(rows) {
    if (this.orders.length === 0) return rows;
    const ordered = [...rows];

    ordered.sort((a, b) => {
      for (const order of this.orders) {
        const left = a[order.field];
        const right = b[order.field];

        if (left === right) continue;
        if (left === undefined || left === null) return 1;
        if (right === undefined || right === null) return -1;

        if (left < right) return order.ascending ? -1 : 1;
        if (left > right) return order.ascending ? 1 : -1;
      }
      return 0;
    });

    return ordered;
  }

  applyRange(rows) {
    if (this.rangeFrom == null || this.rangeTo == null) return rows;
    const from = Math.max(0, this.rangeFrom);
    const to = Math.min(rows.length - 1, this.rangeTo);
    return rows.slice(from, to + 1);
  }

  applyLimit(rows) {
    if (!this.limitValue && this.limitValue !== 0) return rows;
    return rows.slice(0, this.limitValue);
  }

  applySelectExpression(rows) {
    const expression = String(this.selectExpression || '*').trim();
    if (expression === '*' || expression === '') return rows;

    const hasRelationship = expression.includes('accounts:account_id');
    if (!hasRelationship) {
      const fields = expression
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean);

      return rows.map((row) => {
        const projected = {};
        fields.forEach((field) => {
          projected[field] = row[field];
        });
        return projected;
      });
    }

    const accountFieldsMatch = expression.match(/accounts:account_id\s*\(([^)]+)\)/);
    const accountFields = accountFieldsMatch
      ? accountFieldsMatch[1]
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean)
      : ['id', 'name', 'type', 'currency'];

    return rows.map((row) => {
      const account = this.service.resolveTableData('accounts').find((acc) => acc.id === row.account_id) || null;
      const selectedAccount = account
        ? accountFields.reduce((result, field) => {
            result[field] = account[field];
            return result;
          }, {})
        : null;

      return {
        ...row,
        accounts: selectedAccount,
      };
    });
  }

  finalize(rows) {
    if (this.expectMaybeSingle) {
      if (!rows || rows.length === 0) return { data: null, error: null };
      if (rows.length > 1) return { data: null, error: new Error('Multiple rows found') };
      return { data: rows[0], error: null };
    }
    if (!this.expectSingle) {
      return { data: rows, error: null };
    }
    if (!rows || rows.length === 0) {
      return { data: null, error: new Error('No rows found') };
    }
    return { data: rows[0], error: null };
  }
}

export class LocalService {
  constructor() {
    this.listeners = new Set();
    this.ensureDatabase();
    this.ensureSession();
    this.client = {
      from: (tableName) => new LocalQuery(this, tableName),
      auth: this.buildAuthClient(),
    };
  }

  getClient() {
    return this.client;
  }

  async getUser() {
    const session = this.getCurrentSession();
    return { user: session?.user ?? null, error: null };
  }

  async login(identifier, password) {
    const data = await this.client.auth.signInWithPassword({ email: identifier, password });
    return data;
  }

  async register(identifier, password, metadata = {}) {
    const data = await this.client.auth.signUp({
      email: identifier,
      password,
      options: { data: metadata },
    });
    return data;
  }

  async logout() {
    return this.client.auth.signOut();
  }

  async fetchData(table, applyQuery) {
    let query = this.client.from(table).select('*');
    if (typeof applyQuery === 'function') {
      query = applyQuery(query);
    }
    return query;
  }

  async saveData(table, operation, payload, applyQuery) {
    let query = this.client.from(table);

    if (operation === 'insert') query = query.insert(payload);
    else if (operation === 'update') query = query.update(payload);
    else if (operation === 'delete') query = query.delete();
    else if (operation === 'upsert') query = query.upsert(payload);
    else throw new Error(`Unsupported operation "${operation}"`);

    if (typeof applyQuery === 'function') {
      query = applyQuery(query);
    }
    return query;
  }

  resolveTableData(tableName) {
    if (tableName === 'meal_plans_with_recipes') {
      const mealPlans = this.readTable('meal_plans');
      const recipes = this.readTable('recipes');
      const recipeById = new Map(recipes.map((r) => [String(r.id), r]));

      return mealPlans.map((plan) => {
        const id = plan.recipe_id != null ? String(plan.recipe_id) : null;
        const recipe = id ? recipeById.get(id) : null;
        return {
          ...plan,
          recipe_name: recipe?.name ?? 'Unknown Recipe',
          ingredients: recipe?.ingredients || [],
          cooking_time: recipe?.cooking_time ?? null,
        };
      });
    }

    return this.readTable(tableName);
  }

  readTable(tableName) {
    const db = this.readDatabase();
    return safeClone(db.tables[tableName] || []);
  }

  insertRows(tableName, rows) {
    if (tableName === 'meal_plans_with_recipes') {
      throw new Error('Cannot insert into a derived local view table');
    }

    const db = this.readDatabase();
    const userId = this.getCurrentSession()?.user?.id || null;
    const nextRows = rows.map((row) => {
      const nextId = db.counters[tableName] || 1;
      db.counters[tableName] = nextId + 1;

      const normalized = normalizeRecord({
        ...row,
        id: row.id ?? nextId,
      });

      if (USER_SCOPED_TABLES.has(tableName) && !normalized.user_id && userId) {
        normalized.user_id = userId;
      }

      return normalized;
    });

    db.tables[tableName] = [...(db.tables[tableName] || []), ...nextRows];
    this.writeDatabase(db);
    return safeClone(nextRows);
  }

  updateRows(tableName, matchedRows, payload) {
    if (tableName === 'meal_plans_with_recipes') {
      throw new Error('Cannot update a derived local view table');
    }

    const db = this.readDatabase();
    const matchedIds = new Set(matchedRows.map((row) => row.id));

    db.tables[tableName] = (db.tables[tableName] || []).map((row) => {
      if (!matchedIds.has(row.id)) return row;
      return {
        ...row,
        ...payload,
        updated_at: nowIso(),
      };
    });

    this.writeDatabase(db);
    return (db.tables[tableName] || []).filter((row) => matchedIds.has(row.id));
  }

  deleteRows(tableName, matchedRows) {
    const db = this.readDatabase();
    const matchedIds = new Set(matchedRows.map((row) => row.id));
    db.tables[tableName] = (db.tables[tableName] || []).filter((row) => !matchedIds.has(row.id));
    this.writeDatabase(db);
  }

  upsertRows(tableName, rows, options = {}) {
    const db = this.readDatabase();
    const conflictFields = String(options.onConflict || 'id')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);
    const table = [...(db.tables[tableName] || [])];
    const sessionUserId = this.getCurrentSession()?.user?.id || null;
    const output = [];

    rows.forEach((incoming) => {
      const normalizedIncoming = normalizeRecord({
        ...incoming,
        ...(USER_SCOPED_TABLES.has(tableName) && !incoming.user_id && sessionUserId
          ? { user_id: sessionUserId }
          : {}),
      });

      const existingIndex = table.findIndex((row) =>
        conflictFields.every((field) => row[field] === normalizedIncoming[field])
      );

      if (existingIndex >= 0) {
        table[existingIndex] = {
          ...table[existingIndex],
          ...normalizedIncoming,
          updated_at: nowIso(),
        };
        output.push(table[existingIndex]);
        return;
      }

      const nextId = db.counters[tableName] || 1;
      db.counters[tableName] = nextId + 1;
      const inserted = {
        ...normalizedIncoming,
        id: normalizedIncoming.id ?? nextId,
      };
      table.push(inserted);
      output.push(inserted);
    });

    db.tables[tableName] = table;
    this.writeDatabase(db);
    return safeClone(output);
  }

  buildAuthClient() {
    return {
      getUser: async () => {
        const session = this.getCurrentSession();
        return { data: { user: session?.user ?? null }, error: null };
      },
      getSession: async () => {
        const session = this.getCurrentSession();
        return { data: { session }, error: null };
      },
      signInWithPassword: async ({ email }) => {
        const session = this.createSessionFromIdentifier(email);
        this.setSession(session);
        this.emitAuthChange('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      },
      signUp: async ({ email, options }) => {
        const metadata = options?.data || {};
        const session = this.createSessionFromIdentifier(email, metadata);
        this.setSession(session);
        this.emitAuthChange('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => {
        this.clearSession();
        this.emitAuthChange('SIGNED_OUT', null);
        return { error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async ({ data }) => {
        const session = this.getCurrentSession();
        if (!session?.user) {
          return { data: null, error: new Error('No authenticated user') };
        }

        const nextSession = {
          ...session,
          user: {
            ...session.user,
            user_metadata: {
              ...(session.user.user_metadata || {}),
              ...(data || {}),
            },
          },
        };
        this.setSession(nextSession);
        this.emitAuthChange('USER_UPDATED', nextSession);
        return { data: { user: nextSession.user }, error: null };
      },
      onAuthStateChange: (callback) => {
        this.listeners.add(callback);
        const currentSession = this.getCurrentSession();
        callback('INITIAL_SESSION', currentSession);
        return {
          data: {
            subscription: {
              unsubscribe: () => this.listeners.delete(callback),
            },
          },
        };
      },
    };
  }

  emitAuthChange(event, session) {
    this.listeners.forEach((listener) => {
      listener(event, session);
    });
  }

  createSessionFromIdentifier(identifier = '', metadata = {}) {
    const normalized = String(identifier || '').trim();
    const fallbackEmail = normalized.includes('@') ? normalized : `${normalized || 'local-user'}@local.dev`;
    const name = metadata.name || fallbackEmail.split('@')[0] || 'Local User';
    const userId = isLocalDataSource ? DEV_USER_ID : this.toStableUserId(fallbackEmail);

    return {
      access_token: `local-token-${userId}`,
      token_type: 'bearer',
      user: {
        id: userId,
        email: fallbackEmail,
        created_at: nowIso(),
        email_confirmed_at: nowIso(),
        user_metadata: {
          name,
        },
      },
    };
  }

  toStableUserId(identifier) {
    const normalized = String(identifier || 'local-user').toLowerCase();
    const encoded = encodeURIComponent(normalized).replace(/%/g, '').slice(0, 32);
    return `local-${encoded}`;
  }

  ensureDatabase() {
    const existing = localStorage.getItem(DB_STORAGE_KEY);
    if (existing) {
      try {
        const db = JSON.parse(existing);
        this.patchDatabaseTables(db);
        return;
      } catch {
        localStorage.removeItem(DB_STORAGE_KEY);
      }
    }

    const db = {
      tables: safeClone(DEFAULT_TABLES),
      counters: Object.keys(DEFAULT_TABLES).reduce((acc, table) => {
        acc[table] = 1;
        return acc;
      }, {}),
    };
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  }

  patchDatabaseTables(db) {
    let changed = false;
    const tables = db.tables || {};
    const counters = db.counters || {};
    Object.keys(DEFAULT_TABLES).forEach((table) => {
      if (!Array.isArray(tables[table])) {
        tables[table] = [];
        changed = true;
      }
      if (counters[table] == null) {
        counters[table] = 1;
        changed = true;
      }
    });
    db.tables = tables;
    db.counters = counters;
    if (changed) this.writeDatabase(db);
  }

  ensureSession() {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(null));
  }

  readDatabase() {
    this.ensureDatabase();
    const raw = localStorage.getItem(DB_STORAGE_KEY);
    const db = raw ? JSON.parse(raw) : { tables: safeClone(DEFAULT_TABLES), counters: {} };
    this.patchDatabaseTables(db);
    return db;
  }

  writeDatabase(db) {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  }

  getCurrentSession() {
    this.ensureSession();
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  setSession(session) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  }

  clearSession() {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(null));
  }
}
