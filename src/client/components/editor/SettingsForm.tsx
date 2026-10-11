import { useEffect, useState } from 'react';
import type { BeadSpec, GenerationSettings } from '../../../shared/types';
import { api } from '../../api';

interface Props {
  settings: GenerationSettings;
  specs: BeadSpec[];
  finishes: string[];
  disabled: boolean;
  onChange: (patch: Partial<GenerationSettings>) => void;
}

const FINISH_HELP: Record<string, string> = {
  opaque: 'solid colour, most reliable',
  matte: 'frosted, no shine',
  ceylon: 'pearly pastels',
  luster: 'glossy coating on opaque',
  transparent: 'see-through; looks different on thread',
  'silver-lined': 'sparkly; hard to match from a photo',
  ab: 'rainbow coating; colour shifts',
  metallic: 'metal-look coating',
};

export function SettingsForm({ settings, specs, finishes, disabled, onChange }: Props) {
  const [michaelsOnly, setMichaelsOnly] = useState(Boolean(settings.selectedBeadIds?.length));
  const [cal, setCal] = useState(Boolean(settings.calibration));

  useEffect(() => {
    if (!michaelsOnly) return;
    let cancelled = false;
    api.colors(settings.beadSpecId).then(({ colors }) => {
      if (cancelled) return;
      const ids = colors.filter((c) => c.michaelsCommon && settings.finishes.includes(c.finish)).map((c) => c.id);
      onChange({ selectedBeadIds: ids.length ? ids : undefined });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [michaelsOnly, settings.beadSpecId, settings.finishes.join(',')]);

  function toggleFinish(f: string) {
    const next = settings.finishes.includes(f) ? settings.finishes.filter((x) => x !== f) : [...settings.finishes, f];
    if (next.length === 0) return;
    onChange({ finishes: next });
  }

  const spec = specs.find((s) => s.id === settings.beadSpecId);

  return (
    <div>
      <label className="field">
        <span>Beads</span>
        <select value={settings.beadSpecId} disabled={disabled} onChange={(e) => onChange({ beadSpecId: e.target.value })}>
          {specs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.brand} {s.line} {s.size}
            </option>
          ))}
        </select>
        {spec && <small className="muted">{spec.whereToBuy}</small>}
      </label>

      <label className="field">
        <span>Width: {settings.widthBeads} beads{spec && ` (~${((settings.widthBeads * (settings.calibration ? settings.calibration.tenBeadsWidthMm / 10 : spec.cellWidthMm)) / 25.4).toFixed(1)} in)`}</span>
        <input type="range" min={10} max={200} value={settings.widthBeads} disabled={disabled} onChange={(e) => onChange({ widthBeads: Number(e.target.value) })} />
      </label>

      <label className="field">
        <span>Max colours: {settings.maxColors}</span>
        <input type="range" min={2} max={40} value={settings.maxColors} disabled={disabled} onChange={(e) => onChange({ maxColors: Number(e.target.value) })} />
      </label>

      <div className="field">
        <span>Bead finishes to use</span>
        <div className="checks">
          {finishes.map((f) => (
            <label key={f} title={FINISH_HELP[f] ?? ''}>
              <input type="checkbox" checked={settings.finishes.includes(f)} disabled={disabled || michaelsOnly} onChange={() => toggleFinish(f)} /> {f}
            </label>
          ))}
        </div>
      </div>

      <div className="checks">
        <label>
          <input
            type="checkbox"
            checked={michaelsOnly}
            disabled={disabled}
            onChange={(e) => {
              setMichaelsOnly(e.target.checked);
              if (!e.target.checked) onChange({ selectedBeadIds: undefined });
            }}
          />{' '}
          Only colours commonly stocked at Michaels
        </label>
      </div>
      <div className="checks">
        <label title="Removes single stray beads so the chart is easier to follow">
          <input type="checkbox" checked={settings.despeckle} disabled={disabled} onChange={(e) => onChange({ despeckle: e.target.checked })} /> Remove stray beads
        </label>
        <label title="Blends colours by alternating beads. Closer to a photo, harder to bead">
          <input type="checkbox" checked={settings.dither} disabled={disabled} onChange={(e) => onChange({ dither: e.target.checked })} /> Dither
        </label>
      </div>

      <h3>Image adjustments</h3>
      {(['brightness', 'contrast', 'saturation'] as const).map((k) => (
        <label className="field" key={k}>
          <span>
            {k}: {settings.adjust[k] > 0 ? '+' : ''}
            {Math.round(settings.adjust[k] * 100)}%
          </span>
          <input
            type="range"
            min={-0.8}
            max={0.8}
            step={0.05}
            value={settings.adjust[k]}
            disabled={disabled}
            onChange={(e) => onChange({ adjust: { ...settings.adjust, [k]: Number(e.target.value) } })}
          />
        </label>
      ))}

      <h3>Calibration</h3>
      <div className="checks">
        <label title="Weave a 10×10 test square and measure it">
          <input
            type="checkbox"
            checked={cal}
            disabled={disabled}
            onChange={(e) => {
              setCal(e.target.checked);
              onChange({ calibration: e.target.checked ? { tenBeadsWidthMm: spec ? spec.cellWidthMm * 10 : 15, tenRowsHeightMm: spec ? spec.cellHeightMm * 10 : 20 } : undefined });
            }}
          />{' '}
          I measured a 10×10 swatch
        </label>
      </div>
      {cal && settings.calibration && (
        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            <span>10 beads wide (mm)</span>
            <input type="number" min={5} max={60} step={0.1} value={settings.calibration.tenBeadsWidthMm} disabled={disabled} onChange={(e) => onChange({ calibration: { ...settings.calibration!, tenBeadsWidthMm: Number(e.target.value) } })} />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>10 rows tall (mm)</span>
            <input type="number" min={5} max={60} step={0.1} value={settings.calibration.tenRowsHeightMm} disabled={disabled} onChange={(e) => onChange({ calibration: { ...settings.calibration!, tenRowsHeightMm: Number(e.target.value) } })} />
          </label>
        </div>
      )}

      <label className="field">
        <span>PDF page size</span>
        <select value={settings.pageSize} disabled={disabled} onChange={(e) => onChange({ pageSize: e.target.value as GenerationSettings['pageSize'] })}>
          <option value="LETTER">US Letter</option>
          <option value="A4">A4</option>
        </select>
      </label>
    </div>
  );
}
