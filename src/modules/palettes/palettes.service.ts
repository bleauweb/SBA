import { Inject, Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG, type AppConfig } from '../../config/config';
import { hexToRgb, rgbToLab } from '../../domain/color/color';
import type { BeadColor, BeadSpec, GenerationSettings } from '../../shared/types';

interface CatalogFile {
  specId: string;
  colors: Array<{ code: string; name: string; finish: string; hex: string; michaelsCommon?: boolean; source?: string }>;
}

/** Bead specs and colour catalogues, loaded from `data/beads/*.json` at boot. */
@Injectable()
export class PalettesService {
  private readonly log = new Logger(PalettesService.name);
  private readonly specsById = new Map<string, BeadSpec>();
  private readonly colorsBySpec = new Map<string, BeadColor[]>();

  constructor(@Inject(CONFIG) cfg: AppConfig) {
    this.load(path.join(cfg.rootDir, 'data', 'beads'));
  }

  private load(dir: string) {
    const specs = JSON.parse(fs.readFileSync(path.join(dir, 'specs.json'), 'utf8')) as Array<BeadSpec & { notes?: string }>;
    for (const s of specs) {
      const { notes: _n, ...spec } = s;
      this.specsById.set(spec.id, spec);
    }
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json') || file === 'specs.json') continue;
      const cat = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as CatalogFile;
      if (!this.specsById.has(cat.specId)) {
        this.log.warn(`catalogue ${file} references unknown spec ${cat.specId}; skipped`);
        continue;
      }
      const colors: BeadColor[] = cat.colors.map((c) => ({
        id: `${cat.specId}:${c.code}`,
        specId: cat.specId,
        code: c.code,
        name: c.name,
        finish: c.finish,
        hex: c.hex.toLowerCase(),
        lab: rgbToLab(hexToRgb(c.hex)),
        michaelsCommon: c.michaelsCommon,
        source: c.source,
      }));
      this.colorsBySpec.set(cat.specId, colors);
      this.log.log(`loaded ${colors.length} colours for ${cat.specId}`);
    }
  }

  specs(): BeadSpec[] {
    return [...this.specsById.values()].filter((s) => this.colorsBySpec.has(s.id));
  }

  spec(id: string): BeadSpec | undefined {
    return this.specsById.get(id);
  }

  colors(specId: string): BeadColor[] {
    return this.colorsBySpec.get(specId) ?? [];
  }

  finishes(specId: string): string[] {
    return [...new Set(this.colors(specId).map((c) => c.finish))];
  }

  /** The beads a generation run may use, after applying the settings' filters. */
  paletteFor(settings: GenerationSettings): BeadColor[] {
    let colors = this.colors(settings.beadSpecId);
    if (settings.selectedBeadIds?.length) {
      const wanted = new Set(settings.selectedBeadIds);
      colors = colors.filter((c) => wanted.has(c.id));
    } else {
      const finishes = new Set(settings.finishes);
      colors = colors.filter((c) => finishes.has(c.finish));
    }
    return colors;
  }
}
