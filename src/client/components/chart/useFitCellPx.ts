import { useEffect, useRef, useState } from 'react';

/**
 * Picks an initial chart cell size so the whole pattern fits the container's width
 * (down to a minimum of 4 px per bead), then lets the zoom slider take over.
 * Starts at `max` on the server and on first paint so hydration matches.
 */
export function useFitCellPx(widthBeads: number, max = 14) {
  const ref = useRef<HTMLDivElement>(null);
  const [cellPx, setCellPx] = useState(max);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w > 0) setCellPx(Math.max(4, Math.min(max, Math.floor((w - 44) / widthBeads))));
  }, [widthBeads, max]);
  return { ref, cellPx, setCellPx };
}
