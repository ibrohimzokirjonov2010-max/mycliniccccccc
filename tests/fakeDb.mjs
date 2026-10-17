// Xotiradagi soxta Supabase (faqat testlar uchun): select/insert/update/upsert, eq/in/lt/ilike/order/limit, unique indekslar.
export function fakeDb(seed, { failOn = {} } = {}) {
  const tables = JSON.parse(JSON.stringify(seed));
  let seq = 0;
  const uniqueViolation = (name, row, rows, self = row) => {
    if (name !== 'clinic_payment_charges') return false;
    return rows.some((r) => r !== self && (
      (r.clinic_id === row.clinic_id && r.attempt_date === row.attempt_date)
      || r.transaction_parameter === row.transaction_parameter
      || (r.clinic_id === row.clinic_id && r.period_start === row.period_start && r.status === 'success' && row.status === 'success')
      || (r.clinic_id === row.clinic_id && r.period_start === row.period_start && ['pending', 'unknown'].includes(r.status) && ['pending', 'unknown'].includes(row.status))
    ));
  };
  const from = (name) => {
    tables[name] ??= [];
    const rows = tables[name];
    const st = { filters: [], op: 'select', payload: null, orderBy: null, asc: false, lim: null, single: false, maybe: false };
    const exec = () => {
      const f = failOn[`${name}.${st.op}`];
      if (f && f(st.payload)) return { data: null, error: { code: 'XX000', message: 'injected' } };
      let matched = rows.filter((r) => st.filters.every((fn) => fn(r)));
      if (st.op === 'insert') {
        const row = { id: `id${++seq}`, created_at: new Date(Date.now() + seq).toISOString(), ...st.payload };
        if (uniqueViolation(name, row, rows) || (name === 'registration_token_uses' && rows.some((r) => r.jti === row.jti))) return { data: null, error: { code: '23505' } };
        rows.push(row);
        return { data: st.single ? row : [row], error: null };
      }
      if (st.op === 'upsert') {
        const i = rows.findIndex((r) => r.id === st.payload.id);
        if (i >= 0) rows[i] = { ...rows[i], ...st.payload }; else rows.push({ ...st.payload });
        return { data: null, error: null };
      }
      if (st.op === 'update') {
        for (const r of matched) {
          const next = { ...r, ...st.payload };
          if (uniqueViolation(name, next, rows, r)) return { data: null, error: { code: '23505' } };
        }
        matched.forEach((r) => Object.assign(r, st.payload));
        return { data: matched, error: null };
      }
      if (st.orderBy) matched = [...matched].sort((a, b) => (st.asc ? 1 : -1) * String(a[st.orderBy]).localeCompare(String(b[st.orderBy])));
      if (st.lim) matched = matched.slice(0, st.lim);
      if (st.single || st.maybe) return { data: matched[0] || null, error: null };
      return { data: matched, error: null };
    };
    const b = {
      select() { return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      upsert(p) { st.op = 'upsert'; st.payload = p; return b; },
      eq(k, v) { st.filters.push((r) => r[k] === v); return b; },
      in(k, vs) { st.filters.push((r) => vs.includes(r[k])); return b; },
      lt(k, v) { st.filters.push((r) => String(r[k]) < String(v)); return b; },
      ilike(k, pat) { const needle = pat.replace(/%/g, '').toLowerCase(); st.filters.push((r) => String(r[k] || '').toLowerCase().includes(needle)); return b; },
      order(k, o = {}) { st.orderBy = k; st.asc = !!o.ascending; return b; },
      limit(n) { st.lim = n; return b; },
      single() { st.single = true; return b; },
      maybeSingle() { st.maybe = true; return b; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  };
  const rl = new Map();
  const rpc = async (fn, args) => {
    if (fn !== 'rate_limit_hit') return { data: null, error: { message: 'no fn' } };
    const n = (rl.get(args.p_key) || 0) + 1; rl.set(args.p_key, n);
    return { data: n <= args.p_limit, error: null };
  };
  return { sb: { from, rpc }, tables };
}
