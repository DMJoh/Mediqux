const MAX_ABS_VALUE = 10_000_000;

// A lab value row is safe to insert only if it has a parameter name and a
// finite, in-range numeric value — Postgres would otherwise reject the whole
// batch insert on the first bad row. Rows failing this are skipped rather
// than erroring, since a manually-typed lab report commonly has a stray
// non-numeric entry that shouldn't block saving the rest.
function isValidLabValue(labValue) {
  if (!labValue || !labValue.parameter_name) return false;
  if (labValue.value === null || labValue.value === undefined || labValue.value === '') return false;
  const numVal = Number.parseFloat(labValue.value);
  return !Number.isNaN(numVal) && Math.abs(numVal) < MAX_ABS_VALUE;
}

module.exports = { isValidLabValue };
