// Escapes regex special characters so user-supplied search text can't break
// or blow up a $regex query.
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
