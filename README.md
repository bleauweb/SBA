# SBA — Seed Bead Art

Turns a photograph into a printable guide for seed bead pixel art: the bead chart, bead counts per colour, and a row-by-row word chart. No accounts; the project link is the share link.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## Run it

Requires Node 22.12 or newer.

```sh
npm install
cp .env.example .env     # optional; defaults work for local use
npm run dev              # http://localhost:3000 with hot reload
```

Production:

```sh
npm run build            # client assets, SSR bundle and server
COOKIE_SECRET=<long random string> npm start
```

Data lives in `var/` by default (SQLite database and uploaded images). Set `DATABASE_URL`, `STORAGE_DIR`, `COOKIE_SECRET` and `RETENTION_DAYS` in `.env` to change that.

## Develop

```sh
npm run typecheck        # server and client TypeScript
npm test                 # vitest unit tests (colour maths, quantisation, generator, PDF pager)
npm run db:generate      # regenerate drizzle migrations after editing src/db/schema.ts
```

Layout:

| path | what |
|---|---|
| `src/domain/` | the photo → pattern pipeline, framework-free |
| `src/modules/` | NestJS modules: projects, images, palettes, patterns, guides, render (SSR), housekeeping |
| `src/client/` | React pages and components, server-rendered via Vite |
| `src/pdf/` | the PDF guide, built with `@react-pdf/renderer` |
| `src/shared/` | types and settings schema shared by all of the above |
| `data/beads/` | bead catalogues and bead specs (see its README) |

## Beads

The first catalogue is Toho 11/0 round seed beads, which Michaels sells in named-colour tubes. Colour values are approximate until sampled from real swatches; corrections are welcome in `data/beads/toho-11-round.json`.
