import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GuidesService } from './guides.service';

@Controller('api/patterns')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get(':id/guide.pdf')
  async guide(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const base = `${req.protocol}://${req.get('host')}`;
    const { pdf, filename } = await this.guides.guideFor(id, base);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(pdf);
  }
}
