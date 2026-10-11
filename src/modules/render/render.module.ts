import { Module } from '@nestjs/common';
import { PalettesModule } from '../palettes/palettes.module';
import { PatternsModule } from '../patterns/patterns.module';
import { ProjectsModule } from '../projects/projects.module';
import { RenderController } from './render.controller';
import { SsrService } from './ssr.service';

@Module({
  imports: [ProjectsModule, PatternsModule, PalettesModule],
  controllers: [RenderController],
  providers: [SsrService],
  exports: [SsrService],
})
export class RenderModule {}
