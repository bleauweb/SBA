# SBA — Seed Bead Art: Architecture

SBA turns a photograph into a printable guide for recreating the image as seed bead pixel art.
The guide contains the bead chart (color + symbol), a per-color materials list with bead counts
and weight estimates, finished dimensions, a row-by-row reading of the pattern, and a short
getting-started page for the recommended technique.

**Stack:** NestJS (API + SSR host) · React 19 server-side rendered via Vite · sharp (libvips) for
image work · Prisma + PostgreSQL · `@react-pdf/renderer` for PDF output.

**Product constraints (decided):**
- **No accounts.** Anyone can upload a photo and get a guide. A browser cookie remembers that
  browser's projects; the project URL itself is the share link. Projects expire after a period of
  inactivity.
- **Beginner-first technique.** The default and only Phase 1 layout is a square grid, beaded on a
  **loom** (or square stitch, which produces the same grid without a loom). Peyote and brick come later.
- **Beads you can buy at Michaels.** The first catalog is **Toho 11/0 round** seed beads, which
  Michaels sells in named-color tubes. Miyuki 11/0 round and Miyuki Delica 11/0 follow as
  online-orderable options. See §13 for sourcing details.

---

## 1. What the app does (user flow)

1. **Upload** a photo (JPEG/PNG/WebP/HEIC). No sign-in.
2. **Configure** the project: crop, pattern width in beads, bead line (default Toho 11/0 round),
   max number of colors, allowed finishes, optional "only use these beads" selection, optional
   calibration from beads you've measured.
3. **Preview** the generated pattern live in the browser; tweak settings; re-generate.
4. **Export** a PDF guide: cover + preview, getting-started page, materials list with counts,
   overview chart, paginated working chart, row-by-row word chart.
5. **Come back later** from the same browser (cookie) or via the project link.

Pattern generation is deterministic: the same image + settings always yields the same pattern,
so previews and PDFs never disagree.

---

## 2. Domain concepts

| Term | Meaning |
|---|---|
| **Bead** | A catalog entry: brand, line, product code (e.g. Toho `11-55`), name, size (11/0, 15/0, 8/0), finish (opaque, transparent, matte, metallic, AB…), reference sRGB hex and derived CIELAB. |
| **Bead spec** | Geometry and weight for a brand+line+size: cell width/height in mm, beads per gram, standard tube weight. |
| **Palette** | The set of beads available for matching: a bead line filtered by allowed finishes, optionally narrowed to a per-project "beads I have" selection. |
| **Stitch / layout** | How beads tile the plane: `square` (loom / square stitch, rectangular grid) in Phase 1; `peyote` (columns offset by half a bead) and `brick` (rows offset by half a bead) later. Determines cell geometry and how the PDF is read row by row. |
| **Cell** | One bead position in the pattern grid, identified by `(col, row)`. |
| **Pattern** | Immutable result of a generation run: dimensions, stitch, per-cell palette index, legend entries (bead, symbol, count), finished size, metadata. |
| **Guide** | The rendered PDF for one pattern version. |

### Bead geometry matters

Seed beads are not square. In loom work the bead's hole runs along the row, so a cell's **width**
is the bead's hole-to-hole length and its **height** is the bead's diameter. For Toho 11/0 rounds
that is roughly 1.4–1.5 mm wide (≈ 18 beads per inch strung) by ≈ 2.0–2.2 mm tall. For Miyuki
Delica 11/0 cylinders it's ≈ 1.3 × 1.6 mm. If the image were sampled on a square grid the finished
piece would come out noticeably stretched vertically.

Every bead spec therefore carries `cellWidthMm` / `cellHeightMm`, and the image is resampled on
that non-square grid so the beaded result keeps the photo's proportions. These constants live in
data (`data/beads/*.json`), not code. Because published bead dimensions vary by source and by
color/finish, the app also supports **user calibration**: measure the width of 10 beads in a row
and the height of 10 rows on a test swatch, enter both, and the project uses those instead. The
guide tells beginners how to do this.

---

## 3. The generation pipeline (core domain logic)

Pure TypeScript, no Nest dependencies, lives in `src/domain/`. Each stage is a pure function so
it can be unit-tested with fixture images and reused by both the web preview and the PDF.

```
photo ──▶ decode/normalize ──▶ crop ──▶ grid sample ──▶ quantize ──▶ palette match ──▶ symbols ──▶ Pattern
          (sharp)              (sharp)  (sharp + Lab)   (k-means Lab)  (ΔE2000)         (assign)
```

### 3.1 Decode & normalize (`image/`)
- `sharp` decodes, applies EXIF rotation, flattens alpha onto a chosen background color
  (default white), converts to sRGB.
- Optional adjustments applied here: brightness, contrast, saturation, gamma. These are part of
  the project settings so they're reproducible.

### 3.2 Crop & grid sampling (`grid/`)
- User-chosen crop rectangle (normalized 0–1 coordinates) is applied.
- Target `widthBeads` is chosen by the user; `heightBeads` is derived:
  `heightBeads = round(cropHeightPx / cropWidthPx × widthBeads × cellWidthMm / cellHeightMm)`.
- The crop is resampled to `widthBeads × heightBeads` with area averaging (Lanczos3 is too sharp
  for bead art; use `kernel: 'mitchell'` or box). The result is an RGB buffer of one sample per cell.
- For later **peyote/brick** layouts, cells are offset by half a cell on alternate columns/rows.
  The `StitchLayout` object exposes `cellCenter(col,row) → {xMm,yMm}` and sampling uses those
  centers (resample at 2× then average the cell footprint) so offset layouts aren't visually sheared.
  Phase 1 ships only the `square` layout but keeps this interface.

### 3.3 Color space (`color/`)
- All comparisons happen in **CIELAB** with **ΔE2000** distance. sRGB → linear → XYZ (D65) → Lab.
- Tiny module, hand-written (≈100 lines), fully unit tested against known reference values.

### 3.4 Quantization (`quantize/`)
Goal: reduce the sampled cells to at most `maxColors` beads while keeping the picture readable.

Two-stage approach (gives better results than snapping every pixel directly to the catalog):

1. **Cluster** the cell colors in Lab with k-means (k = `maxColors`, k-means++ seeding, fixed RNG
   seed for determinism). Weighted by cell count so large areas dominate.
2. **Match** each cluster centroid to the nearest bead in the active palette by ΔE2000.
   Merge clusters that collapse onto the same bead. Then re-assign each cell to the nearest
   *chosen* bead rather than its cluster's bead (reduces banding).
3. Optional **dithering** (Floyd–Steinberg in Lab, restricted to the chosen bead set). Off by
   default — dithering is hard to bead and produces noisy charts — but useful for photos.
4. Optional **speckle removal** (on by default): cells whose color differs from all 4 neighbours
   and whose color appears fewer than `minRun` times are re-assigned to the nearest-color
   neighbour. Single stray beads are the main complaint with auto-generated bead patterns.

Palette filters applied before matching: bead line, finishes allowed (transparent/AB/lined
finishes have unreliable reference colors and look different on thread, so "opaque + matte +
ceylon only" is the beginner default), and the optional per-project bead selection.

### 3.5 Symbol assignment & legend (`legend/`)
- Each used bead gets a printable symbol (ordered set of high-contrast glyphs: `● ■ ▲ ◆ ✚ ★ …`,
  then letters). Symbols are chosen so the chart is readable when printed in black and white.
- Legend entry: `{ symbol, bead, count, grams, tubes, textColor }` where `textColor` is black/white
  chosen by luminance so the symbol is visible on the swatch.

### 3.6 Counts & estimates
- `count` per bead = number of cells.
- `grams = count / beadsPerGram` (data-driven; ≈ 110/g for Toho 11/0 round, ≈ 200/g for Delica 11/0).
- `tubes = ceil(grams × 1.15 / packageGrams)` using the line's standard tube size (Toho 11/0 at
  Michaels: 8 g tubes). The 15% margin covers culled/broken beads.
- Finished size in mm and inches from cell geometry (or calibration).
- Loom thread estimate: `(widthBeads + 1) warps × (patternHeightMm + 2 × 150 mm)` plus weft
  ≈ `rows × patternWidthMm × 2.5`.

### 3.7 Output type (shared between server, client and PDF)

```ts
interface Pattern {
  id: string; projectId: string; version: number; createdAt: string;
  stitch: 'square' | 'peyote' | 'brick';
  beadSpec: { id: string; brand: string; line: string; size: string;
              cellWidthMm: number; cellHeightMm: number; beadsPerGram: number; packageGrams: number };
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
thin orchestration around it. There is no auth module.

```
src/
  main.ts                      bootstrap, Vite dev middleware in dev, static assets in prod
  app.module.ts
  config/                      typed config (env → ConfigService)
  domain/                      ← pure, framework-free (section 3)
    color/  grid/  quantize/  legend/  stitch/  image/
  modules/
    projects/                  CRUD for projects + settings; owns the upload; browser-cookie ownership
    images/                    storage abstraction (local disk | S3), thumbnails
    palettes/                  bead catalog + bead specs
    patterns/                  PatternService: runs the pipeline, versions results
    guides/                    GuideService: Pattern → PDF, cached by pattern version
    render/                    SSR controller: matches routes, loads data, streams React
    housekeeping/              scheduled job: delete expired projects and their files
  client/
    entry-client.tsx           hydrateRoot
    entry-server.tsx           renderToPipeableStream(<App url data />)
    routes.tsx                 route table shared by server & client
    pages/                     Home (upload + "your recent projects"), Project (editor), Pattern
    components/
      chart/                   <Chart> SVG renderer (web) — reads Pattern only
      editor/                  settings form, crop tool, bead picker, calibration fields
    api.ts                     typed fetch client
  pdf/
    GuideDocument.tsx          @react-pdf/renderer components (cover, getting started, materials, charts, word chart)
    chart-pager.ts             splits a large chart into printable tiles with overlap
  shared/
    types.ts                   Pattern, GenerationSettings, DTOs (imported by server, client, pdf)
data/
  beads/toho-11-round.json     Phase 1 catalog
  beads/miyuki-11-round.json   Phase 2
  beads/miyuki-delica-11.json  Phase 2
  beads/specs.json             geometry + weight per brand/line/size
prisma/
  schema.prisma
test/
  fixtures/images/*.jpg
```

### 4.1 Module responsibilities

| Module | Key classes | Notes |
|---|---|---|
| `projects` | `ProjectsController`, `ProjectsService`, `BrowserIdentity` | `POST /api/projects` (multipart image) creates a project with default settings and records the browser id. `PATCH /api/projects/:id/settings` validates with zod. `GET /api/projects` lists this browser's projects. |
| `images` | `ImageStorage` (interface), `LocalImageStorage`, `S3ImageStorage` | Stores original + a 1024px working copy + thumbnail. Everything downstream reads the working copy. |
| `palettes` | `PalettesService`, `BeadCatalogLoader` | Seeds `BeadColor`/`BeadSpec` rows from `data/beads/*.json` on boot (idempotent upsert by brand+line+size+code). Precomputes Lab. |
| `patterns` | `PatternsController`, `PatternsService`, `PatternGenerator` | `POST /api/projects/:id/patterns` runs the pipeline and stores a new immutable version. `GET /api/patterns/:id` returns JSON. Also `GET …/preview.png` (sharp renders the cell grid upscaled) for thumbnails. |
| `guides` | `GuidesController`, `GuidesService` | `GET /api/patterns/:id/guide.pdf`. Renders with `@react-pdf/renderer`, stores the result in `ImageStorage` keyed by pattern id so it's generated once. |
| `render` | `RenderController`, `SsrService` | Catch-all GET for non-`/api` paths. Resolves route → loader → `renderToPipeableStream`. Injects serialized loader data for hydration. |
| `housekeeping` | `ExpiryJob` (`@nestjs/schedule`) | Nightly: delete projects whose `lastAccessedAt` is older than the retention window (default 60 days), including stored images and PDFs. |

### 4.2 Account-less ownership

- On first write the server sets a signed, httpOnly `sba_browser` cookie holding a random id.
- Every project stores the `browserId` that created it. Mutations (settings, regenerate, delete)
  require a matching cookie. Reads need only the project id, which is a 128-bit random
  unguessable string, so the URL doubles as a share link.
- The home page lists "your recent projects" from the cookie. Clearing cookies loses the list but
  not the projects; the user can still open them by link. The guide PDF prints the project link
  on the cover for exactly this reason.
- No personal data is collected. Uploaded photos are kept only to allow re-generation and are
  deleted with the project.

### 4.3 Request flow for the editor page

```
GET /projects/:id
  RenderController → routes.match → ProjectPage.loader(id)
    → ProjectsService.get (touches lastAccessedAt) + PatternsService.latest(projectId)
  → renderToPipeableStream(<App />) with { project, pattern, canEdit } → HTML streams to client
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
  code/name; click toggles "highlight this color", which is the main way beaders check a chart.
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
   size, bead line, stitch, total bead count, date, pattern version, and the project link.
2. **Getting started** — one page for beginners: what a bead loom is and that Michaels sells one
   (Beadsmith), needle size (10 or 12 beading needle), thread (Nymo or FireLine), how to warp
   the loom for this pattern's width, how to read the chart and word chart, and how to measure
   a 10×10 swatch for calibration. Text is a static template parameterised by the pattern.
3. **Materials** — table: swatch, symbol, bead code, name, finish, count, grams, tubes to buy.
   Plus thread length and warp count for the chosen stitch.
4. **Overview chart** — whole pattern scaled to one page (color only, no symbols), with a
   10-bead grid overlay and row/column numbering. Lets the beader see the picture.
5. **Working chart** — the pattern tiled across pages at a fixed cell size (≈ 5 mm so symbols
   are legible), with 2-cell overlap between tiles, bold lines every 10 cells, column numbers
   on top/bottom and row numbers on both sides. Each cell shows color **and** symbol so the guide
   works in black-and-white prints. `chart-pager.ts` computes the tile layout from page size
   (Letter/A4, user choice) and cell size.
6. **Word chart** — row-by-row run-length text, e.g. `Row 12: 4×A, 2×C, 9×A, 1×B …`. For loom
   work every row reads left to right (the needle passes under the warps each row), which is
   simpler than the alternating direction used for off-loom stitches. For peyote (later) rows are
   grouped in pairs as beaders expect. This is what most people actually bead from.

Fonts: embed a font with full glyph coverage for the symbol set (e.g. DejaVu Sans) so symbols
render identically everywhere. PDFs are cached per pattern version; regenerating a pattern
produces a new version and a new PDF.

---

## 7. Data model (Prisma / PostgreSQL)

```prisma
model Project {
  id              String    @id                 // 128-bit random, URL-safe; doubles as share link
  browserId       String                        // from signed cookie; required for mutations
  title           String
  originalKey     String                        // storage key of uploaded image
  workingKey      String                        // 1024px normalized copy
  settings        Json                          // GenerationSettings (validated at the edge)
  patterns        Pattern[]
  createdAt       DateTime  @default(now())
  lastAccessedAt  DateTime  @default(now())     // drives expiry
  @@index([browserId])
  @@index([lastAccessedAt])
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
  specId      String                          // → BeadSpec
  code        String                          // "11-55"
  name        String                          // "Opaque Turquoise"
  finish      String                          // opaque | matte | ceylon | transparent | silver-lined | ab | metallic | ...
  hex         String
  labL        Float
  labA        Float
  labB        Float
  @@unique([specId, code])
}

model BeadSpec {                              // geometry/weight per brand+line+size
  id            String @id                    // "toho-11-round"
  brand         String                        // "Toho"
  line          String                        // "Round"
  size          String                        // "11/0"
  cellWidthMm   Float
  cellHeightMm  Float
  beadsPerGram  Float
  packageGrams  Float
  whereToBuy    String                        // short note shown in the UI, e.g. "Michaels, Amazon"
}
```

Settings shape (stored as JSON, validated with zod on input and reused by the client form):

```ts
interface GenerationSettings {
  crop: { x: number; y: number; w: number; h: number };          // normalized 0–1
  widthBeads: number;                                            // 10–400
  stitch: 'square';                                              // 'peyote' | 'brick' added in Phase 2
  beadSpecId: string;                                            // default "toho-11-round"
  maxColors: number;                                             // 2–60, default 12
  finishes: string[];                                            // default ['opaque','matte','ceylon']
  selectedBeadIds?: string[];                                    // "only use these beads"; undefined = whole line
  calibration?: { tenBeadsWidthMm: number; tenRowsHeightMm: number }; // overrides spec geometry
  dither: boolean;                                               // default false
  despeckle: boolean;                                            // default true
  adjust: { brightness: number; contrast: number; saturation: number };
  background: string;                                            // hex, used for transparent PNGs
  pageSize: 'LETTER' | 'A4';                                     // default LETTER
}
```

The "only use these beads" list is a per-project choice stored in settings. The browser also
keeps the last used selection in `localStorage` so a new project can start from it without any
server-side account state.

---

## 8. HTTP surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects` | multipart: `image`, optional `title` → `{ project }`; sets browser cookie if absent |
| `GET` | `/api/projects` | this browser's projects (from cookie), newest first |
| `GET` | `/api/projects/:id` | project + latest pattern summary; touches `lastAccessedAt` |
| `PATCH` | `/api/projects/:id/settings` | partial settings update (cookie must match) |
| `DELETE` | `/api/projects/:id` | delete project, images and PDFs (cookie must match) |
| `POST` | `/api/projects/:id/patterns` | generate a new pattern version from current settings → `Pattern` (cookie must match) |
| `GET` | `/api/patterns/:id` | pattern JSON |
| `GET` | `/api/patterns/:id/preview.png?scale=6` | raster preview |
| `GET` | `/api/patterns/:id/guide.pdf` | the guide (generated on first request, then cached) |
| `GET` | `/api/palettes` | bead specs + available finishes |
| `GET` | `/api/palettes/:specId/colors` | catalog for a bead spec |
| `GET` | `/`, `/projects/:id`, `/patterns/:id` | SSR pages |

Uploads are capped (e.g. 20 MB) and validated by sniffing with sharp's metadata call, never by
extension. Because there is no login, abuse controls are per IP and per browser id: rate limits on
upload and generate, a cap on live projects per browser, and the expiry job.

---

## 9. Key decisions (ADR summary)

| Decision | Choice | Why | Rejected |
|---|---|---|---|
| Accounts | None; signed browser cookie + unguessable project ids | Zero friction for a hobby tool; no PII to protect | Email/OAuth login, magic links |
| Default technique | Square grid, loom (or square stitch) | Chart is literally the picture, fastest stitch, looms sold at Michaels; easiest for a first-timer | Peyote as default (offset grid is harder to read from a photo chart) |
| First bead catalog | Toho 11/0 round | Sold at Michaels under real product codes; well-documented colors | Bead Landing (house brand, no stable codes), Delica first (mostly online) |
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
  against the Sharma test pairs; k-means determinism; despeckle; stitch geometry and calibration
  override; legend symbol uniqueness; run-length word-chart encoding.
- **Golden tests**: fixture photos → pattern JSON snapshots. A change in output must be
  intentional and reviewed.
- **PDF smoke tests**: render a fixture pattern, assert page count and that every legend entry's
  code appears in extracted text.
- **E2E** (Playwright): upload → tweak → download PDF; cookie-less second browser can view but
  not edit.

---

## 11. Delivery phases

**Phase 1 — Core (MVP)**
Nest + Vite SSR skeleton; upload; browser-cookie projects; square/loom layout; Toho 11/0 round
catalog (opaque/matte/ceylon finishes first); k-means + ΔE2000; despeckle; web chart with
highlight; PDF with cover, getting-started page, materials, overview, working chart, word chart;
expiry job.

**Phase 2 — Quality**
Crop tool; image adjustments; dither option; calibration fields; "only these beads" picker with
localStorage memory; Miyuki 11/0 round and Delica 11/0 catalogs; Letter/A4; pattern version
history and compare.

**Phase 3 — More techniques**
Peyote and brick layouts with their own word-chart formats and getting-started pages; square
stitch instructions as a loom-less alternative; shopping list export (CSV).

**Phase 4 — Scale (only if needed)**
BullMQ worker for PDF/pattern jobs; S3 storage; CDN for previews.

---

## 12. Decisions made with the product owner

1. **Account-less.** See §4.2. Retention window defaults to 60 days since last access; the
   cover page prints the project link so a guide can always be found again.
2. **Technique.** The owner is new to beading, so the app recommends loom beading and ships a
   getting-started page. The architecture keeps a `StitchLayout` abstraction so peyote/brick can
   be added without touching the pipeline.
3. **Beads.** Start with what Michaels stocks; see §13.

---

## 13. Bead sourcing for the first version

What Michaels (US) actually sells, as of this writing:

- **Toho 11/0 Japanese glass seed beads** in single-color tubes with Toho's own color codes
  (e.g. `11-55 Opaque Turquoise`), ~8 g per tube. This is the only Michaels seed bead line with
  stable, catalogued colors, so it is the Phase 1 palette.
- **Bead Landing** (Michaels house brand): mostly 6/0 beads and assorted multicolor 12/0 mixes.
  No per-color product codes, so it can't be a matching palette. Could be offered later as a small
  hand-measured "starter mix" palette if there's demand.
- **Beadsmith looms** (e.g. the LoomEEZ kit) and metal looms — referenced on the getting-started page.

Catalog data plan for `data/beads/toho-11-round.json`:
- One entry per Toho 11/0 round color: code, name, finish, reference hex.
- Reference hex values come from retailer swatches (Beadaholique / Fire Mountain product images),
  averaged over the bead area and recorded with a `source` field per entry so they can be audited
  and corrected. Transparent, silver-lined and AB finishes are included but excluded from the
  beginner default because their on-thread appearance differs a lot from the swatch.
- A `michaelsCommon: true` flag marks colors commonly stocked in-store, so the UI can offer a
  "Michaels in-store colors" preset. This list is maintained by hand.

Geometry starting values for `data/beads/specs.json` (to be calibrated; see §2):

| spec id | cell width mm | cell height mm | beads/g | tube g |
|---|---|---|---|---|
| `toho-11-round` | 1.45 | 2.1 | 110 | 8 |
| `miyuki-11-round` | 1.4 | 2.0 | 110 | 8 (varies) |
| `miyuki-delica-11` | 1.3 | 1.6 | 200 | 7.2 |

Sources used for the Michaels and Toho facts:
- Michaels Toho 11/0 listing: https://www.michaels.com/product/toho-110-japanese-glass-seed-beads-10269959
- Michaels Beadsmith LoomEEZ loom: https://www.michaels.com/product/the-beadsmith-loomeez-japanese-bead-loom-kit-10698136
- Michaels Bead Landing 6/0 seed beads: https://www.michaels.com/product/glass-seed-beads-by-bead-landing-60-10737901
- Toho 11/0 round dimensions and beads per gram (Beadaholique product data): https://beadaholique.com/products/toho-round-seed-beads-11-55-opaque-turquoise-8-gram-tube
