import { useState } from 'react';
import type { PageData } from '../../shared/types';
import { Chart } from '../components/chart/Chart';
import { Legend, MaterialsTable } from '../components/chart/Legend';
import { PatternStats } from '../components/PatternSummary';
import { useFitCellPx } from '../components/chart/useFitCellPx';

type Data = Extract<PageData, { page: 'pattern' }>;

export function PatternPage({ data }: { data: Data }) {
  const [highlight, setHighlight] = useState<number | null>(null);
  const { pattern, project } = data;
  const { ref: chartRef, cellPx, setCellPx } = useFitCellPx(pattern.width);
  return (
    <>
      <div className="page-head">
        <h2>
          {project.title} <span className="muted">· pattern v{pattern.version}</span>
        </h2>
        <div className="row head-actions">
          <a className="btn" href={`/projects/${project.id}`}>Open project</a>
          <a className="btn primary" href={`/api/patterns/${pattern.id}/guide.pdf`}>Download PDF guide</a>
        </div>
      </div>
      <PatternStats pattern={pattern} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <Legend pattern={pattern} highlight={highlight} onToggle={setHighlight} />
        <label className="field zoom" style={{ margin: 0 }}>
          <span>Zoom</span>
          <input type="range" min={4} max={30} value={cellPx} onChange={(e) => setCellPx(Number(e.target.value))} />
        </label>
      </div>
      <div className="chart-wrap" style={{ marginTop: 12 }} ref={chartRef}>
        <Chart pattern={pattern} cellPx={cellPx} highlight={highlight} />
      </div>
      <h3>Materials</h3>
      <MaterialsTable pattern={pattern} />
    </>
  );
}
