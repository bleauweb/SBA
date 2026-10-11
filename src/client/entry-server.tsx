import { renderToString } from 'react-dom/server';
import type { PageData } from '../shared/types';
import { App, titleFor } from './App';

export async function render(url: string, data: PageData): Promise<{ html: string; head: string }> {
  void url;
  const html = renderToString(<App data={data} />);
  const head = `<title>${escapeHtml(titleFor(data))}</title>`;
  return { html, head };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
