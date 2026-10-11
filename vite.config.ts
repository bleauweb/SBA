import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  appType: 'custom',
  build: {
    manifest: !isSsrBuild,
    emptyOutDir: true,
    rollupOptions: isSsrBuild
      ? { output: { format: 'es', entryFileNames: 'entry-server.mjs' } }
      : { input: 'index.html' },
  },
  ssr: {
    // Bundle everything into the prod SSR entry so it is self-contained. In dev the Vite
    // module runner must leave CJS packages (react-dom) external, so only set it for builds.
    noExternal: isSsrBuild ? true : undefined,
  },
  server: {
    middlewareMode: true,
    hmr: { port: 24678 },
  },
}));
