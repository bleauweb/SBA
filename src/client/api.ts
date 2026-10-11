import type { BeadColor, GenerationSettings, Pattern, Project } from '../shared/types';

async function call<T>(method: string, url: string, body?: unknown, isForm = false): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const msg = (json as { message?: string | string[] } | null)?.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg || `${res.status} ${res.statusText}`);
  }
  return json as T;
}

export const api = {
  createProject: (image: File, title: string) => {
    const fd = new FormData();
    fd.append('image', image);
    if (title) fd.append('title', title);
    return call<{ project: Project }>('POST', '/api/projects', fd, true);
  },
  updateSettings: (id: string, patch: Partial<GenerationSettings>) => call<{ project: Project }>('PATCH', `/api/projects/${id}/settings`, patch),
  rename: (id: string, title: string) => call<{ project: Project }>('PATCH', `/api/projects/${id}`, { title }),
  deleteProject: (id: string) => call<{ ok: true }>('DELETE', `/api/projects/${id}`),
  generate: (id: string) => call<{ pattern: Pattern }>('POST', `/api/projects/${id}/patterns`),
  colors: (specId: string) => call<{ colors: Omit<BeadColor, 'lab'>[] }>('GET', `/api/palettes/${specId}/colors`),
};
