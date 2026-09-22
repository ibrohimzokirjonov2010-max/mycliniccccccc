/** Parse PostgREST / Postgres "column does not exist" errors. */

const COLUMN_PATTERNS = [
  /the '([A-Za-z_][A-Za-z0-9_]*)' column/,
  /column "([A-Za-z_][A-Za-z0-9_]*)"/,
  /column '([A-Za-z_][A-Za-z0-9_]*)'/,
  /field "([A-Za-z_][A-Za-z0-9_]*)"/,
  /column (?:[\w"]+\.)+([A-Za-z_][A-Za-z0-9_]*) does not exist/i,
];

export function missingColumnFromError(error) {
  const message = String(error?.message || error || '');
  if (!message) return null;
  const code = String(error?.code || '');
  const looksMissing = code === '42703'
    || code === 'PGRST204'
    || code === 'PGRST200'
    || /column|does not exist|schema cache/i.test(message);
  if (!looksMissing) return null;
  for (const pattern of COLUMN_PATTERNS) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Drop a missing column. Swap created_date ↔ created_at so either schema still stamps the row. */
export function omitMissingColumn(record, column) {
  const next = { ...(record || {}) };
  if (column === 'created_date' && next.created_at == null && next.created_date != null) {
    next.created_at = next.created_date;
  }
  if (column === 'created_at' && next.created_date == null && next.created_at != null) {
    next.created_date = next.created_at;
  }
  delete next[column];
  return next;
}
