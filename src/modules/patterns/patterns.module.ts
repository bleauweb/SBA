import { Module } from '@nestjs/common';
import { PalettesModule } from '../palettes/palettes.module';
import { ProjectsModule } from '../projects/projects.module';
import { PatternsController } from './patterns.controller';
import { PatternsService } from './patterns.service';

@Module({
  imports: [ProjectsModule, PalettesModule],
  controllers: [PatternsController],
  providers: [PatternsService],
  exports: [PatternsService],
})
export class PatternsModule {}
