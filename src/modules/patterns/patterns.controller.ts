import { Controller, Get, Header, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { readBrowserId } from '../../common/browser-identity';
import { RateLimitGuard } from '../../common/rate-limit.guard';
import { ProjectsService } from '../projects/projects.service';
import { PatternsService } from './patterns.service';

@Controller('api')
export class PatternsController {
  constructor(
    private readonly patterns: PatternsService,
    private readonly projects: ProjectsService,
  ) {}

  @Post('projects/:id/patterns')
  @UseGuards(RateLimitGuard)
  async generate(@Param('id') id: string, @Req() req: Request) {
    const row = this.projects.getRow(id);
    this.projects.assertOwner(row, readBrowserId(req));
    return { pattern: await this.patterns.generate(row) };
  }

  @Get('patterns/:id')
  get(@Param('id') id: string) {
    return { pattern: this.patterns.get(id) };
  }

  @Get('patterns/:id/preview.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async preview(@Param('id') id: string, @Query('scale') scale: string | undefined, @Res() res: Response) {
    const pattern = this.patterns.get(id);
    const s = Math.max(1, Math.min(20, Number(scale ?? 6) || 6));
    res.send(await this.patterns.preview(pattern, s));
  }
}
