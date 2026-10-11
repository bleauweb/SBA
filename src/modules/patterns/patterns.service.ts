import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { newId, nowIso } from '../../common/ids';
import { DB, type Db } from '../../db/db.module';
import { patterns, type PatternRow, type ProjectRow } from '../../db/schema';
import { generatePattern } from '../../domain/generate';
import { renderPatternPng } from '../../domain/image/render';
import type { Pattern } from '../../shared/types';
import { PalettesService } from '../palettes/palettes.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class PatternsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly projects: ProjectsService,
    private readonly palettes: PalettesService,
  ) {}

  /** Runs the pipeline on the project's current settings and stores a new version. */
  async generate(project: ProjectRow): Promise<Pattern> {
    const spec = this.palettes.spec(project.settings.beadSpecId);
    if (!spec) throw new UnprocessableEntityException('unknown bead spec');
    const palette = this.palettes.paletteFor(project.settings);
    if (palette.length === 0) throw new UnprocessableEntityException('No beads match the chosen finishes. Allow more finishes.');

    const image = await this.projects.workingImage(project);
    const generated = await generatePattern({ image, settings: project.settings, spec, palette });

    const latest = this.db.select({ version: patterns.version }).from(patterns).where(eq(patterns.projectId, project.id)).orderBy(desc(patterns.version)).get();
    const row: PatternRow = {
      id: newId(),
      projectId: project.id,
      version: (latest?.version ?? 0) + 1,
      stitch: generated.stitch,
      width: generated.width,
      height: generated.height,
      cells: Buffer.from(Uint8Array.from(generated.cells)),
      legend: generated.legend,
      totals: generated.totals,
      beadSpec: generated.beadSpec,
      settings: generated.settings,
      guideKey: null,
      createdAt: nowIso(),
    };
    this.db.insert(patterns).values(row).run();
    return this.toPattern(row);
  }

  getRow(id: string): PatternRow {
    const row = this.db.select().from(patterns).where(eq(patterns.id, id)).get();
    if (!row) throw new NotFoundException('pattern not found');
    return row;
  }

  get(id: string): Pattern {
    return this.toPattern(this.getRow(id));
  }

  latestForProject(projectId: string): Pattern | null {
    const row = this.db.select().from(patterns).where(eq(patterns.projectId, projectId)).orderBy(desc(patterns.version)).get();
    return row ? this.toPattern(row) : null;
  }

  setGuideKey(id: string, key: string) {
    this.db.update(patterns).set({ guideKey: key }).where(eq(patterns.id, id)).run();
  }

  async preview(pattern: Pattern, scale: number, grid = true): Promise<Buffer> {
    return renderPatternPng({
      width: pattern.width,
      height: pattern.height,
      cells: pattern.cells,
      hexByIndex: pattern.legend.map((l) => l.bead.hex),
      scale,
      grid,
    });
  }

  toPattern(row: PatternRow): Pattern {
    return {
      id: row.id,
      projectId: row.projectId,
      version: row.version,
      createdAt: row.createdAt,
      stitch: row.stitch as Pattern['stitch'],
      beadSpec: row.beadSpec,
      width: row.width,
      height: row.height,
      cells: Array.from(new Uint8Array(row.cells.buffer, row.cells.byteOffset, row.cells.byteLength)),
      legend: row.legend,
      totals: row.totals,
      settings: row.settings,
    };
  }
}
