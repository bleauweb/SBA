# SBA — Seed Bead Art

Turns a photograph into a printable guide for seed bead pixel art: the bead chart, bead counts per colour, and a row-by-row word chart. No accounts, and nothing is kept: projects and photos are deleted after about a day and are never backed up. The PDF is the keepsake.

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

Data lives in `var/` by default (SQLite database and uploaded images). Set `DATABASE_URL`, `STORAGE_DIR`, `COOKIE_SECRET` and `RETENTION_HOURS` in `.env` to change that.

Docker:

```sh
docker build -t sba .
docker run --rm -p 3000:3000 -e COOKIE_SECRET=<long random string> sba
```

## Deploy to DigitalOcean App Platform

The app is designed to run on App Platform's ephemeral disk: the SQLite file, uploaded photos and generated PDFs live inside the container and vanish when a deploy replaces it. An hourly job also deletes projects not opened for `RETENTION_HOURS` (default 24). There is nothing to back up.

One-time setup:

1. Install [doctl](https://docs.digitalocean.com/reference/doctl/) and run `doctl auth init`.
2. Authorise App Platform to read this GitHub repository (App Platform > Create App > GitHub, or Settings > Connectors). The spec names `bleauweb/SBA`; change it if you fork.
3. Create the app from the spec:

   ```sh
   doctl apps create --spec .do/app.yaml
   ```

4. In the control panel open the app, then **Settings > web > Environment Variables**, and replace the `COOKIE_SECRET` placeholder with a long random string (for example `openssl rand -base64 32`). Without it the server makes a random secret at boot, which only means ownership cookies stop matching after a restart.
5. Optionally add a domain under **Settings > Domains**.

After that, every push to `main` builds the `Dockerfile` and redeploys (`deploy_on_push: true`). Pull requests run the CI workflow (typecheck, tests, build); protect `main` with that check so a red build never deploys. Keep the instance count at 1: each instance would have its own separate data.

To change the app later, edit `.do/app.yaml` and run `doctl apps update <app-id> --spec .do/app.yaml`.

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
