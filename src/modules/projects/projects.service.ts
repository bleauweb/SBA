import { ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { and, desc, eq, lt } from 'drizzle-orm';
import sharp from 'sharp';
import { newId, nowIso } from '../../common/ids';
import { CONFIG, type AppConfig } from '../../config/config';
import { DB, type Db } from '../../db/db.module';
import { patterns, projects, type ProjectRow } from '../../db/schema';
import { defaultSettings, settingsPatchSchema, settingsSchema } from '../../shared/settings';
import type { GenerationSettings, Project, ProjectSummary } from '../../shared/types';
import { ImageStorage } from '../images/image-storage';
import { PalettesService } from '../palettes/palettes.service';

const WORKING_MAX = 1024;
const THUMB_MAX = 320;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    private readonly storage: ImageStorage,
    private readonly palettes: PalettesService,
  ) {}

  async create(browserId: string, upload: Buffer, title?: string): Promise<Project> {
    const live = this.db.select({ id: projects.id }).from(projects).where(eq(projects.browserId, browserId)).all();
    if (live.length >= this.cfg.maxProjectsPerBrowser) {
      throw new UnprocessableEntityException(`This browser already has ${live.length} projects. Delete some first.`);
    }

    let meta: sharp.Metadata;
    try {
      meta = await sharp(upload).metadata();
    } catch {
      throw new UnprocessableEntityException('That file is not an image we can read.');
    }
    const okFormats = new Set(['jpeg', 'png', 'webp', 'heif', 'tiff', 'gif', 'avif']);
    if (!meta.format || !okFormats.has(meta.format) || !meta.width || !meta.height) {
      throw new UnprocessableEntityException('Please upload a JPEG, PNG, WebP or HEIC photo.');
    }

    const id = newId();
    const ext = meta.format === 'jpeg' ? 'jpg' : meta.format;
    const originalKey = `projects/${id}/original.${ext}`;
    const workingKey = `projects/${id}/working.png`;
    const thumbKey = `projects/${id}/thumb.jpg`;

    const working = await sharp(upload).rotate().resize(WORKING_MAX, WORKING_MAX, { fit: 'inside', withoutEnlargement: true }).png().toBuffer({ resolveWithObject: true });
    const thumb = await sharp(working.data).resize(THUMB_MAX, THUMB_MAX, { fit: 'inside' }).flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();

    await this.storage.put(originalKey, upload);
    await this.storage.put(workingKey, working.data);
    await this.storage.put(thumbKey, thumb);

    const now = nowIso();
    const row: ProjectRow = {
      id,
      browserId,
      title: (title ?? '').trim().slice(0, 120) || 'Untitled project',
      originalKey,
      workingKey,
      thumbKey,
      workingWidth: working.info.width,
      workingHeight: working.info.height,
      settings: defaultSettings(),
      createdAt: now,
      lastAccessedAt: now,
    };
    this.db.insert(projects).values(row).run();
    return this.toProject(row, null);
  }

  /** Loads a project and bumps lastAccessedAt. Throws 404 if missing. */
  getRow(id: string): ProjectRow {
    const row = this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!row) throw new NotFoundException('project not found');
    const now = nowIso();
    if (row.lastAccessedAt.slice(0, 10) !== now.slice(0, 10)) {
      this.db.update(projects).set({ lastAccessedAt: now }).where(eq(projects.id, id)).run();
      row.lastAccessedAt = now;
    }
    return row;
  }

  get(id: string): Project {
    return this.toProject(this.getRow(id), this.latestPatternId(id));
  }

  assertOwner(row: ProjectRow, browserId: string | null) {
    if (!browserId || row.browserId !== browserId) throw new ForbiddenException('This project belongs to another browser.');
  }

  listForBrowser(browserId: string): ProjectSummary[] {
    const rows = this.db.select().from(projects).where(eq(projects.browserId, browserId)).orderBy(desc(projects.lastAccessedAt)).all();
    return rows.map((r) => this.toSummary(r, this.latestPatternId(r.id)));
  }

  updateSettings(row: ProjectRow, patch: unknown): Project {
    const parsedPatch = settingsPatchSchema.safeParse(patch);
    if (!parsedPatch.success) throw new UnprocessableEntityException(parsedPatch.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    const merged: GenerationSettings = { ...row.settings, ...parsedPatch.data };
    const full = settingsSchema.safeParse(merged);
    if (!full.success) throw new UnprocessableEntityException(full.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    if (!this.palettes.spec(full.data.beadSpecId)) throw new UnprocessableEntityException('unknown bead spec');
    this.db.update(projects).set({ settings: full.data, lastAccessedAt: nowIso() }).where(eq(projects.id, row.id)).run();
    return this.toProject({ ...row, settings: full.data }, this.latestPatternId(row.id));
  }

  rename(row: ProjectRow, title: string): Project {
    const t = title.trim().slice(0, 120) || 'Untitled project';
    this.db.update(projects).set({ title: t }).where(eq(projects.id, row.id)).run();
    return this.toProject({ ...row, title: t }, this.latestPatternId(row.id));
  }

  async delete(row: ProjectRow): Promise<void> {
    this.db.delete(projects).where(eq(projects.id, row.id)).run();
    await this.storage.removePrefix(`projects/${row.id}`);
  }

  /** Deletes projects not opened for `days` days. Returns how many went. */
  async deleteExpired(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const rows = this.db.select().from(projects).where(and(lt(projects.lastAccessedAt, cutoff))).all();
    for (const r of rows) await this.delete(r);
    return rows.length;
  }

  async workingImage(row: ProjectRow): Promise<Buffer> {
    return this.storage.get(row.workingKey);
  }

  async thumbnail(row: ProjectRow): Promise<Buffer> {
    return this.storage.get(row.thumbKey);
  }

  latestPatternId(projectId: string): string | null {
    const p = this.db.select({ id: patterns.id }).from(patterns).where(eq(patterns.projectId, projectId)).orderBy(desc(patterns.version)).get();
    return p?.id ?? null;
  }

  toSummary(row: ProjectRow, latestPatternId: string | null): ProjectSummary {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      lastAccessedAt: row.lastAccessedAt,
      latestPatternId,
      thumbnailUrl: `/api/projects/${row.id}/thumbnail.jpg`,
    };
  }

  toProject(row: ProjectRow, latestPatternId: string | null): Project {
    return {
      ...this.toSummary(row, latestPatternId),
      settings: row.settings,
      workingWidth: row.workingWidth,
      workingHeight: row.workingHeight,
      workingImageUrl: `/api/projects/${row.id}/working.png`,
    };
  }
}
