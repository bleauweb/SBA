# SBA — Seed Bead Art: Architecture

SBA turns a photograph into a printable guide for recreating the image as seed bead pixel art.
The guide contains the bead chart (color + symbol), a per-color materials list with bead counts
and weight estimates, finished dimensions, and a row-by-row reading of the pattern.

**Stack:** NestJS (API + SSR host) · React 19 server-side rendered via Vite · sharp (libvips) for
image work · Prisma + PostgreSQL · `@react-pdf/renderer` for PDF output.

---

## 1. What the app does (user flow)

1. **Upload** a photo (JPEG/PNG/WebP/HEIC).
2. **Configure** the project: crop, pattern width in beads, bead type and stitch, max number of
   colors, palette brand (e.g. Miyuki Delica 11/0), optional "only beads I own".
3. **Preview** the generated pattern live in the browser; tweak settings; re-generate.
4. **Export** a PDF guide: cover + preview, materials list with counts, full chart, paginated
   zoomed chart, row-by-row word chart.

Pattern generation is deterministic: the same image + settings always yields the same pattern,
so previews and PDFs never disagree.

---

## 2. Domain concepts

| Term | Meaning |
|---|---|
| **Bead** | A catalog entry: brand, product code (e.g. `DB-0010`), name, size (11/0, 15/0, 8/0), finish (opaque, transparent, matte, metallic, AB…), reference sRGB hex and derived CIELAB. |
| **Palette** | A named set of beads available for matching (a brand catalog, or a user's inventory subset). |
| **Stitch / layout** | How beads tile the plane: `square` (loom / square stitch, rectangular grid), `peyote` (columns offset by half a bead), `brick` (rows offset by half a bead). Determines cell geometry and how the PDF is read row by row. |
| **Cell** | One bead position in the pattern grid, identified by `(col, row)`. |
| **Pattern** | Immutable result of a generation run: dimensions, stitch, per-cell palette index, legend entries (bead, symbol, count), finished size, metadata. |
| **Guide** | The rendered PDF for one pattern version. |

### Bead geometry matters

Seed beads are not square. In loom/square stitch a Miyuki Delica 11/0 occupies roughly
**1.3 mm across the row × 1.6 mm per row** (≈ 20 beads/inch wide, ≈ 16 rows/inch tall).
If the image is sampled on a square grid the finished piece is stretched vertically by ~20%.
Every bead size/stitch combination therefore carries a `cellWidthMm` / `cellHeightMm`, and the
image is resampled on that non-square grid so the beaded result keeps the photo's proportions.
These constants live in data (`data/beads/*.json`), not code, so they can be calibrated.

---

## 3. The generation pipeline (core domain logic)

Pure TypeScript, no Nest dependencies, lives in `src/domain/`. Each stage is a pure function so
it can be unit-tested with fixture images and reused by both the web preview and the PDF.

```
photo ──▶ decode/normalize ──▶ crop ──▶ grid sample ──▶ quantize ──▶ palette match ──▶ symbols ──▶ Pattern
          (sharp)              (sharp)  (sharp + Lab)   (k-means Lab)  (ΔE2000)         (assign)
```

### 3.1 Decode & normalize (`image/`)
- `sharp` decodes, applies EXIF rotation, strips alpha onto a chosen background color
  (default white), converts to sRGB.
- Optional adjustments applied here: brightness, contrast, saturation, gamma. These are part of
  the project settings so they're reproducible.

### 3.2 Crop & grid sampling (`grid/`)
- User-chosen crop rectangle (normalized 0–1 coordinates) is applied.
- Target `widthBeads` is chosen by the user; `heightBeads` is derived:
  `heightBeads = round(cropHeightPx / cropWidthPx × widthBeads × cellWidthMm / cellHeightMm)`.
- The crop is resampled to `widthBeads × heightBeads` with area averaging (Lanczos3 is too sharp
  for bead art; use `kernel: 'mitchell'` or box). The result is an RGB buffer of one sample per cell.
- For **peyote/brick** layouts, cells are offset by half a cell on alternate columns/rows. The
  `StitchLayout` object exposes `cellCenter(col,row) → {xMm,yMm}` and sampling uses those centers
  (resample at 2× then average the cell footprint) so offset layouts aren't visually sheared.

### 3.3 Color space (`color/`)
- All comparisons happen in **CIELAB** with **ΔE2000** distance. sRGB → linear → XYZ (D65) → Lab.
- Tiny module, hand-written (≈100 lines), fully unit tested against known reference values.

### 3.4 Quantization (`quantize/`)
Goal: reduce the sampled cells to at most `maxColors` beads while keeping the picture readable.

Two-stage approach (gives better results than snapping every pixel directly to the catalog):

1. **Cluster** the cell colors in Lab with k-means (k = `maxColors`, k-means++ seeding, fixed RNG
   seed for determinism). Weighted by cell count so large areas dominate.
2. **Match** each cluster centroid to the nearest bead in the active palette by ΔE2000.
   Merge clusters that collapse onto the same bead. Optionally re-run assignment so each cell is
   matched to the nearest *chosen* bead rather than its cluster's bead (reduces banding).
3. Optional **dithering** (Floyd–Steinberg in Lab, restricted to the chosen bead set). Off by
   default — dithering is hard to bead and produces noisy charts — but useful for photos.
4. Optional **speckle removal**: cells whose color differs from all 4 neighbours and appears
   fewer than `minRun` times in the pattern are re-assigned to the nearest-color neighbour.
   Single stray beads are the main complaint with auto-generated bead patterns.

Palette filters applied before matching: brand, size, finishes allowed (transparent/AB finishes
have unreliable reference colors, so "opaque + matte only" is a sensible default), inventory-only.

### 3.5 Symbol assignment & legend (`legend/`)
- Each used bead gets a printable symbol (ordered set of high-contrast glyphs: `● ■ ▲ ◆ ✚ ★ …`,
  then letters). Symbols are chosen so the chart is readable when printed in black and white.
- Legend entry: `{ symbol, bead, count, grams, textColor }` where `textColor` is black/white chosen
  by luminance so the symbol is visible on the swatch.

### 3.6 Counts & estimates
- `count` per bead = number of cells.
- `grams = count / beadsPerGram` (data-driven; ≈ 200/g for Delica 11/0, ≈ 110/g for round 11/0).
- `packages = ceil(grams / packageGrams)` using the brand's standard tube size.
- Finished size in mm and inches from cell geometry. Thread estimate for loom work:
  `(heightBeads + 2) warps × (patternHeightMm + 2 × 150 mm)` plus weft ≈ `rows × width × 2.5`.

### 3.7 Output type (shared between server, client and PDF)

```ts
interface Pattern {
  id: string; projectId: string; version: number; createdAt: string;
  stitch: 'square' | 'peyote' | 'brick';
  beadSpec: { brand: string; size: string; cellWidthMm: number; cellHeightMm: number; beadsPerGram: number };
  width: number; height: number;          // in beads
  cells: Uint8Array | number[];           // row-major, index into legend
  legend: LegendEntry[];                  // ordered by count desc
  totals: { beads: number; grams: number; widthMm: number; heightMm: number };
  settings: GenerationSettings;           // frozen copy used to produce this version
}
```

`cells` is stored as a byte array (≤ 255 colors is a hard cap; practical max ~40).
A 200×300 pattern is 60 KB — fine to store inline and send to the browser.

---

## 4. NestJS application structure

Single Nest application. Domain logic is a plain TS package inside the repo; Nest modules are
thin orchestration around it.

```
src/
  main.ts                      bootstrap, Vite dev middleware in dev, static assets in prod
  app.module.ts
  config/                      typed config (env → ConfigService)
  domain/                      ← pure, framework-free (section 3)
    color/  grid/  quantize/  legend/  stitch/  image/
  modules/
    projects/                  CRUD for projects + settings; owns the upload
    images/                    storage abstraction (local disk | S3), thumbnails
    palettes/                  bead catalog, palette queries, inventory
    patterns/                  PatternService: runs the pipeline, versions results
    guides/                    GuideService: Pattern → PDF, caching by pattern version
    render/                    SSR controller: matches routes, loads data, streams React
    auth/                      (phase 3) sessions / OAuth; before that, anonymous projects by cookie
  client/
    entry-client.tsx           hydrateRoot
    entry-server.tsx           renderToPipeableStream(<App url data />)
    routes.tsx                 route table shared by server & client
    pages/                     Home, Project (editor), Pattern, Palettes
    components/
      chart/                   <Chart> SVG renderer (web) — reads Pattern only
      editor/                  settings form, crop tool
    api.ts                     typed fetch client
  pdf/
    GuideDocument.tsx          @react-pdf/renderer components (cover, materials, chart pages, word chart)
    chart-pager.ts             splits a large chart into printable tiles with overlap
  shared/
    types.ts                   Pattern, GenerationSettings, DTOs (imported by server, client, pdf)
data/
  beads/miyuki-delica-11.json  catalog seed files
  beads/toho-11-round.json
prisma/
  schema.prisma
test/
  fixtures/images/*.jpg
```

### 4.1 Module responsibilities

| Module | Key classes | Notes |
|---|---|---|
| `projects` | `ProjectsController`, `ProjectsService` | `POST /api/projects` (multipart image) creates a project with default settings. `PATCH /api/projects/:id/settings` validates with `class-validator`/zod. |
| `images` | `ImageStorage` (interface), `LocalImageStorage`, `S3ImageStorage` | Stores original + a 1024px working copy + thumbnail. Everything downstream reads the working copy. |
| `palettes` | `PalettesService`, `BeadCatalogLoader` | Seeds `BeadColor` rows from `data/beads/*.json` on boot (idempotent upsert by brand+code). Precomputes Lab. |
| `patterns` | `PatternsController`, `PatternsService`, `PatternGenerator` | `POST /api/projects/:id/patterns` runs the pipeline and stores a new immutable version. `GET /api/patterns/:id` returns JSON. Also exposes `GET …/preview.png` (sharp renders the cell grid upscaled) for cheap thumbnails. |
| `guides` | `GuidesController`, `GuidesService` | `GET /api/patterns/:id/guide.pdf`. Renders with `@react-pdf/renderer`, stores result in `ImageStorage` keyed by pattern id so it's generated once. |
| `render` | `RenderController`, `SsrService` | Catch-all GET for non-`/api` paths. Resolves route → loader → `renderToPipeableStream`. Injects serialized loader data for hydration. |

### 4.2 Request flow for the editor page

```
GET /projects/:id
  RenderController → routes.match → ProjectPage.loader(id)
    → ProjectsService.get + PatternsService.latest(projectId)
  → renderToPipeableStream(<App />) with { project, pattern } → HTML streams to client
  → client hydrates; settings form edits call PATCH …/settings then POST …/patterns
  → response Pattern JSON replaces the <Chart> data; no page reload
```

Preview generation for a ~100-bead-wide pattern is well under a second, so the API is
synchronous. `PatternsService` is written against a `JobRunner` interface with an inline
implementation; a BullMQ implementation can be swapped in later for very large patterns or PDF
bursts without touching controllers.

---

## 5. Server-side rendered React

**Choice: Vite SSR, hosted by Nest.** Not Next.js — embedding Next inside Nest fights both
frameworks' routers and build systems, and the app only has a handful of pages.

- **Dev:** `main.ts` creates a Vite dev server in middleware mode and registers it on the Express
  adapter. `entry-server.tsx` is loaded with `vite.ssrLoadModule` for HMR.
- **Prod:** `vite build` produces `dist/client` (assets, manifest) and `dist/server/entry-server.js`.
  Nest serves `dist/client` statically and imports the server entry once.
- **Rendering:** `renderToPipeableStream` with a `<Suspense>` shell so the page paints before the
  chart data arrives. Loader data is serialized into `<script id="__DATA__">` and read on hydrate.
- **Routing:** a small route table (path pattern → page component + loader). React Router's data
  APIs are an acceptable alternative; the table is kept tiny deliberately.
- **Chart rendering in the browser:** `<Chart>` is an SVG of `<rect>`s + `<text>` symbols. Patterns
  above ~20k cells switch to a `<canvas>` renderer behind the same props. Hover shows bead
  code/name; click toggles "highlight this color" which is the main way beaders check a chart.
- **Styling:** CSS modules; no CSS-in-JS so SSR stays trivial.

---

## 6. PDF guide generation

**Choice: `@react-pdf/renderer`.** Runs in Node without a browser, deterministic output, and the
chart is drawn with primitives from the same `Pattern` object the web chart uses. Alternative
considered: Playwright printing the React page to PDF — identical visuals to the web but a
headless browser dependency, slower, and non-deterministic page breaks. PDFKit directly was
rejected as too low level for the amount of layout in the guide.

The guide is composed of these `@react-pdf` pages:

1. **Cover** — project title, rendered preview (PNG from `PatternsService.preview`), finished
   size, bead type, stitch, total bead count, date, pattern version.
2. **Materials** — table: swatch, symbol, bead code, name, finish, count, grams, tubes.
   Plus thread/needle/loom notes for the chosen stitch.
3. **Overview chart** — whole pattern scaled to one page (color only, no symbols), with a
   10-bead grid overlay and row/column numbering. Lets the beader see the picture.
4. **Working chart** — the pattern tiled across pages at a fixed cell size (≈ 5 mm so symbols
   are legible), with 2-cell overlap between tiles, bold lines every 10 cells, column numbers
   on top/bottom and row numbers on both sides. Each cell shows color **and** symbol so the guide
   works in black-and-white prints. `chart-pager.ts` computes the tile layout from page size
   (Letter/A4, user choice) and cell size.
5. **Word chart** — row-by-row run-length text, e.g. `Row 12: 4×A, 2×C, 9×A, 1×B …`, reading
   direction alternating per row for loom work; for peyote the rows are grouped in pairs as
   beaders expect. This is what most people actually bead from.

Fonts: embed a font with full glyph coverage for the symbol set (e.g. DejaVu Sans) so symbols
render identically everywhere. PDFs are cached per pattern version; regenerating a pattern
produces a new version and a new PDF.

---

## 7. Data model (Prisma / PostgreSQL)

```prisma
model Project {
  id            String    @id @default(cuid())
  ownerId       String?                      // null = anonymous (cookie-scoped), phase 3 adds users
  title         String
  originalKey   String                       // storage key of uploaded image
  workingKey    String                       // 1024px normalized copy
  settings      Json                         // GenerationSettings (validated at the edge)
  patterns      Pattern[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Pattern {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  version     Int
  stitch      String
  width       Int
  height      Int
  cells       Bytes                           // Uint8Array, row-major
  legend      Json                            // LegendEntry[]
  totals      Json
  settings    Json                            // frozen settings used
  guideKey    String?                         // storage key of cached PDF
  createdAt   DateTime @default(now())
  @@unique([projectId, version])
}

model BeadColor {
  id          String  @id @default(cuid())
  brand       String                          // "Miyuki"
  line        String                          // "Delica"
  size        String                          // "11/0"
  code        String                          // "DB-0010"
  name        String
  finish      String                          // opaque | transparent | matte | metallic | ab | luster | ...
  hex         String
  labL        Float
  labA        Float
  labB        Float
  @@unique([brand, line, size, code])
}

model BeadSpec {                              // geometry/weight per brand+line+size
  id            String @id
  brand         String
  line          String
  size          String
  cellWidthMm   Float
  cellHeightMm  Float
  beadsPerGram  Float
  packageGrams  Float
  @@unique([brand, line, size])
}

model InventoryItem {                         // phase 3
  id          String @id @default(cuid())
  ownerId     String
  beadColorId String
  grams       Float
}
```

Settings shape (stored as JSON, validated with zod on input and reused by the client form):

```ts
interface GenerationSettings {
  crop: { x: number; y: number; w: number; h: number };          // normalized 0–1
  widthBeads: number;                                            // 10–400
  stitch: 'square' | 'peyote' | 'brick';
  beadSpecId: string;                                            // e.g. "miyuki-delica-11"
  maxColors: number;                                             // 2–60
  finishes: string[];                                            // allowed finishes
  inventoryOnly: boolean;
  dither: boolean;
  despeckle: boolean;
  adjust: { brightness: number; contrast: number; saturation: number };
  background: string;                                            // hex, used for transparent PNGs
  pageSize: 'LETTER' | 'A4';
}
```

---

## 8. HTTP surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects` | multipart: `image`, optional `title` → `{ project }` |
| `GET` | `/api/projects/:id` | project + latest pattern summary |
| `PATCH` | `/api/projects/:id/settings` | partial settings update |
| `POST` | `/api/projects/:id/patterns` | generate a new pattern version from current settings → `Pattern` |
| `GET` | `/api/patterns/:id` | pattern JSON |
| `GET` | `/api/patterns/:id/preview.png?scale=6` | raster preview |
| `GET` | `/api/patterns/:id/guide.pdf` | the guide (generated on first request, then cached) |
| `GET` | `/api/palettes` | bead specs + available finishes |
| `GET` | `/api/palettes/:specId/colors` | catalog for a bead spec |
| `GET` | `/`, `/projects/:id`, `/patterns/:id` | SSR pages |

Uploads are capped (e.g. 20 MB) and validated by sniffing magic bytes with sharp's metadata
call, never by extension. Anonymous projects are tied to a signed cookie until auth exists.

---

## 9. Key decisions (ADR summary)

| Decision | Choice | Why | Rejected |
|---|---|---|---|
| SSR approach | Vite SSR inside Nest | One process, one router, HMR in dev, few pages | Next.js inside Nest (two frameworks fighting), Remix |
| PDF engine | `@react-pdf/renderer` | No browser, deterministic, React components, same `Pattern` type | Playwright print (heavy, nondeterministic breaks), PDFKit (too low level) |
| Image library | `sharp` | Fast libvips, HEIC/EXIF handling, raw buffers | Jimp (slow, pure JS) |
| Color matching | k-means in Lab + ΔE2000 snap to catalog | Readable patterns, few stray colors | Direct per-pixel nearest-bead (noisy), median cut in RGB (poor perceptual results) |
| Pattern storage | Immutable versions, bytes inline | Reproducible guides, cheap to diff/undo | Mutating a single pattern row |
| Async jobs | Synchronous behind a `JobRunner` interface | Sub-second generation; avoids Redis on day one | BullMQ from the start |
| DB | Prisma + PostgreSQL (SQLite in tests) | Typed, migrations, JSON columns | TypeORM, raw SQL |
| Catalog data | JSON files in repo, seeded on boot | Reviewable in PRs, easy calibration | Hand-entered DB rows |

---

## 10. Testing strategy

- **Domain unit tests** (Vitest): color conversions against published reference values; ΔE2000
  against the Sharma test pairs; k-means determinism; despeckle; stitch geometry; legend symbol
  uniqueness; run-length word-chart encoding.
- **Golden tests**: fixture photos → pattern JSON snapshots. A change in output must be
  intentional and reviewed.
- **PDF smoke tests**: render a fixture pattern, assert page count and that every legend entry's
  code appears in extracted text.
- **E2E** (Playwright): upload → tweak → download PDF.

---

## 11. Delivery phases

**Phase 1 — Core (MVP)**
Nest + Vite SSR skeleton; upload; square stitch; Miyuki Delica 11/0 catalog; k-means + ΔE2000;
web chart with highlight; PDF with cover, materials, overview, working chart, word chart.

**Phase 2 — Quality**
Peyote and brick layouts; despeckle + dither options; crop tool; image adjustments; Toho and
Miyuki round catalogs; Letter/A4; pattern version history and compare.

**Phase 3 — Accounts**
Auth; saved projects; bead inventory and "inventory-only" matching; shopping list export (CSV);
shareable read-only pattern links.

**Phase 4 — Scale (only if needed)**
BullMQ worker for PDF/pattern jobs; S3 storage; CDN for previews.

---

## 12. Open questions for the product owner

1. Which bead brands/lines matter first? (Assumed Miyuki Delica 11/0; the catalog is data, so
   adding Toho/Preciosa is cheap, but reference hex values must be sourced.)
2. Is loom/square stitch the primary technique, or peyote? This sets the default and which word
   chart format gets polished first.
3. Should the MVP support anonymous use (cookie-scoped projects), or require an account?
