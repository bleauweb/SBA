import { useState } from 'react';
import type { PageData } from '../../shared/types';
import { Chart } from '../components/chart/Chart';
import { Legend, MaterialsTable } from '../components/chart/Legend';
import { PatternStats } from '../components/PatternSummary';

type Data = Extract<PageData, { page: 'pattern' }>;

export function PatternPage({ data }: { data: Data }) {
  const [highlight, setHighlight] = useState<number | null>(null);
  const { pattern, project } = data;
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>
          {project.title} <span className="muted">· pattern v{pattern.version}</span>
        </h2>
        <div className="row">
          <a className="btn" href={`/projects/${project.id}`}>Open project</a>
          <a className="btn primary" href={`/api/patterns/${pattern.id}/guide.pdf`}>Download PDF guide</a>
        </div>
      </div>
      <PatternStats pattern={pattern} />
      <Legend pattern={pattern} highlight={highlight} onToggle={setHighlight} />
      <div className="chart-wrap" style={{ marginTop: 12 }}>
        <Chart pattern={pattern} highlight={highlight} />
      </div>
      <h3>Materials</h3>
      <MaterialsTable pattern={pattern} />
    </>
  );
}
