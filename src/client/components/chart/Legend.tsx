import type { Pattern } from '../../../shared/types';

export function Legend({ pattern, highlight, onToggle }: { pattern: Pattern; highlight: number | null; onToggle: (i: number | null) => void }) {
  return (
    <div className="legend">
      {pattern.legend.map((l) => (
        <button key={l.index} type="button" className={highlight === l.index ? 'active' : ''} onClick={() => onToggle(highlight === l.index ? null : l.index)} title={`${l.bead.name} (${l.bead.finish})`}>
          <span className="sw" style={{ background: l.bead.hex, color: l.textColor }}>{l.symbol}</span>
          <span>
            {l.bead.code} · {l.count}
          </span>
        </button>
      ))}
    </div>
  );
}

export function MaterialsTable({ pattern }: { pattern: Pattern }) {
  return (
    <div className="table-wrap">
    <table className="mat">
      <thead>
        <tr>
          <th>Sym</th>
          <th>Code</th>
          <th>Colour</th>
          <th className="col-finish">Finish</th>
          <th className="num">Beads</th>
          <th className="num">Grams</th>
          <th className="num">Tubes</th>
        </tr>
      </thead>
      <tbody>
        {pattern.legend.map((l) => (
          <tr key={l.index}>
            <td>
              <span className="sw" style={{ background: l.bead.hex, color: l.textColor, display: 'inline-flex', width: 20, height: 20, borderRadius: 4, alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{l.symbol}</span>
            </td>
            <td>{l.bead.code}</td>
            <td>{l.bead.name}</td>
            <td className="col-finish">{l.bead.finish}</td>
            <td className="num">{l.count}</td>
            <td className="num">{l.grams.toFixed(1)}</td>
            <td className="num">{l.tubes}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
