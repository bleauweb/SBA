import type { PageData } from '../shared/types';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PatternPage } from './pages/PatternPage';
import { ProjectPage } from './pages/ProjectPage';

export function titleFor(data: PageData): string {
  switch (data.page) {
    case 'home':
      return 'SBA · Seed Bead Art';
    case 'project':
      return `${data.project.title} · SBA`;
    case 'pattern':
      return `${data.project.title} pattern v${data.pattern.version} · SBA`;
    default:
      return 'Not found · SBA';
  }
}

export function App({ data }: { data: PageData }) {
  return (
    <>
      <header className="top">
        <h1>
          <a href="/">SBA</a>
        </h1>
        <span className="tag">photo → seed bead loom pattern</span>
      </header>
      <main>
        {data.page === 'home' && <HomePage data={data} />}
        {data.page === 'project' && <ProjectPage data={data} />}
        {data.page === 'pattern' && <PatternPage data={data} />}
        {data.page === 'not-found' && <NotFoundPage />}
      </main>
    </>
  );
}
