export function NotFoundPage() {
  return (
    <div className="card">
      <h2>Not found</h2>
      <p className="muted">That project or pattern doesn't exist, or it expired. Projects are removed after a long period without visits.</p>
      <a className="btn" href="/">Start a new project</a>
    </div>
  );
}
