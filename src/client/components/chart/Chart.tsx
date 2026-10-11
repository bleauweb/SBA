import { memo } from 'react';
import type { Pattern } from '../../../shared/types';

interface Props {
  pattern: Pattern;
  cellPx?: number;
  highlight: number | null;
  showSymbols?: boolean;
}

/**
 * The pattern as an SVG grid. Click a legend entry to highlight one colour: every other
 * cell is greyed out, which is how beaders check where a colour goes.
 */
export const Chart = memo(function Chart({ pattern, cellPx = 14, highlight, showSymbols = true }: Props) {
  const { width, height, cells, legend } = pattern;
  const g = 18; // gutter for numbers
  const W = width * cellPx + g * 2;
  const H = height * cellPx + g * 2;
  const rects = [];
  const texts = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = cells[r * width + c];
      const e = legend[idx];
      const x = g + c * cellPx;
      const y = g + r * cellPx;
      const dim = highlight !== null && highlight !== idx;
      rects.push(<rect key={`${r}-${c}`} x={x} y={y} width={cellPx} height={cellPx} fill={e?.bead.hex ?? '#f0f'} opacity={dim ? 0.18 : 1} />);
      if (showSymbols && cellPx >= 11 && e) {
        texts.push(
          <text key={`t${r}-${c}`} x={x + cellPx / 2} y={y + cellPx * 0.72} fontSize={cellPx * 0.55} fill={e.textColor} textAnchor="middle" opacity={dim ? 0.3 : 1}>
            {e.symbol}
          </text>,
        );
      }
    }
  }
  const lines = [];
  for (let c = 0; c <= width; c++) {
    const x = g + c * cellPx;
    lines.push(<line key={`v${c}`} x1={x} y1={g} x2={x} y2={g + height * cellPx} stroke={c % 10 === 0 ? '#000' : '#0003'} strokeWidth={c % 10 === 0 ? 1.5 : 0.5} />);
  }
  for (let r = 0; r <= height; r++) {
    const y = g + r * cellPx;
    lines.push(<line key={`h${r}`} x1={g} y1={y} x2={g + width * cellPx} y2={y} stroke={r % 10 === 0 ? '#000' : '#0003'} strokeWidth={r % 10 === 0 ? 1.5 : 0.5} />);
  }
  const nums = [];
  for (let c = 0; c < width; c++) {
    const n = c + 1;
    if (n % 5 !== 0 && n !== 1) continue;
    nums.push(<text key={`cn${c}`} x={g + c * cellPx + cellPx / 2} y={g - 5} fontSize={10} textAnchor="middle" fill="#444">{n}</text>);
  }
  for (let r = 0; r < height; r++) {
    const n = r + 1;
    if (n % 5 !== 0 && n !== 1) continue;
    nums.push(<text key={`rn${r}`} x={g - 4} y={g + r * cellPx + cellPx / 2 + 3.5} fontSize={10} textAnchor="end" fill="#444">{n}</text>);
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fontFamily="system-ui, sans-serif" fontWeight={700} role="img" aria-label="Bead chart">
      <g>{rects}</g>
      <g>{lines}</g>
      <g>{texts}</g>
      <g fontWeight={400}>{nums}</g>
    </svg>
  );
});
