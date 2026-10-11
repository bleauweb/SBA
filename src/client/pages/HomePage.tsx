import { useState, type FormEvent } from 'react';
import type { PageData } from '../../shared/types';
import { api } from '../api';

type Data = Extract<PageData, { page: 'home' }>;

export function HomePage({ data }: { data: Data }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem('image') as HTMLInputElement).files?.[0];
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    if (!file) {
      setError('Choose a photo first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { project } = await api.createProject(file, title);
      window.location.href = `/projects/${project.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Turn a photo into a seed bead pattern</h2>
        <p className="muted">
          Upload a picture, pick how wide the piece should be in beads and how many colours you want, and download a printable guide with the chart, the bead counts and a row-by-row word chart. No account needed.
        </p>
        <p className="muted">
          Nothing is kept for long: projects and photos are deleted after about a day, and there are no backups. Download the PDF guide when you're happy with the pattern.
        </p>
        <form onSubmit={onSubmit}>
          <label className="field">
            <span>Photo (JPEG, PNG, WebP or HEIC, up to 20 MB)</span>
            <input type="file" name="image" accept="image/*" required />
          </label>
          <label className="field">
            <span>Title (optional)</span>
            <input type="text" name="title" placeholder="e.g. Grandma's cat" maxLength={120} />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? 'Uploading…' : 'Create project'}
          </button>
        </form>
      </div>

      <h3>Beads supported</h3>
      <ul className="muted">
        {data.specs.map((s) => (
          <li key={s.id}>
            {s.brand} {s.line} {s.size} — {s.whereToBuy}
          </li>
        ))}
      </ul>

      {data.recent.length > 0 && (
        <>
          <h3>Your recent projects</h3>
          <p className="muted">Remembered by this browser for about a day. Download the PDF to keep a pattern.</p>
          <div className="grid">
            {data.recent.map((p) => (
              <a key={p.id} className="thumb" href={`/projects/${p.id}`}>
                <img src={p.thumbnailUrl} alt="" />
                <div className="t">{p.title}</div>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
