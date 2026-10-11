import { Module } from '@nestjs/common';
import { PalettesController } from './palettes.controller';
import { PalettesService } from './palettes.service';

@Module({ controllers: [PalettesController], providers: [PalettesService], exports: [PalettesService] })
export class PalettesModule {}
