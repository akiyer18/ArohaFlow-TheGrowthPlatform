/**
 * In-memory Supabase-shaped client for Store adapter tests (no live credentials).
 * Supports the chain subset createSupabaseStore uses: from → select/upsert/insert/update/delete → eq/order/limit/maybeSingle.
 */
export function createFakeSupabaseClient() {
  /** @type {Record<string, object[]>} */
  const tables = Object.create(null);

  function rows(table) {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  }

  function matchEq(row, filters) {
    return filters.every(([col, val]) => row[col] === val);
  }

  function createBuilder(table) {
    /** @type {Array<[string, unknown]>} */
    const filters = [];
    let orderCol = null;
    let orderAsc = true;
    let limitN = null;
    let pendingWrite = null;

    const builder = {
      select() {
        return builder;
      },
      upsert(payload, options = {}) {
        pendingWrite = { type: 'upsert', payload, options };
        return builder;
      },
      insert(payload) {
        pendingWrite = { type: 'insert', payload };
        return builder;
      },
      update(patch) {
        pendingWrite = { type: 'update', patch };
        return builder;
      },
      delete() {
        pendingWrite = { type: 'delete' };
        return builder;
      },
      eq(col, val) {
        filters.push([col, val]);
        return builder;
      },
      order(col, options = {}) {
        orderCol = col;
        orderAsc = options.ascending !== false;
        return builder;
      },
      limit(n) {
        limitN = n;
        return builder;
      },
      async maybeSingle() {
        const { data, error } = await builder;
        if (error) return { data: null, error };
        if (!data || data.length === 0) return { data: null, error: null };
        return { data: data[0], error: null };
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => execute())
          .then(resolve, reject);
      },
    };

    function execute() {
      const list = rows(table);
      if (pendingWrite?.type === 'upsert') {
        const items = Array.isArray(pendingWrite.payload)
          ? pendingWrite.payload
          : [pendingWrite.payload];
        const conflicts = (pendingWrite.options.onConflict ?? '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        for (const item of items) {
          const idx =
            conflicts.length > 0
              ? list.findIndex((r) => conflicts.every((c) => r[c] === item[c]))
              : -1;
          if (idx >= 0) list[idx] = { ...list[idx], ...item };
          else list.push({ ...item });
        }
        return { data: items, error: null };
      }
      if (pendingWrite?.type === 'insert') {
        const items = Array.isArray(pendingWrite.payload)
          ? pendingWrite.payload
          : [pendingWrite.payload];
        for (const item of items) {
          list.push({ id: item.id ?? `${table}-${list.length + 1}`, ...item });
        }
        return { data: items, error: null };
      }
      if (pendingWrite?.type === 'update') {
        for (let i = 0; i < list.length; i += 1) {
          if (matchEq(list[i], filters)) list[i] = { ...list[i], ...pendingWrite.patch };
        }
        return { data: null, error: null };
      }
      if (pendingWrite?.type === 'delete') {
        tables[table] = list.filter((r) => !matchEq(r, filters));
        return { data: null, error: null };
      }

      let result = list.filter((r) => matchEq(r, filters)).map((r) => ({ ...r }));
      if (orderCol) {
        result.sort((a, b) => {
          const av = a[orderCol];
          const bv = b[orderCol];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return orderAsc ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);
      return { data: result, error: null };
    }

    return builder;
  }

  return {
    from(table) {
      return createBuilder(table);
    },
    /** @internal */
    _tables: tables,
  };
}
