// Comparator for Array#sort — locale-aware alphabetical order, used by every
// "merge a fixed list with distinct DB values" endpoint (categories, types,
// dosage forms, ...) so they all sort the same way instead of each route
// file redefining `(a, b) => a.localeCompare(b))` independently.
function localeCompare(a, b) {
  return a.localeCompare(b);
}

module.exports = { localeCompare };
