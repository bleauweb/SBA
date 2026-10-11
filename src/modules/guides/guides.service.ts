import { Injectable, Logger } from '@nestjs/common';
import { renderGuidePdf } from '../../pdf/render-guide';
import type { Pattern } from '../../shared/types';
import { ImageStorage } from '../images/image-storage';
import { PatternsService } from '../patterns/patterns.service';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class GuidesService {
  private readonly log = new Logger(GuidesService.name);

  constructor(
    private readonly storage: ImageStorage,
    private readonly patterns: PatternsService,
    private readonly projects: ProjectsService,
  ) {}

  /** Returns the cached PDF for a pattern version, rendering it on first request. */
  async guideFor(patternId: string, publicBaseUrl: string): Promise<{ pdf: Buffer; filename: string }> {
    const row = this.patterns.getRow(patternId);
    const project = this.projects.getRow(row.projectId);
    const filename = `${project.title.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'pattern'}-v${row.version}.pdf`;

    if (row.guideKey && (await this.storage.exists(row.guideKey))) {
      return { pdf: await this.storage.get(row.guideKey), filename };
    }

    const pattern: Pattern = this.patterns.toPattern(row);
    const started = Date.now();
    const png = await this.patterns.preview(pattern, 8, true);
    const pdf = await renderGuidePdf({
      pattern,
      projectTitle: project.title,
      projectUrl: `${publicBaseUrl}/projects/${project.id}`,
      previewDataUri: `data:image/png;base64,${png.toString('base64')}`,
      generatedAt: new Date().toISOString(),
    });
    const key = `projects/${project.id}/guides/${row.id}.pdf`;
    await this.storage.put(key, pdf);
    this.patterns.setGuideKey(row.id, key);
    this.log.log(`rendered guide ${key} (${pdf.length} bytes) in ${Date.now() - started} ms`);
    return { pdf, filename };
  }
}
