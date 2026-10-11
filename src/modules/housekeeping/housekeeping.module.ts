import { Inject, Injectable, Logger, Module } from '@nestjs/common';
import { Cron, ScheduleModule } from '@nestjs/schedule';
import { CONFIG, type AppConfig } from '../../config/config';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class ExpiryService {
  private readonly log = new Logger(ExpiryService.name);
  constructor(
    private readonly projects: ProjectsService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** Nightly at 03:17 server time: drop projects nobody has opened in RETENTION_DAYS. */
  @Cron('17 3 * * *')
  async run() {
    const n = await this.projects.deleteExpired(this.cfg.retentionDays);
    if (n > 0) this.log.log(`deleted ${n} expired project(s)`);
  }
}

@Module({
  imports: [ScheduleModule.forRoot(), ProjectsModule],
  providers: [ExpiryService],
})
export class HousekeepingModule {}
