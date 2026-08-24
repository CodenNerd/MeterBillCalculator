const STORAGE_KEY = 'mc_local_db'
const listeners = new Set()

const DEMO_EMAIL = 'demo@local.test'
const DEMO_PASSWORD = 'demo123'

function emptyDb() {
  return {
    users: [],
    session: null,
    complexes: [],
    businesses: [],
    billing_cycles: [],
    cycle_business_bills: [],
    nextIds: { businesses: 1, billing_cycles: 1, cycle_business_bills: 1 },
  }
}

function load() {
  if (typeof window === 'undefined') return emptyDb()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyDb(), ...JSON.parse(raw) } : emptyDb()
  } catch {
    return emptyDb()
  }
}

function save(db) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function notify(event, session) {
  listeners.forEach(cb => cb(event, session))
}

function toSession(user) {
  return {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata || { role: 'admin' },
    },
  }
}

function matches(row, filters) {
  return filters.every(f => row[f.col] == f.val)
}

function applyDefaults(table, row, db) {
  const now = new Date().toISOString()
  if (table === 'complexes') {
    return {
      ...row,
      id: row.id || crypto.randomUUID(),
      created_at: row.created_at || now,
    }
  }
  if (table === 'businesses') {
    return {
      ...row,
      id: row.id ?? db.nextIds.businesses++,
      email: row.email ?? null,
      previous_reading: row.previous_reading ?? 0,
      created_at: row.created_at || now,
      updated_at: row.updated_at || now,
    }
  }
  if (table === 'billing_cycles') {
    return {
      ...row,
      id: row.id ?? db.nextIds.billing_cycles++,
      cycle_date: row.cycle_date || now,
      name: row.name ?? null,
      status: row.status || 'published',
      allocation_method: row.allocation_method || 'equal',
      created_at: row.created_at || now,
    }
  }
  if (table === 'cycle_business_bills') {
    return {
      ...row,
      id: row.id ?? db.nextIds.cycle_business_bills++,
      evidence_note: row.evidence_note ?? null,
      evidence_file_id: row.evidence_file_id ?? null,
      misc_note: row.misc_note ?? null,
      created_at: row.created_at || now,
    }
  }
  return { ...row }
}

function execute(state, mode) {
  return Promise.resolve().then(() => {
    const db = load()
    const rows = db[state.table]
    if (!Array.isArray(rows)) {
      return { data: null, error: { message: `Unknown table ${state.table}` } }
    }

    if (state.op === 'select') {
      let result = rows.filter(r => matches(r, state.filters))
      if (state.orderBy) {
        const { col, ascending } = state.orderBy
        result = [...result].sort((a, b) => {
          if (a[col] < b[col]) return ascending ? -1 : 1
          if (a[col] > b[col]) return ascending ? 1 : -1
          return 0
        })
      }
      if (mode === 'maybeSingle') return { data: result[0] ?? null, error: null }
      if (mode === 'single') {
        return result[0]
          ? { data: result[0], error: null }
          : { data: null, error: { message: 'No rows' } }
      }
      return { data: result, error: null }
    }

    if (state.op === 'insert') {
      const incoming = Array.isArray(state.payload) ? state.payload : [state.payload]
      const created = incoming.map(row => applyDefaults(state.table, row, db))
      db[state.table].push(...created)
      save(db)
      if (mode === 'single' || !Array.isArray(state.payload)) {
        return { data: created[0], error: null }
      }
      return { data: created, error: null }
    }

    if (state.op === 'update') {
      db[state.table] = rows.map(r =>
        matches(r, state.filters) ? { ...r, ...state.payload } : r
      )
      save(db)
      return { data: null, error: null }
    }

    if (state.op === 'delete') {
      db[state.table] = rows.filter(r => !matches(r, state.filters))
      save(db)
      return { data: null, error: null }
    }

    if (state.op === 'upsert') {
      const incoming = Array.isArray(state.payload) ? state.payload : [state.payload]
      const key = state.upsertOpts?.onConflict || 'id'
      for (const row of incoming) {
        const idx = db[state.table].findIndex(r => r[key] == row[key])
        if (idx >= 0) db[state.table][idx] = { ...db[state.table][idx], ...row }
        else db[state.table].push(applyDefaults(state.table, row, db))
      }
      save(db)
      return { data: null, error: null }
    }

    return { data: null, error: { message: 'Unsupported operation' } }
  })
}

function from(table) {
  const state = {
    table,
    filters: [],
    orderBy: null,
    payload: null,
    op: 'select',
    upsertOpts: null,
  }

  const api = {
    select() {
      return api
    },
    eq(col, val) {
      state.filters.push({ col, val })
      return api
    },
    insert(rows) {
      state.op = 'insert'
      state.payload = rows
      return api
    },
    update(patch) {
      state.op = 'update'
      state.payload = patch
      return api
    },
    delete() {
      state.op = 'delete'
      return api
    },
    upsert(rows, opts) {
      state.op = 'upsert'
      state.payload = rows
      state.upsertOpts = opts
      return api
    },
    order(col, { ascending } = { ascending: true }) {
      state.orderBy = { col, ascending }
      return api
    },
    maybeSingle() {
      return execute(state, 'maybeSingle')
    },
    single() {
      return execute(state, 'single')
    },
    then(resolve, reject) {
      return execute(state, 'many').then(resolve, reject)
    },
  }

  return api
}

let client

export function createLocalClient() {
  if (client) return client

  client = {
    auth: {
      async getSession() {
        return { data: { session: load().session }, error: null }
      },
      async signUp({ email, password, options }) {
        const db = load()
        if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          return { data: { user: null, session: null }, error: { message: 'User already registered' } }
        }
        const user = {
          id: crypto.randomUUID(),
          email,
          password,
          user_metadata: options?.data || { role: 'admin' },
        }
        db.users.push(user)
        const session = toSession(user)
        db.session = session
        save(db)
        notify('SIGNED_IN', session)
        return { data: { user: session.user, session }, error: null }
      },
      async signInWithPassword({ email, password }) {
        const db = load()
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())
        if (!user || user.password !== password) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
        }
        const session = toSession(user)
        db.session = session
        save(db)
        notify('SIGNED_IN', session)
        return { data: { user: session.user, session }, error: null }
      },
      async signOut() {
        const db = load()
        db.session = null
        save(db)
        notify('SIGNED_OUT', null)
        return { error: null }
      },
      onAuthStateChange(cb) {
        listeners.add(cb)
        const session = load().session
        queueMicrotask(() => cb('INITIAL_SESSION', session))
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
      },
    },
    from,
  }

  return client
}

export async function startLocalDemo() {
  createLocalClient()
  const db = load()
  let user = db.users.find(u => u.email === DEMO_EMAIL)
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      user_metadata: { role: 'admin', complex_name: 'Demo Plaza' },
    }
    db.users.push(user)
  }

  let complex = db.complexes.find(c => c.owner_id === user.id)
  if (!complex) {
    const now = new Date().toISOString()
    complex = {
      id: crypto.randomUUID(),
      owner_id: user.id,
      name: 'Demo Plaza',
      created_at: now,
    }
    db.complexes.push(complex)
    const samples = [
      { name: 'Alpha Stores', previous_reading: 1240 },
      { name: 'Beta Pharmacy', previous_reading: 860 },
      { name: 'Gamma Salon', previous_reading: 415 },
    ]
    for (const sample of samples) {
      db.businesses.push({
        id: db.nextIds.businesses++,
        name: sample.name,
        email: null,
        previous_reading: sample.previous_reading,
        complex_id: complex.id,
        created_at: now,
        updated_at: now,
      })
    }
  }

  const session = toSession(user)
  db.session = session
  save(db)
  notify('SIGNED_IN', session)
  return { user: session.user, session }
}
