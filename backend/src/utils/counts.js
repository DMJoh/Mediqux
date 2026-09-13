// Runs a `SELECT COUNT(*) as count ...` query and returns it as a number, so
// every "block delete if referenced elsewhere" check across the route files
// doesn't repeat the same `Number.parseInt(result.rows[0].count)`
// boilerplate. `executor` is anything with a `.query(sql, params)` method —
// the plain `db` module or a transaction `client` both qualify, so this
// works the same whether the caller is inside a transaction or not.
async function countRows(executor, sql, params = []) {
  const result = await executor.query(sql, params);
  return Number.parseInt(result.rows[0]?.count, 10) || 0;
}

module.exports = { countRows };
