import { useEffect, useState } from 'react';
import type { GenerationSettings, PageData, Pattern, Project } from '../../shared/types';
import { api } from '../api';
import { Chart } from '../components/chart/Chart';
import { Legend, MaterialsTable } from '../components/chart/Legend';
import { PatternStats } from '../components/PatternSummary';
import { SettingsForm } from '../components/editor/SettingsForm';
import { useFitCellPx } from '../components/chart/useFitCellPx';

type Data = Extract<PageData, { page: 'project' }>;

export function ProjectPage({ data }: { data: Data }) {
  const [project, setProject] = useState<Project>(data.project);
  const [pattern, setPattern] = useState<Pattern | null>(data.pattern);
  const [settings, setSettings] = useState<GenerationSettings>(data.project.settings);
  const [dirty, setDirty] = useState(data.pattern === null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [title, setTitle] = useState(project.title);
  const { ref: chartRef, cellPx, setCellPx } = useFitCellPx(pattern?.width ?? 60);

  useEffect(() => {
    setShareUrl(window.location.origin + `/projects/${project.id}`);
  }, [project.id]);

  function onChange(patch: Partial<GenerationSettings>) {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  }

  async function generate() {
    setBusy('Generating…');
    setError(null);
    try {
      const { project: p } = await api.updateSettings(project.id, settings);
      setProject(p);
      const { pattern: pat } = await api.generate(project.id);
      setPattern(pat);
      setHighlight(null);
      setDirty(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveTitle() {
    if (title.trim() === project.title) return;
    try {
      const { project: p } = await api.rename(project.id, title);
      setProject(p);
      setTitle(p.title);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this project, its photo and all its patterns? This cannot be undone.')) return;
    setBusy('Deleting…');
    try {
      await api.deleteProject(project.id);
      window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  const canEdit = data.canEdit;
  const generateLabel = busy ?? (pattern ? (dirty ? 'Regenerate pattern' : 'Pattern is up to date') : 'Generate pattern');

  return (
    <>
      <div className="page-head">
        {canEdit ? (
          <input
            type="text"
            className="title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            maxLength={120}
            aria-label="Project title"
          />
        ) : (
          <h2>{project.title}</h2>
        )}
        <div className="row head-actions">
          {pattern && (
            <a className="btn primary" href={`/api/patterns/${pattern.id}/guide.pdf`} target="_blank" rel="noreferrer">
              Download PDF guide
            </a>
          )}
          {pattern && <a className="btn" href={`/patterns/${pattern.id}`}>Pattern page</a>}
        </div>
      </div>

      {!canEdit && (
        <p className="card muted" style={{ marginBottom: 12 }}>
          You're viewing someone else's project. You can look at the pattern and download the guide, but not change the settings. Upload your own photo on the <a href="/">home page</a>.
        </p>
      )}

      <div className="editor">
        <aside className="card editor-side">
          <h3 style={{ marginTop: 0 }}>Photo</h3>
          <img src={project.workingImageUrl} alt="" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--line)' }} />
          <p className="muted" style={{ fontSize: 13 }}>
            {project.workingWidth} × {project.workingHeight} px
          </p>

          <h3>Settings</h3>
          <SettingsForm settings={settings} specs={data.specs} finishes={data.finishes} disabled={!canEdit || busy !== null} onChange={onChange} />

          {canEdit && (
            <>
              <button className="btn primary side-generate" type="button" onClick={generate} disabled={busy !== null} style={{ width: '100%', marginTop: 8 }}>
                {generateLabel}
              </button>
              {error && <div className="error">{error}</div>}
              <p className="share muted" style={{ marginTop: 14 }}>
                Share or bookmark: <br />
                <a href={shareUrl}>{shareUrl || `/projects/${project.id}`}</a>
                <br />
                The link works anywhere for about a day, then the project and photo are deleted. Download the PDF to keep the pattern.
              </p>
              <button className="btn danger" type="button" onClick={remove} disabled={busy !== null} style={{ marginTop: 8 }}>
                Delete project
              </button>
            </>
          )}
        </aside>

        <section className="editor-main">
          {error && canEdit && <div className="error">{error}</div>}
          {pattern ? (
            <>
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
              {dirty && canEdit && <p className="muted">Settings changed since this pattern was generated. Click Regenerate to update it.</p>}
              <h3>Materials</h3>
              <MaterialsTable pattern={pattern} />
            </>
          ) : (
            <div className="card" ref={chartRef}>
              <h3 style={{ marginTop: 0 }}>No pattern yet</h3>
              <p className="muted">Adjust the settings and click Generate pattern. It takes about a second.</p>
            </div>
          )}
        </section>
      </div>

      {canEdit && <div className="action-bar-spacer" />}
      {canEdit && (
        <div className="action-bar">
          <button className="btn primary" type="button" onClick={generate} disabled={busy !== null}>
            {generateLabel}
          </button>
          {pattern && (
            <a className="btn" href={`/api/patterns/${pattern.id}/guide.pdf`} target="_blank" rel="noreferrer">
              PDF guide
            </a>
          )}
        </div>
      )}
    </>
  );
}
