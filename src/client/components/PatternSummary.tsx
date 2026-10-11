import type { Pattern } from '../../shared/types';

export function PatternStats({ pattern }: { pattern: Pattern }) {
  const t = pattern.totals;
  const inches = (mm: number) => (mm / 25.4).toFixed(1);
  return (
    <div className="stats">
      <div>
        <b>
          {pattern.width} × {pattern.height}
        </b>
        beads wide × rows
      </div>
      <div>
        <b>
          {inches(t.widthMm)}″ × {inches(t.heightMm)}″
        </b>
        {t.widthMm.toFixed(0)} × {t.heightMm.toFixed(0)} mm{pattern.settings.calibration ? ' (calibrated)' : ''}
      </div>
      <div>
        <b>{t.beads.toLocaleString()}</b>
        beads, {t.grams.toFixed(1)} g
      </div>
      <div>
        <b>{pattern.legend.length}</b>
        colours
      </div>
      <div>
        <b>{t.warpThreads}</b>
        warp threads, ~{Math.ceil(t.threadMeters)} m thread
      </div>
    </div>
  );
}
