import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ensureBrowserId, readBrowserId } from '../../common/browser-identity';
import { RateLimitGuard } from '../../common/rate-limit.guard';
import { CONFIG, type AppConfig } from '../../config/config';
import { ProjectsService } from './projects.service';

@Controller('api/projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Get()
  list(@Req() req: Request) {
    const browserId = readBrowserId(req);
    return { projects: browserId ? this.projects.listForBrowser(browserId) : [] };
  }

  @Post()
  @UseGuards(RateLimitGuard)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('title') title: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) throw new BadRequestException('Attach an image as the "image" field.');
    const browserId = ensureBrowserId(req, res, this.cfg.isProd);
    const project = await this.projects.create(browserId, file.buffer, title);
    return { project };
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: Request) {
    const row = this.projects.getRow(id);
    const browserId = readBrowserId(req);
    return { project: this.projects.toProject(row, this.projects.latestPatternId(id)), canEdit: browserId === row.browserId };
  }

  @Patch(':id/settings')
  @UseGuards(RateLimitGuard)
  updateSettings(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    const row = this.projects.getRow(id);
    this.projects.assertOwner(row, readBrowserId(req));
    return { project: this.projects.updateSettings(row, body) };
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard)
  rename(@Param('id') id: string, @Body('title') title: unknown, @Req() req: Request) {
    const row = this.projects.getRow(id);
    this.projects.assertOwner(row, readBrowserId(req));
    if (typeof title !== 'string') throw new BadRequestException('title must be a string');
    return { project: this.projects.rename(row, title) };
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const row = this.projects.getRow(id);
    this.projects.assertOwner(row, readBrowserId(req));
    await this.projects.delete(row);
    return { ok: true };
  }

  @Get(':id/thumbnail.jpg')
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'private, max-age=3600')
  async thumbnail(@Param('id') id: string, @Res() res: Response) {
    const row = this.projects.getRow(id);
    res.send(await this.projects.thumbnail(row));
  }

  @Get(':id/working.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'private, max-age=3600')
  async working(@Param('id') id: string, @Res() res: Response) {
    const row = this.projects.getRow(id);
    res.send(await this.projects.workingImage(row));
  }
}
