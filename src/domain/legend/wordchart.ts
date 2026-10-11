export interface Run {
  index: number;
  count: number;
}

/** Run-length encode one row of cells. */
export function runsForRow(cells: ArrayLike<number>, width: number, row: number): Run[] {
  const runs: Run[] = [];
  const start = row * width;
  for (let x = 0; x < width; x++) {
    const v = cells[start + x];
    const last = runs[runs.length - 1];
    if (last && last.index === v) last.count++;
    else runs.push({ index: v, count: 1 });
  }
  return runs;
}

/** Format a row as text, e.g. "4×A, 2×C, 9×A". Symbol lookup by legend index. */
export function formatRow(runs: Run[], symbolOf: (index: number) => string): string {
  return runs.map((r) => `${r.count}×${symbolOf(r.index)}`).join(', ');
}
