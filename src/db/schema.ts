import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { BeadSpec, GenerationSettings, LegendEntry, PatternTotals } from '../shared/types';

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    browserId: text('browser_id').notNull(),
    title: text('title').notNull(),
    originalKey: text('original_key').notNull(),
    workingKey: text('working_key').notNull(),
    thumbKey: text('thumb_key').notNull(),
    workingWidth: integer('working_width').notNull(),
    workingHeight: integer('working_height').notNull(),
    settings: text('settings', { mode: 'json' }).$type<GenerationSettings>().notNull(),
    createdAt: text('created_at').notNull(),
    lastAccessedAt: text('last_accessed_at').notNull(),
  },
  (t) => [index('projects_browser_idx').on(t.browserId), index('projects_last_accessed_idx').on(t.lastAccessedAt)],
);

export const patterns = sqliteTable(
  'patterns',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    stitch: text('stitch').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    cells: blob('cells', { mode: 'buffer' }).notNull(),
    legend: text('legend', { mode: 'json' }).$type<LegendEntry[]>().notNull(),
    totals: text('totals', { mode: 'json' }).$type<PatternTotals>().notNull(),
    beadSpec: text('bead_spec', { mode: 'json' }).$type<BeadSpec>().notNull(),
    settings: text('settings', { mode: 'json' }).$type<GenerationSettings>().notNull(),
    guideKey: text('guide_key'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('patterns_project_version_idx').on(t.projectId, t.version)],
);

export type ProjectRow = typeof projects.$inferSelect;
export type PatternRow = typeof patterns.$inferSelect;
