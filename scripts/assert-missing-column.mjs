import { missingColumnFromError, omitMissingColumn } from '../src/api/missingColumn.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const live = missingColumnFromError({
  code: '42703',
  message: 'column implants.factura does not exist',
});
assert(live === 'factura', `live factura column: ${live}`);

const quoted = missingColumnFromError({
  code: 'PGRST204',
  message: "Could not find the 'tooth_data_map' column of 'implants' in the schema cache",
});
assert(quoted === 'tooth_data_map', `quoted column: ${quoted}`);

const wrapped = missingColumnFromError({
  message: 'Supabase DB Error (42703): column implants.price does not exist',
});
assert(wrapped === 'price', `wrapped: ${wrapped}`);

assert(missingColumnFromError({ code: '23505', message: 'duplicate key' }) === null, 'unique is not a missing column');

const swapped = omitMissingColumn({ created_date: '2026-09-22T00:00:00.000Z', factura: { v: 1 } }, 'created_date');
assert(swapped.created_at === '2026-09-22T00:00:00.000Z', 'created_date falls back to created_at');
assert(!('created_date' in swapped), 'created_date removed');

const kept = omitMissingColumn({ created_date: 'a', created_at: 'b' }, 'factura');
assert(kept.created_date === 'a' && kept.created_at === 'b', 'unrelated omit keeps timestamps');

console.log('assert-missing-column: ok');
