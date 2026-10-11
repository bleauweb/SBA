/** Splits a pattern into printable tiles with an overlap so rows/columns can be followed across pages. */
export interface Tile {
  col0: number;
  col1: number; // exclusive
  row0: number;
  row1: number; // exclusive
  pageIndex: number;
  tileCol: number;
  tileRow: number;
}

export interface PagerInput {
  width: number;
  height: number;
  colsPerPage: number;
  rowsPerPage: number;
  overlap?: number;
}

export function pageTiles({ width, height, colsPerPage, rowsPerPage, overlap = 2 }: PagerInput): Tile[] {
  const tiles: Tile[] = [];
  const stepC = Math.max(1, colsPerPage - overlap);
  const stepR = Math.max(1, rowsPerPage - overlap);
  const colStarts: number[] = [];
  for (let c = 0; c < width; c += stepC) {
    colStarts.push(c);
    if (c + colsPerPage >= width) break;
  }
  const rowStarts: number[] = [];
  for (let r = 0; r < height; r += stepR) {
    rowStarts.push(r);
    if (r + rowsPerPage >= height) break;
  }
  let pageIndex = 0;
  rowStarts.forEach((r, tr) => {
    colStarts.forEach((c, tc) => {
      tiles.push({
        col0: c,
        col1: Math.min(width, c + colsPerPage),
        row0: r,
        row1: Math.min(height, r + rowsPerPage),
        pageIndex: pageIndex++,
        tileCol: tc,
        tileRow: tr,
      });
    });
  });
  return tiles;
}
