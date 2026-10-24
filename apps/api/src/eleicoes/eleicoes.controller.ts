import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Res } from '@nestjs/common';
import { ArrayUnique, IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { SoAdmin, Usuario, UsuarioLogado } from '../auth/auth';
import { ApuracaoService } from './apuracao.service';
import { EleicoesService } from './eleicoes.service';
import { RelatoriosService } from './relatorios.service';

class EleicaoDto {
  @IsString() titulo!: string;
  @IsString() inicio!: string;
  @IsString() termino!: string;
  @IsOptional() @IsInt() presidenteSessaoId?: number | null;
  @IsOptional() @IsArray() @ArrayUnique() @IsInt({ each: true }) mesarioIds?: number[];
}

class CandidaturaDto {
  @IsInt() membroId!: number;
  @IsOptional() @IsString() apelido?: string;
}

class EscolhaViceDto {
  @IsInt() candidaturaId!: number;
}

@Controller('eleicoes')
export class EleicoesController {
  constructor(
    private readonly eleicoes: EleicoesService,
    private readonly apuracao: ApuracaoService,
    private readonly relatorios: RelatoriosService,
  ) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado) {
    return this.eleicoes.listar(u);
  }

  @Get(':id')
  detalhe(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.eleicoes.detalhe(id, u);
  }

  @SoAdmin()
  @Post()
  criar(@Body() dto: EleicaoDto) {
    return this.eleicoes.criar(dto);
  }

  @SoAdmin()
  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: EleicaoDto) {
    return this.eleicoes.atualizar(id, dto);
  }

  @SoAdmin()
  @Delete(':id')
  excluir(@Param('id', ParseIntPipe) id: number) {
    return this.eleicoes.excluir(id);
  }

  // ---- candidaturas
  @Post(':id/candidaturas')
  registrar(@Param('id', ParseIntPipe) id: number, @Body() dto: CandidaturaDto, @Usuario() u: UsuarioLogado) {
    return this.eleicoes.registrarCandidatura(id, dto.membroId, dto.apelido, u);
  }

  @Delete(':id/candidaturas/:cid')
  removerCandidatura(
    @Param('id', ParseIntPipe) id: number,
    @Param('cid', ParseIntPipe) cid: number,
    @Usuario() u: UsuarioLogado,
  ) {
    return this.eleicoes.removerCandidatura(id, cid, u);
  }

  // ---- ciclo de vida
  @SoAdmin()
  @Post(':id/agendar')
  agendar(@Param('id', ParseIntPipe) id: number) {
    return this.eleicoes.agendar(id);
  }

  @SoAdmin()
  @Post(':id/rascunho')
  rascunho(@Param('id', ParseIntPipe) id: number) {
    return this.eleicoes.voltarParaRascunho(id);
  }

  @Post(':id/aptos/:membroId')
  incluirNaLista(
    @Param('id', ParseIntPipe) id: number,
    @Param('membroId', ParseIntPipe) membroId: number,
    @Usuario() u: UsuarioLogado,
  ) {
    return this.eleicoes.incluirNaLista(id, membroId, u);
  }

  @Post(':id/abrir')
  abrir(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.eleicoes.abrir(id, u);
  }

  @Post(':id/encerrar')
  encerrar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.eleicoes.encerrar(id, u);
  }

  @Get(':id/painel')
  painel(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.eleicoes.painel(id, u);
  }

  // ---- apuração
  @Post(':id/apurar')
  apurar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.apuracao.apurar(id, u);
  }

  @Post(':id/escolher-vice')
  escolherVice(@Param('id', ParseIntPipe) id: number, @Body() dto: EscolhaViceDto, @Usuario() u: UsuarioLogado) {
    return this.apuracao.escolherVice(id, dto.candidaturaId, u);
  }

  @Get(':id/resultado')
  resultado(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado) {
    return this.apuracao.resultado(id, u);
  }

  // ---- PDFs
  @Get(':id/presenca.pdf')
  async presenca(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado, @Res() res: Response) {
    const pdf = await this.relatorios.presenca(id, u);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="presenca-eleicao-${id}.pdf"` });
    res.send(pdf);
  }

  @Get(':id/ata.pdf')
  async ata(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioLogado, @Res() res: Response) {
    const pdf = await this.relatorios.ata(id, u);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="ata-eleicao-${id}.pdf"` });
    res.send(pdf);
  }
}
