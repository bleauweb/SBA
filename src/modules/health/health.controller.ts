import { Controller, Get, Inject } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../../config/config';

@Controller('api/health')
export class HealthController {
  constructor(@Inject(CONFIG) private readonly cfg: AppConfig) {}

  @Get()
  health() {
    return { ok: true, retentionHours: this.cfg.retentionHours };
  }
}
