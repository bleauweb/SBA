import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PalettesService } from './palettes.service';

@Controller('api/palettes')
export class PalettesController {
  constructor(private readonly palettes: PalettesService) {}

  @Get()
  list() {
    return {
      specs: this.palettes.specs().map((s) => ({ ...s, finishes: this.palettes.finishes(s.id) })),
    };
  }

  @Get(':specId/colors')
  colors(@Param('specId') specId: string) {
    if (!this.palettes.spec(specId)) throw new NotFoundException('unknown bead spec');
    return { colors: this.palettes.colors(specId).map(({ lab: _l, ...c }) => c) };
  }
}
