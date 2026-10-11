import { Module } from '@nestjs/common';
import { ImagesModule } from '../images/images.module';
import { PatternsModule } from '../patterns/patterns.module';
import { ProjectsModule } from '../projects/projects.module';
import { GuidesController } from './guides.controller';
import { GuidesService } from './guides.service';

@Module({
  imports: [ImagesModule, PatternsModule, ProjectsModule],
  controllers: [GuidesController],
  providers: [GuidesService],
})
export class GuidesModule {}
