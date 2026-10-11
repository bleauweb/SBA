import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module';
import { PalettesModule } from '../palettes/palettes.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [ImagesModule, PalettesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
