// TV board layout math (pure — shared by the browser and the automated tests).
//
// Column 1 always pins the top `rows` players. The remaining `columns - 1` columns show everyone
// else a page at a time: page 0 = positions rows+1 … rows + rows*(columns-1), and so on.

/** Rows shown per page across the paging columns. */
export function pageSize(rows, columns) {
  return rows * Math.max(0, columns - 1);
}

/** Number of pages of lower ranks (0 when everyone fits in the pinned column, or with a single column). */
export function pageCount(total, rows, columns) {
  const size = pageSize(rows, columns);
  if (size === 0 || total <= rows) return 0;
  return Math.ceil((total - rows) / size);
}

/** Page (0-based) containing a 1-based position, or -1 when it's in the pinned top column (or not shown). */
export function pageForPosition(position, rows, columns) {
  const size = pageSize(rows, columns);
  if (position <= rows || size === 0) return -1;
  return Math.floor((position - rows - 1) / size);
}

/** 1-based inclusive position range for a page. */
export function pageRange(page, rows, columns, total) {
  const size = pageSize(rows, columns);
  const first = rows + 1 + page * size;
  return { first, last: Math.min(total, first + size - 1) };
}

/** Split a page's entries into its columns, `rows` per column. */
export function splitColumns(entries, rows, columns) {
  const result = [];
  for (let c = 0; c < columns; c++) result.push(entries.slice(c * rows, (c + 1) * rows));
  return result;
}
