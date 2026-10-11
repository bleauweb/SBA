import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { GuidesModule } from './modules/guides/guides.module';
import { HealthModule } from './modules/health/health.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { ImagesModule } from './modules/images/images.module';
import { PalettesModule } from './modules/palettes/palettes.module';
import { PatternsModule } from './modules/patterns/patterns.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RenderModule } from './modules/render/render.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    HealthModule,
    ImagesModule,
    PalettesModule,
    ProjectsModule,
    PatternsModule,
    GuidesModule,
    HousekeepingModule,
    // Must come last: it owns the catch-all page route.
    RenderModule,
  ],
})
export class AppModule {}
