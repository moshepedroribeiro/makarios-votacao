import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SoAdmin, Usuario, UsuarioLogado } from '../auth/auth';
import { CIDADES } from '../common/regras';
import { MembrosService } from './membros.service';

class MembroDto {
  @IsString() nome!: string;
  @IsString() cpf!: string;
  @IsString() dataNascimento!: string;
  @IsString() dataEntrada!: string;
  @IsOptional() @IsString() dataColeteamento?: string | null;
  @IsOptional() @IsString() dataFechamento?: string | null;
  @IsString() cidade!: string;
}

class HabilitacaoDto {
  @IsBoolean() habilitado!: boolean;
  @IsString() motivo!: string;
}

class ImportacaoDto {
  @IsString() csv!: string;
}

@Controller('membros')
export class MembrosController {
  constructor(private readonly membros: MembrosService) {}

  @Get('cidades')
  cidades() {
    return Object.entries(CIDADES).map(([cidade, uf]) => ({ cidade, uf }));
  }

  @Get()
  listar(@Query() q: { busca?: string; cidade?: string; apto?: string; inativos?: string }) {
    return this.membros.listar(q);
  }

  @SoAdmin()
  @Get(':id')
  buscar(@Param('id', ParseIntPipe) id: number) {
    return this.membros.paraApi(this.membros.buscar(id), true);
  }

  @SoAdmin()
  @Post()
  criar(@Body() dto: MembroDto) {
    return this.membros.criar(dto);
  }

  @SoAdmin()
  @Post('importar')
  importar(@Body() dto: ImportacaoDto) {
    return this.membros.importarCsv(dto.csv);
  }

  @SoAdmin()
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: MembroDto) {
    return this.membros.atualizar(id, dto);
  }

  @Patch(':id/habilitacao')
  habilitacao(@Param('id', ParseIntPipe) id: number, @Body() dto: HabilitacaoDto, @Usuario() u: UsuarioLogado) {
    return this.membros.alterarHabilitacao(id, dto.habilitado, dto.motivo, u);
  }

  @Get(':id/historico')
  historico(@Param('id', ParseIntPipe) id: number) {
    return this.membros.historico(id);
  }

  @SoAdmin()
  @Delete(':id')
  remover(@Param('id', ParseIntPipe) id: number) {
    return this.membros.remover(id);
  }

  @SoAdmin()
  @Post(':id/reativar')
  reativar(@Param('id', ParseIntPipe) id: number) {
    return this.membros.reativar(id);
  }
}
