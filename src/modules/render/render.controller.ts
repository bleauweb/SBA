import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { readBrowserId } from '../../common/browser-identity';
import type { PageData } from '../../shared/types';
import { PalettesService } from '../palettes/palettes.service';
import { PatternsService } from '../patterns/patterns.service';
import { ProjectsService } from '../projects/projects.service';
import { SsrService } from './ssr.service';

/** Catch-all for page routes. API routes are registered first and never reach this. */
@Controller()
export class RenderController {
  constructor(
    private readonly ssr: SsrService,
    private readonly projects: ProjectsService,
    private readonly patterns: PatternsService,
    private readonly palettes: PalettesService,
  ) {}

  @Get('{*path}')
  async page(@Req() req: Request, @Res() res: Response) {
    const url = req.originalUrl;
    const pathname = url.split('?')[0];
    if (pathname.startsWith('/api/')) {
      res.status(404).json({ message: 'not found' });
      return;
    }
    const data = this.load(pathname, req);
    const html = await this.ssr.renderPage(url, data);
    res.status(data.page === 'not-found' ? 404 : 200).type('html').send(html);
  }

  private load(pathname: string, req: Request): PageData {
    const browserId = readBrowserId(req);
    if (pathname === '/') {
      return { page: 'home', recent: browserId ? this.projects.listForBrowser(browserId) : [], specs: this.palettes.specs() };
    }
    let m = /^\/projects\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
    if (m) {
      try {
        const row = this.projects.getRow(m[1]);
        const pattern = this.patterns.latestForProject(row.id);
        return {
          page: 'project',
          project: this.projects.toProject(row, pattern?.id ?? null),
          pattern,
          canEdit: browserId === row.browserId,
          specs: this.palettes.specs(),
          finishes: this.palettes.finishes(row.settings.beadSpecId),
        };
      } catch {
        return { page: 'not-found' };
      }
    }
    m = /^\/patterns\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
    if (m) {
      try {
        const pattern = this.patterns.get(m[1]);
        const row = this.projects.getRow(pattern.projectId);
        return { page: 'pattern', pattern, project: this.projects.toSummary(row, this.projects.latestPatternId(row.id)) };
      } catch {
        return { page: 'not-found' };
      }
    }
    return { page: 'not-found' };
  }
}
